import crypto from 'crypto';
import { ApiError } from '../errors';
import { getAuthoritativeCatalogItem } from '../../config/shopCatalog';
import { ECONOMY_BALANCE_CONFIG } from '../../config/balanceConfig';
import {
  isFirestoreAvailable,
  getDb,
  memoryStore,
  assertPersistenceOperational,
  StoredEconomy,
  StoredEconomyTransaction,
  TransactionType
} from './db';
import { isValidIdempotencyKey, getProcessedAction, setProcessedAction } from './idempotency';

export type { TransactionType, StoredEconomy, StoredEconomyTransaction };

/**
 * Constructs and verifies a Double-Entry Ledger record.
 * Guarantees balanceAfter === balanceBefore + amount and pairs every user wallet mutation
 * with a corresponding treasury/sink counterparty account.
 */
export function buildDoubleEntryLedgerEntry(params: {
  transactionId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  referenceId?: string;
  createdAt: string;
}): StoredEconomyTransaction {
  if (
    !Number.isInteger(params.amount) ||
    !Number.isInteger(params.balanceBefore) ||
    !Number.isInteger(params.balanceAfter) ||
    params.balanceAfter !== params.balanceBefore + params.amount ||
    params.balanceAfter < 0
  ) {
    throw ApiError.internal(
      `Double-entry ledger invariant violation: before=${params.balanceBefore}, amount=${params.amount}, after=${params.balanceAfter}`,
      'INTERNAL_SERVER_ERROR'
    );
  }

  const isCreditToUser = params.amount >= 0;
  const userWalletAccount = `wallet:user:${params.userId}`;
  const systemTreasuryAccount = `treasury:system:${params.type.toLowerCase()}`;

  return {
    transactionId: params.transactionId,
    userId: params.userId,
    type: params.type,
    entryType: isCreditToUser ? 'CREDIT' : 'DEBIT',
    debitAccount: isCreditToUser ? systemTreasuryAccount : userWalletAccount,
    creditAccount: isCreditToUser ? userWalletAccount : systemTreasuryAccount,
    amount: params.amount,
    balanceBefore: params.balanceBefore,
    balanceAfter: params.balanceAfter,
    reason: params.reason,
    referenceId: params.referenceId,
    createdAt: params.createdAt
  };
}


export async function getUserEconomy(userId: string): Promise<StoredEconomy> {
  assertPersistenceOperational();

  const INITIAL_BALANCE = ECONOMY_BALANCE_CONFIG.starterCoins;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('userEconomy').doc(userId).get();
    if (doc.exists) {
      return doc.data() as StoredEconomy;
    }
    const initial: StoredEconomy = {
      userId,
      coins: INITIAL_BALANCE,
      totalEarned: INITIAL_BALANCE,
      totalSpent: 0,
      lastUpdated: Date.now()
    };
    await db.collection('userEconomy').doc(userId).set(initial);
    return initial;
  } else {
    let eco = memoryStore.economies.get(userId);
    if (!eco) {
      eco = {
        userId,
        coins: INITIAL_BALANCE,
        totalEarned: INITIAL_BALANCE,
        totalSpent: 0,
        lastUpdated: Date.now()
      };
      memoryStore.economies.set(userId, eco);
    }
    return eco;
  }
}

export async function executeShopPurchase(
  userId: string,
  itemId: string,
  idempotencyKey: string
): Promise<{
  success: boolean;
  itemId: string;
  itemType: string;
  value: string;
  remainingCoins: number;
  transactionId: string;
}> {
  assertPersistenceOperational();

  if (!isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency tidak valid.', 'INVALID_IDEMPOTENCY_KEY');
  }

  // Check idempotency cache first
  const existing = await getProcessedAction(`buy_${userId}_${idempotencyKey}`);
  if (existing) {
    return existing;
  }

  // Authoritative catalog check
  const catalogItem = getAuthoritativeCatalogItem(itemId);
  if (!catalogItem) {
    throw ApiError.notFound(`Item ${itemId} tidak ditemukan dalam katalog toko.`, 'ITEM_NOT_FOUND');
  }

  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();

  if (isFirestoreAvailable()) {
    const db = getDb();
    const ecoRef = db.collection('userEconomy').doc(userId);
    const itemRef = db.collection('userInventory').doc(userId).collection('items').doc(catalogItem.id);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);
    const actionRef = db.collection('processedActions').doc(`buy_${userId}_${idempotencyKey}`);

    return await db.runTransaction(async (tx) => {
      // 1. Check duplicate purchase for non-stackables
      if (!catalogItem.stackable) {
        const itemDoc = await tx.get(itemRef);
        if (itemDoc.exists) {
          throw new ApiError(400, 'ITEM_ALREADY_OWNED', 'Item ini sudah Anda miliki.');
        }
      }

      // 2. Check user balance
      const ecoDoc = await tx.get(ecoRef);
      if (!ecoDoc.exists) {
        throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi.');
      }
      const ecoData = ecoDoc.data() as StoredEconomy;
      if (ecoData.coins < catalogItem.cost) {
        throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi untuk membeli item ini.');
      }

      // 3. Debit balance
      const updatedEco: StoredEconomy = {
        userId,
        coins: ecoData.coins - catalogItem.cost,
        totalEarned: ecoData.totalEarned,
        totalSpent: ecoData.totalSpent + catalogItem.cost,
        lastUpdated: Date.now()
      };
      tx.set(ecoRef, updatedEco);

      // 4. Record item ownership
      tx.set(itemRef, {
        itemId: catalogItem.id,
        name: catalogItem.name,
        type: catalogItem.type,
        value: catalogItem.value,
        purchasedAt: nowIso
      });

      // 5. Record immutable double-entry ledger
      const ledgerEntry = buildDoubleEntryLedgerEntry({
        transactionId,
        userId,
        type: 'PURCHASE',
        amount: -catalogItem.cost,
        balanceBefore: ecoData.coins,
        balanceAfter: updatedEco.coins,
        reason: `SHOP_BUY_${catalogItem.id.toUpperCase()}`,
        referenceId: catalogItem.id,
        createdAt: nowIso
      });
      tx.set(ledgerRef, ledgerEntry);

      const result = {
        success: true,
        itemId: catalogItem.id,
        itemType: catalogItem.type,
        value: catalogItem.value,
        remainingCoins: updatedEco.coins,
        transactionId
      };

      // 6. Record idempotency
      tx.set(actionRef, { result, timestamp: Date.now() });

      return result;
    });
  } else {
    // Memory store transaction equivalent
    const userItems = memoryStore.inventory.get(userId) || new Set<string>();
    if (!catalogItem.stackable && userItems.has(catalogItem.id)) {
      throw new ApiError(400, 'ITEM_ALREADY_OWNED', 'Item ini sudah Anda miliki.');
    }

    const currentEco = await getUserEconomy(userId);
    if (currentEco.coins < catalogItem.cost) {
      throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi untuk membeli item ini.');
    }

    const balanceBefore = currentEco.coins;
    currentEco.coins -= catalogItem.cost;
    currentEco.totalSpent += catalogItem.cost;
    currentEco.lastUpdated = Date.now();
    memoryStore.economies.set(userId, currentEco);

    userItems.add(catalogItem.id);
    memoryStore.inventory.set(userId, userItems);

    const ledgerEntry = buildDoubleEntryLedgerEntry({
      transactionId,
      userId,
      type: 'PURCHASE',
      amount: -catalogItem.cost,
      balanceBefore,
      balanceAfter: currentEco.coins,
      reason: `SHOP_BUY_${catalogItem.id.toUpperCase()}`,
      referenceId: catalogItem.id,
      createdAt: nowIso
    });
    memoryStore.ledger.push(ledgerEntry);

    const result = {
      success: true,
      itemId: catalogItem.id,
      itemType: catalogItem.type,
      value: catalogItem.value,
      remainingCoins: currentEco.coins,
      transactionId
    };

    memoryStore.processedActions.set(`buy_${userId}_${idempotencyKey}`, { result, timestamp: Date.now() });
    return result;
  }
}

export const DAILY_SPIN_PRIZES = [
  { amount: 25, weight: 40 },
  { amount: 50, weight: 30 },
  { amount: 100, weight: 18 },
  { amount: 250, weight: 9 },
  { amount: 500, weight: 3 }
];

export async function getSpinCooldown(userId: string): Promise<{ canSpin: boolean; lastSpinDate: string | null }> {
  assertPersistenceOperational();
  const todayStr = new Date().toISOString().split('T')[0];

  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('spinCooldowns').doc(userId).get();
    if (!doc.exists) return { canSpin: true, lastSpinDate: null };
    const data = doc.data();
    return {
      canSpin: data?.lastSpinDate !== todayStr,
      lastSpinDate: data?.lastSpinDate || null
    };
  } else {
    const data = memoryStore.spins.get(userId);
    if (!data) return { canSpin: true, lastSpinDate: null };
    return {
      canSpin: data.lastSpinDate !== todayStr,
      lastSpinDate: data.lastSpinDate
    };
  }
}

export async function executeDailySpin(userId: string): Promise<{
  success: boolean;
  prize: number;
  newCoinBalance: number;
  transactionId: string;
}> {
  assertPersistenceOperational();
  const todayStr = new Date().toISOString().split('T')[0];
  const totalWeight = DAILY_SPIN_PRIZES.reduce((acc, p) => acc + p.weight, 0);

  // Secure Cryptographic RNG (crypto.randomInt)
  const randInt = crypto.randomInt(0, totalWeight);
  let selectedPrize = DAILY_SPIN_PRIZES[0].amount;
  let accumulated = 0;
  for (const p of DAILY_SPIN_PRIZES) {
    accumulated += p.weight;
    if (randInt < accumulated) {
      selectedPrize = p.amount;
      break;
    }
  }

  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();

  if (isFirestoreAvailable()) {
    const db = getDb();
    const cooldownRef = db.collection('spinCooldowns').doc(userId);
    const ecoRef = db.collection('userEconomy').doc(userId);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);

    return await db.runTransaction(async (tx) => {
      // Atomic cooldown verification
      const cdDoc = await tx.get(cooldownRef);
      if (cdDoc.exists && cdDoc.data()?.lastSpinDate === todayStr) {
        throw new ApiError(429, 'SPIN_COOLDOWN', 'Putaran harian sudah digunakan hari ini. Silakan kembali besok.');
      }

      // Read current economy
      const ecoDoc = await tx.get(ecoRef);
      const current: StoredEconomy = ecoDoc.exists
        ? (ecoDoc.data() as StoredEconomy)
        : { userId, coins: ECONOMY_BALANCE_CONFIG.starterCoins, totalEarned: ECONOMY_BALANCE_CONFIG.starterCoins, totalSpent: 0, lastUpdated: Date.now() };

      const updatedEco: StoredEconomy = {
        userId,
        coins: current.coins + selectedPrize,
        totalEarned: current.totalEarned + selectedPrize,
        totalSpent: current.totalSpent,
        lastUpdated: Date.now()
      };

      // Set cooldown atomically
      tx.set(cooldownRef, {
        userId,
        lastSpinDate: todayStr,
        updatedAt: Date.now()
      });

      // Update economy atomically
      tx.set(ecoRef, updatedEco);

      // Record transaction ledger
      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: 'DAILY_SPIN',
        amount: selectedPrize,
        balanceBefore: current.coins,
        balanceAfter: updatedEco.coins,
        reason: 'DAILY_SPIN_WHEEL',
        referenceId: todayStr,
        createdAt: nowIso
      };
      tx.set(ledgerRef, ledgerEntry);

      return {
        success: true,
        prize: selectedPrize,
        newCoinBalance: updatedEco.coins,
        transactionId
      };
    });
  } else {
    // In-memory atomic check
    const existing = memoryStore.spins.get(userId);
    if (existing && existing.lastSpinDate === todayStr) {
      throw new ApiError(429, 'SPIN_COOLDOWN', 'Putaran harian sudah digunakan hari ini. Silakan kembali besok.');
    }

    memoryStore.spins.set(userId, {
      lastSpinDate: todayStr,
      count: (existing?.count || 0) + 1,
      updatedAt: Date.now()
    });

    const currentEco = await getUserEconomy(userId);
    const balanceBefore = currentEco.coins;
    currentEco.coins += selectedPrize;
    currentEco.totalEarned += selectedPrize;
    currentEco.lastUpdated = Date.now();
    memoryStore.economies.set(userId, currentEco);

    const ledgerEntry = buildDoubleEntryLedgerEntry({
      transactionId,
      userId,
      type: 'DAILY_SPIN',
      amount: selectedPrize,
      balanceBefore,
      balanceAfter: currentEco.coins,
      reason: 'DAILY_SPIN_WHEEL',
      referenceId: todayStr,
      createdAt: nowIso
    });
    memoryStore.ledger.push(ledgerEntry);

    return {
      success: true,
      prize: selectedPrize,
      newCoinBalance: currentEco.coins,
      transactionId
    };
  }
}

export async function executeGamble(
  userId: string,
  bet: number,
  choice: 'heads' | 'tails',
  idempotencyKey?: string
): Promise<{
  success: boolean;
  won: boolean;
  outcomeSide: 'heads' | 'tails';
  remainingCoins: number;
  changeCoins: number;
  transactionId: string;
}> {
  assertPersistenceOperational();

  // STRICT NUMERIC SAFETY AUDIT (Priority 14, 16 & 17)
  if (
    typeof bet !== 'number' ||
    !Number.isInteger(bet) ||
    !Number.isFinite(bet) ||
    isNaN(bet) ||
    bet <= 0 ||
    bet < ECONOMY_BALANCE_CONFIG.gamble.minBet ||
    bet > ECONOMY_BALANCE_CONFIG.gamble.maxBet
  ) {
    throw ApiError.badRequest('Nilai taruhan koin tidak valid atau di luar batas wajar.', 'INVALID_BET_AMOUNT');
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency valid wajib disertakan untuk taruhan.', 'INVALID_IDEMPOTENCY_KEY');
  }

  const existing = await getProcessedAction(`gamble_${userId}_${idempotencyKey}`);
  if (existing) return existing;

  const validBets = ECONOMY_BALANCE_CONFIG.gamble.validBets;
  if (!validBets.includes(bet)) {
    throw ApiError.badRequest('Nilai taruhan koin harus salah satu dari pilihan yang tersedia.', 'INVALID_BET_AMOUNT');
  }

  if (choice !== 'heads' && choice !== 'tails') {
    throw ApiError.badRequest('Pilihan lempar koin harus "heads" atau "tails".', 'INVALID_CHOICE');
  }

  // Cryptographically secure RNG with custom configured probability
  const randNum = crypto.randomInt(0, 100);
  const isWin = randNum < (ECONOMY_BALANCE_CONFIG.gamble.winProbability * 100);
  const outcomeSide: 'heads' | 'tails' = isWin ? choice : (choice === 'heads' ? 'tails' : 'heads');
  const change = isWin ? bet : -bet;
  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();

  let remainingCoins = 0;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const ecoRef = db.collection('userEconomy').doc(userId);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);

    await db.runTransaction(async (tx) => {
      const ecoDoc = await tx.get(ecoRef);
      if (!ecoDoc.exists) {
        throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi.');
      }
      const current = ecoDoc.data() as StoredEconomy;
      if (current.coins < bet) {
        throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi untuk bertaruh.');
      }

      const updatedCoins = current.coins + change;
      const updatedEco: StoredEconomy = {
        userId,
        coins: updatedCoins,
        totalEarned: isWin ? current.totalEarned + bet : current.totalEarned,
        totalSpent: !isWin ? current.totalSpent + bet : current.totalSpent,
        lastUpdated: Date.now()
      };

      tx.set(ecoRef, updatedEco);

      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: isWin ? 'QUEST_REWARD' : 'PURCHASE',
        amount: change,
        balanceBefore: current.coins,
        balanceAfter: updatedCoins,
        reason: isWin ? `GAMBLE_WIN_${bet}` : `GAMBLE_LOSS_${bet}`,
        referenceId: choice,
        createdAt: nowIso
      };
      tx.set(ledgerRef, ledgerEntry);

      remainingCoins = updatedCoins;
    });
  } else {
    const current = await getUserEconomy(userId);
    if (current.coins < bet) {
      throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi untuk bertaruh.');
    }

    const balanceBefore = current.coins;
    current.coins += change;
    if (isWin) {
      current.totalEarned += bet;
    } else {
      current.totalSpent += bet;
    }
    current.lastUpdated = Date.now();
    memoryStore.economies.set(userId, current);

    const ledgerEntry = buildDoubleEntryLedgerEntry({
      transactionId,
      userId,
      type: isWin ? 'QUEST_REWARD' : 'PURCHASE',
      amount: change,
      balanceBefore,
      balanceAfter: current.coins,
      reason: isWin ? `GAMBLE_WIN_${bet}` : `GAMBLE_LOSS_${bet}`,
      referenceId: choice,
      createdAt: nowIso
    });
    memoryStore.ledger.push(ledgerEntry);
    remainingCoins = current.coins;
  }

  const result = {
    success: true,
    won: isWin,
    outcomeSide,
    remainingCoins,
    changeCoins: change,
    transactionId
  };

  if (idempotencyKey) {
    await setProcessedAction(`gamble_${userId}_${idempotencyKey}`, result);
  }

  return result;
}

export const GACHA_CATALOG_ITEMS = [
  { id: 'avatar_alien', name: 'Alien Prime', type: 'avatar', value: '👽', cost: 50 },
  { id: 'avatar_ninja', name: 'Shadow Ninja', type: 'avatar', value: '🥷', cost: 50 },
  { id: 'avatar_robot', name: 'Cyber Mech', type: 'avatar', value: '🤖', cost: 50 },
  { id: 'avatar_wizard', name: 'Arcane Mage', type: 'avatar', value: '🧙', cost: 50 },
  { id: 'avatar_dragon', name: 'Solar Dragon', type: 'avatar', value: '🐉', cost: 50 },
  { id: 'theme_cyberpunk', name: 'Neon Cyberpunk', type: 'theme', value: '#ec4899', cost: 50 },
  { id: 'theme_retro', name: 'Retro Amber', type: 'theme', value: '#f59e0b', cost: 50 },
  { id: 'theme_matrix', name: 'Matrix Terminal', type: 'theme', value: '#22c55e', cost: 50 },
  { id: 'theme_synthwave', name: 'Synthwave Sunset', type: 'theme', value: '#8b5cf6', cost: 50 }
];

export async function executeGacha(
  userId: string,
  idempotencyKey?: string
): Promise<{
  success: boolean;
  rewardId: string;
  item: typeof GACHA_CATALOG_ITEMS[0];
  remainingCoins: number;
  transactionId: string;
  isDuplicate?: boolean;
}> {
  assertPersistenceOperational();
  const GACHA_COST = ECONOMY_BALANCE_CONFIG.gachaCost;

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency valid wajib disertakan untuk gacha.', 'INVALID_IDEMPOTENCY_KEY');
  }

  const existing = await getProcessedAction(`gacha_${userId}_${idempotencyKey}`);
  if (existing) return existing;

  // Secure random item selection
  const randIdx = crypto.randomInt(0, GACHA_CATALOG_ITEMS.length);
  const picked = GACHA_CATALOG_ITEMS[randIdx];
  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();

  let remainingCoins = 0;
  let isDuplicate = false;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const ecoRef = db.collection('userEconomy').doc(userId);
    const itemRef = db.collection('userInventory').doc(userId).collection('items').doc(picked.id);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);

    await db.runTransaction(async (tx) => {
      const ecoDoc = await tx.get(ecoRef);
      if (!ecoDoc.exists) {
        throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi.');
      }
      const current = ecoDoc.data() as StoredEconomy;
      if (current.coins < GACHA_COST) {
        throw new ApiError(400, 'INSUFFICIENT_FUNDS', `Saldo koin tidak mencukupi untuk menarik gacha (${GACHA_COST} koin diperlukan).`);
      }

      // Check duplicate cosmetics
      const itemDoc = await tx.get(itemRef);
      isDuplicate = itemDoc.exists;

      // Duplicate pull refund conversion rule: refund 25 coins
      const refundCoins = isDuplicate ? ECONOMY_BALANCE_CONFIG.gachaDuplicateRefund : 0;
      const finalCoinDiff = -GACHA_COST + refundCoins;

      const updatedEco: StoredEconomy = {
        userId,
        coins: current.coins + finalCoinDiff,
        totalEarned: current.totalEarned + refundCoins,
        totalSpent: current.totalSpent + GACHA_COST,
        lastUpdated: Date.now()
      };

      tx.set(ecoRef, updatedEco);

      if (!isDuplicate) {
        tx.set(itemRef, {
          itemId: picked.id,
          name: picked.name,
          type: picked.type,
          value: picked.value,
          purchasedAt: nowIso
        });
      }

      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: isDuplicate ? 'REFUND' : 'PURCHASE',
        amount: finalCoinDiff,
        balanceBefore: current.coins,
        balanceAfter: updatedEco.coins,
        reason: isDuplicate ? `GACHA_PULL_DUPLICATE_REFUND_${picked.id.toUpperCase()}` : `GACHA_PULL_${picked.id.toUpperCase()}`,
        referenceId: picked.id,
        createdAt: nowIso
      };
      tx.set(ledgerRef, ledgerEntry);

      remainingCoins = updatedEco.coins;
    });
  } else {
    const current = await getUserEconomy(userId);
    if (current.coins < GACHA_COST) {
      throw new ApiError(400, 'INSUFFICIENT_FUNDS', `Saldo koin tidak mencukupi untuk menarik gacha (${GACHA_COST} koin diperlukan).`);
    }

    const userItems = memoryStore.inventory.get(userId) || new Set<string>();
    isDuplicate = userItems.has(picked.id);

    const refundCoins = isDuplicate ? ECONOMY_BALANCE_CONFIG.gachaDuplicateRefund : 0;
    const finalCoinDiff = -GACHA_COST + refundCoins;

    const balanceBefore = current.coins;
    current.coins += finalCoinDiff;
    current.totalSpent += GACHA_COST;
    current.totalEarned += refundCoins;
    current.lastUpdated = Date.now();
    memoryStore.economies.set(userId, current);

    if (!isDuplicate) {
      userItems.add(picked.id);
      memoryStore.inventory.set(userId, userItems);
    }

    const ledgerEntry = buildDoubleEntryLedgerEntry({
      transactionId,
      userId,
      type: isDuplicate ? 'REFUND' : 'PURCHASE',
      amount: finalCoinDiff,
      balanceBefore,
      balanceAfter: current.coins,
      reason: isDuplicate ? `GACHA_PULL_DUPLICATE_REFUND_${picked.id.toUpperCase()}` : `GACHA_PULL_${picked.id.toUpperCase()}`,
      referenceId: picked.id,
      createdAt: nowIso
    });
    memoryStore.ledger.push(ledgerEntry);
    remainingCoins = current.coins;
  }

  const result = {
    success: true,
    rewardId: picked.id,
    item: picked,
    remainingCoins,
    transactionId,
    isDuplicate
  };

  if (idempotencyKey) {
    await setProcessedAction(`gacha_${userId}_${idempotencyKey}`, result);
  }

  return result;
}
