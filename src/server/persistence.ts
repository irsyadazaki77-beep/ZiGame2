/**
 * Authoritative Server Persistence Layer
 * ZiGame 2.0 Stabilization & Production Hardening
 * 
 * Strict Server Authority, Atomic Transactions, Secure Crypto,
 * Immutable Economy Ledger, and Anti-Cheat Session Guarantees.
 */

import crypto from 'crypto';
import { getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { serverLogger } from './logger';
import { ApiError } from './errors';
import { requireCanonicalGameId, CanonicalGameId } from '../config/canonicalGames';
import { getAuthoritativeCatalogItem } from '../config/shopCatalog';
import { getGameBalanceConfig } from '../config/balanceConfig';

export const SESSION_MAX_LIFETIME_MS = 60 * 60 * 1000; // 1 hour max session lifetime

export interface StoredGameSession {
  sessionId: string;
  userId: string;
  gameId: CanonicalGameId;
  nonce: string;
  startTime: number;
  expiresAt: number;
  consumed: boolean;
  consumedAt?: number;
}

export interface StoredEconomy {
  userId: string;
  coins: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: number;
}

export type TransactionType =
  | 'GAME_REWARD'
  | 'PURCHASE'
  | 'DAILY_SPIN'
  | 'QUEST_REWARD'
  | 'ADMIN_ADJUSTMENT'
  | 'REFUND';

export interface StoredEconomyTransaction {
  transactionId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  referenceId?: string;
  createdAt: string;
}

export interface StoredLeaderboardEntry {
  userId: string;
  playerName: string;
  playerAvatar: string;
  score: number;
  submittedAt: string;
  gameId: CanonicalGameId;
  masteryLevel?: number;
}

export interface StoredSuspiciousScore {
  id: string;
  sessionId: string;
  userId: string;
  gameId: string;
  score: number;
  durationMs: number;
  velocity: number;
  reason: string;
  timestamp: string;
}

// In-Memory store for testing and standalone local execution
class InMemoryStore {
  sessions = new Map<string, StoredGameSession>();
  economies = new Map<string, StoredEconomy>();
  inventory = new Map<string, Set<string>>(); // userId -> set of owned itemIds
  spins = new Map<string, { lastSpinDate: string; count: number; updatedAt: number }>();
  leaderboards = new Map<string, StoredLeaderboardEntry[]>();
  processedActions = new Map<string, { result: any; timestamp: number }>();
  suspiciousScores: StoredSuspiciousScore[] = [];
  ledger: StoredEconomyTransaction[] = [];

  clear() {
    this.sessions.clear();
    this.economies.clear();
    this.inventory.clear();
    this.spins.clear();
    this.leaderboards.clear();
    this.processedActions.clear();
    this.suspiciousScores = [];
    this.ledger = [];
  }
}

export const memoryStore = new InMemoryStore();

/**
 * Returns true if Firestore is operational and configured
 */
export function isFirestoreAvailable(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return false;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    if (process.env.NODE_ENV !== 'production') {
      return false;
    }
  }
  if (getApps().length === 0) return false;
  return true;
}

function getDb(): Firestore {
  return getFirestore();
}

/**
 * Helper to ensure production fails closed if database is unavailable
 */
export function assertPersistenceOperational() {
  if (process.env.NODE_ENV === 'production' && !isFirestoreAvailable()) {
    serverLogger.security('FIREBASE_FAILURE', 'Database persistence unavailable in production');
    throw ApiError.serviceUnavailable('Database persistence service unavailable.');
  }
}

export type PersistenceStatus = 'firestore' | 'degraded' | 'unavailable';

export function getPersistenceHealthStatus(): { status: 'ok' | 'degraded' | 'unavailable'; persistence: PersistenceStatus } {
  const isAvailable = isFirestoreAvailable();
  if (isAvailable) {
    return { status: 'ok', persistence: 'firestore' };
  }
  if (process.env.NODE_ENV === 'production') {
    return { status: 'degraded', persistence: 'degraded' };
  }
  return { status: 'ok', persistence: 'degraded' };
}

/**
 * Validates format of idempotency keys
 */
export function isValidIdempotencyKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  return /^[a-zA-Z0-9_\-:]{8,128}$/.test(key);
}

// ==========================================
// 1 & 2. SESSION MANAGEMENT & SECURITY
// ==========================================

export async function createGameSession(userId: string, gameId: string): Promise<StoredGameSession> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);

  // Cryptographically secure identifier generation
  const sessionId = `ses_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();

  const session: StoredGameSession = {
    sessionId,
    userId,
    gameId: canonicalId,
    nonce,
    startTime: now,
    expiresAt: now + SESSION_MAX_LIFETIME_MS,
    consumed: false
  };

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('gameSessions').doc(sessionId).set(session);
  } else {
    memoryStore.sessions.set(sessionId, session);
  }

  return session;
}

export async function consumeGameSession(
  sessionId: string,
  userId: string,
  gameId: string
): Promise<{ valid: boolean; session?: StoredGameSession; reason?: string }> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);
  const now = Date.now();

  if (isFirestoreAvailable()) {
    const db = getDb();
    const docRef = db.collection('gameSessions').doc(sessionId);

    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) {
        return { valid: false, reason: 'SESSION_NOT_FOUND' };
      }

      const session = doc.data() as StoredGameSession;
      if (session.userId !== userId) {
        return { valid: false, reason: 'SESSION_USER_MISMATCH' };
      }

      if (session.gameId !== canonicalId) {
        return { valid: false, reason: 'SESSION_GAME_MISMATCH' };
      }

      if (session.consumed) {
        return { valid: false, reason: 'SESSION_ALREADY_CONSUMED' };
      }

      if (now > session.expiresAt) {
        return { valid: false, reason: 'SESSION_EXPIRED' };
      }

      const consumedAt = now;
      transaction.update(docRef, { consumed: true, consumedAt });

      return {
        valid: true,
        session: { ...session, consumed: true, consumedAt }
      };
    });
  } else {
    const session = memoryStore.sessions.get(sessionId);
    if (!session) return { valid: false, reason: 'SESSION_NOT_FOUND' };
    if (session.userId !== userId) return { valid: false, reason: 'SESSION_USER_MISMATCH' };
    if (session.gameId !== canonicalId) return { valid: false, reason: 'SESSION_GAME_MISMATCH' };
    if (session.consumed) return { valid: false, reason: 'SESSION_ALREADY_CONSUMED' };
    if (now > session.expiresAt) return { valid: false, reason: 'SESSION_EXPIRED' };

    session.consumed = true;
    session.consumedAt = now;
    return { valid: true, session };
  }
}

// ==========================================
// 3 & 4. USER ECONOMY & ATOMIC PURCHASES
// ==========================================

export async function getUserEconomy(userId: string): Promise<StoredEconomy> {
  assertPersistenceOperational();

  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('userEconomy').doc(userId).get();
    if (doc.exists) {
      return doc.data() as StoredEconomy;
    }
    const initial: StoredEconomy = {
      userId,
      coins: 100,
      totalEarned: 100,
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
        coins: 100,
        totalEarned: 100,
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

      // 5. Record immutable ledger
      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: 'PURCHASE',
        amount: -catalogItem.cost,
        balanceBefore: ecoData.coins,
        balanceAfter: updatedEco.coins,
        reason: `SHOP_BUY_${catalogItem.id.toUpperCase()}`,
        referenceId: catalogItem.id,
        createdAt: nowIso
      };
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

    const ledgerEntry: StoredEconomyTransaction = {
      transactionId,
      userId,
      type: 'PURCHASE',
      amount: -catalogItem.cost,
      balanceBefore,
      balanceAfter: currentEco.coins,
      reason: `SHOP_BUY_${catalogItem.id.toUpperCase()}`,
      referenceId: catalogItem.id,
      createdAt: nowIso
    };
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

// ==========================================
// 5 & 6. DAILY SPIN WITH SECURE RNG & ATOMICITY
// ==========================================

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
        : { userId, coins: 100, totalEarned: 100, totalSpent: 0, lastUpdated: Date.now() };

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

    const ledgerEntry: StoredEconomyTransaction = {
      transactionId,
      userId,
      type: 'DAILY_SPIN',
      amount: selectedPrize,
      balanceBefore,
      balanceAfter: currentEco.coins,
      reason: 'DAILY_SPIN_WHEEL',
      referenceId: todayStr,
      createdAt: nowIso
    };
    memoryStore.ledger.push(ledgerEntry);

    return {
      success: true,
      prize: selectedPrize,
      newCoinBalance: currentEco.coins,
      transactionId
    };
  }
}

// ==========================================
// SECURE SERVER-SIDE GAMBLE & GACHA
// ==========================================

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

  if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency tidak valid.', 'INVALID_IDEMPOTENCY_KEY');
  }

  if (idempotencyKey) {
    const existing = await getProcessedAction(`gamble_${userId}_${idempotencyKey}`);
    if (existing) return existing;
  }

  const validBets = [10, 20, 50, 100];
  if (!validBets.includes(bet) && (typeof bet !== 'number' || bet <= 0 || bet > 500)) {
    throw ApiError.badRequest('Nilai taruhan tidak valid.', 'INVALID_BET_AMOUNT');
  }

  if (choice !== 'heads' && choice !== 'tails') {
    throw ApiError.badRequest('Pilihan lempar koin harus "heads" atau "tails".', 'INVALID_CHOICE');
  }

  // Cryptographically secure RNG (48% win probability)
  const randNum = crypto.randomInt(0, 100);
  const isWin = randNum < 48;
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

    const ledgerEntry: StoredEconomyTransaction = {
      transactionId,
      userId,
      type: isWin ? 'QUEST_REWARD' : 'PURCHASE',
      amount: change,
      balanceBefore,
      balanceAfter: current.coins,
      reason: isWin ? `GAMBLE_WIN_${bet}` : `GAMBLE_LOSS_${bet}`,
      referenceId: choice,
      createdAt: nowIso
    };
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
}> {
  assertPersistenceOperational();
  const GACHA_COST = 50;

  if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency tidak valid.', 'INVALID_IDEMPOTENCY_KEY');
  }

  if (idempotencyKey) {
    const existing = await getProcessedAction(`gacha_${userId}_${idempotencyKey}`);
    if (existing) return existing;
  }

  // Secure random item selection
  const randIdx = crypto.randomInt(0, GACHA_CATALOG_ITEMS.length);
  const picked = GACHA_CATALOG_ITEMS[randIdx];
  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();

  let remainingCoins = 0;

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
        throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi untuk menarik gacha (50 koin diperlukan).');
      }

      const updatedEco: StoredEconomy = {
        userId,
        coins: current.coins - GACHA_COST,
        totalEarned: current.totalEarned,
        totalSpent: current.totalSpent + GACHA_COST,
        lastUpdated: Date.now()
      };

      tx.set(ecoRef, updatedEco);

      tx.set(itemRef, {
        itemId: picked.id,
        name: picked.name,
        type: picked.type,
        value: picked.value,
        purchasedAt: nowIso
      });

      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: 'PURCHASE',
        amount: -GACHA_COST,
        balanceBefore: current.coins,
        balanceAfter: updatedEco.coins,
        reason: `GACHA_PULL_${picked.id.toUpperCase()}`,
        referenceId: picked.id,
        createdAt: nowIso
      };
      tx.set(ledgerRef, ledgerEntry);

      remainingCoins = updatedEco.coins;
    });
  } else {
    const current = await getUserEconomy(userId);
    if (current.coins < GACHA_COST) {
      throw new ApiError(400, 'INSUFFICIENT_FUNDS', 'Saldo koin tidak mencukupi untuk menarik gacha (50 koin diperlukan).');
    }

    const balanceBefore = current.coins;
    current.coins -= GACHA_COST;
    current.totalSpent += GACHA_COST;
    current.lastUpdated = Date.now();
    memoryStore.economies.set(userId, current);

    const userItems = memoryStore.inventory.get(userId) || new Set<string>();
    userItems.add(picked.id);
    memoryStore.inventory.set(userId, userItems);

    const ledgerEntry: StoredEconomyTransaction = {
      transactionId,
      userId,
      type: 'PURCHASE',
      amount: -GACHA_COST,
      balanceBefore,
      balanceAfter: current.coins,
      reason: `GACHA_PULL_${picked.id.toUpperCase()}`,
      referenceId: picked.id,
      createdAt: nowIso
    };
    memoryStore.ledger.push(ledgerEntry);
    remainingCoins = current.coins;
  }

  const result = {
    success: true,
    rewardId: picked.id,
    item: picked,
    remainingCoins,
    transactionId
  };

  if (idempotencyKey) {
    await setProcessedAction(`gacha_${userId}_${idempotencyKey}`, result);
  }

  return result;
}

export async function executeClaimReward(
  userId: string,
  amount: number,
  reason: string,
  idempotencyKey?: string
): Promise<{
  success: boolean;
  amount: number;
  newBalance: number;
  transactionId: string;
}> {
  assertPersistenceOperational();

  if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency tidak valid.', 'INVALID_IDEMPOTENCY_KEY');
  }

  if (idempotencyKey) {
    const existing = await getProcessedAction(`claim_${userId}_${idempotencyKey}`);
    if (existing) return existing;
  }

  if (typeof amount !== 'number' || amount <= 0 || amount > 1000 || !Number.isFinite(amount)) {
    throw ApiError.badRequest('Jumlah koin reward tidak valid (maksimal 1,000 koin per klaim).', 'INVALID_REWARD_AMOUNT');
  }

  const sanitizedReason = (typeof reason === 'string' && reason.trim())
    ? reason.trim().slice(0, 64)
    : 'QUEST_REWARD';

  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();
  let newBalance = 0;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const ecoRef = db.collection('userEconomy').doc(userId);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);

    await db.runTransaction(async (tx) => {
      const ecoDoc = await tx.get(ecoRef);
      const current: StoredEconomy = ecoDoc.exists
        ? (ecoDoc.data() as StoredEconomy)
        : { userId, coins: 100, totalEarned: 100, totalSpent: 0, lastUpdated: Date.now() };

      const updatedEco: StoredEconomy = {
        userId,
        coins: current.coins + amount,
        totalEarned: current.totalEarned + amount,
        totalSpent: current.totalSpent,
        lastUpdated: Date.now()
      };

      tx.set(ecoRef, updatedEco);

      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: 'QUEST_REWARD',
        amount,
        balanceBefore: current.coins,
        balanceAfter: updatedEco.coins,
        reason: sanitizedReason,
        createdAt: nowIso
      };
      tx.set(ledgerRef, ledgerEntry);

      newBalance = updatedEco.coins;
    });
  } else {
    const current = await getUserEconomy(userId);
    const balanceBefore = current.coins;
    current.coins += amount;
    current.totalEarned += amount;
    current.lastUpdated = Date.now();
    memoryStore.economies.set(userId, current);

    const ledgerEntry: StoredEconomyTransaction = {
      transactionId,
      userId,
      type: 'QUEST_REWARD',
      amount,
      balanceBefore,
      balanceAfter: current.coins,
      reason: sanitizedReason,
      createdAt: nowIso
    };
    memoryStore.ledger.push(ledgerEntry);
    newBalance = current.coins;
  }

  const result = {
    success: true,
    amount,
    newBalance,
    transactionId
  };

  if (idempotencyKey) {
    await setProcessedAction(`claim_${userId}_${idempotencyKey}`, result);
  }

  return result;
}

// ==========================================
// 15. ATOMIC SCORE SUBMISSION & REWARD FLOW
// ==========================================

export interface ScoreSubmissionInput {
  sessionId: string;
  userId: string;
  gameId: string;
  score: number;
  playerName: string;
  playerAvatar: string;
  masteryLevel?: number;
  idempotencyKey?: string;
}

export interface ScoreSubmissionResult {
  success: boolean;
  gameId: CanonicalGameId;
  score: number;
  coinsEarned: number;
  xpEarned: number;
  newCoinBalance: number;
  leaderboards: StoredLeaderboardEntry[];
  transactionId: string;
}

export async function executeScoreSubmission({
  sessionId,
  userId,
  gameId,
  score,
  playerName,
  playerAvatar,
  masteryLevel,
  idempotencyKey
}: ScoreSubmissionInput): Promise<ScoreSubmissionResult> {
  assertPersistenceOperational();

  if (idempotencyKey && !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Format idempotency key tidak valid.', 'INVALID_IDEMPOTENCY_KEY');
  }

  // Check idempotency cache
  if (idempotencyKey) {
    const cached = await getProcessedAction(`score_${userId}_${idempotencyKey}`);
    if (cached) return cached;
  }

  // 1. Validate Game ID
  const canonicalId = requireCanonicalGameId(gameId);
  const config = getGameBalanceConfig(canonicalId);

  // 2. Score ceiling check
  if (score > config.maxScoreCeiling) {
    await recordSuspiciousScore({
      sessionId: sessionId || 'none',
      userId,
      gameId: canonicalId,
      score,
      durationMs: 0,
      velocity: 0,
      reason: `Score ${score} exceeded hard ceiling ${config.maxScoreCeiling}`
    });

    throw ApiError.unprocessable('Skor melebihi batas maksimum wajar yang diizinkan.', 'SCORE_CEILING_EXCEEDED');
  }

  // 3. MANDATORY verified session consumption
  if (!sessionId || typeof sessionId !== 'string') {
    throw ApiError.unprocessable('ID Sesi permainan (sessionId) wajib disertakan untuk submission skor.', 'VERIFIED_SESSION_REQUIRED');
  }

  const consumption = await consumeGameSession(sessionId, userId, canonicalId);
  if (!consumption.valid || !consumption.session) {
    const errorCode = (consumption.reason as any) || 'SESSION_NOT_FOUND';
    throw ApiError.unprocessable('Sesi game tidak valid atau sudah pernah digunakan.', errorCode);
  }

  // Calculate authoritative duration from server session startTime
  const verifiedDurationMs = Date.now() - consumption.session.startTime;
  const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
  const scoreVelocity = score / durationSeconds;

  if (verifiedDurationMs < config.minDurationMs && score > 50) {
    await recordSuspiciousScore({
      sessionId,
      userId,
      gameId: canonicalId,
      score,
      durationMs: verifiedDurationMs,
      velocity: scoreVelocity,
      reason: `Duration ${verifiedDurationMs}ms below min ${config.minDurationMs}ms`
    });

    throw ApiError.unprocessable('Durasi permainan terlalu singkat untuk skor ini.', 'INSUFFICIENT_DURATION');
  }

  if (score > 100 && scoreVelocity > config.maxScorePerSec) {
    await recordSuspiciousScore({
      sessionId,
      userId,
      gameId: canonicalId,
      score,
      durationMs: verifiedDurationMs,
      velocity: scoreVelocity,
      reason: `Velocity ${scoreVelocity.toFixed(1)}/s exceeded limit ${config.maxScorePerSec}/s`
    });

    throw ApiError.unprocessable('Laju perolehan skor melebihi batas wajar.', 'SCORE_CEILING_EXCEEDED');
  }

  // Authoritative reward calculation
  const coinsEarned = Math.max(1, Math.min(250, Math.floor(score * config.baseCoinMultiplier)));
  const xpEarned = Math.max(5, Math.min(500, Math.floor(score * config.baseXpMultiplier)));
  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();

  let newCoinBalance = 0;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const ecoRef = db.collection('userEconomy').doc(userId);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);
    const leaderRef = db.collection('leaderboards').doc(canonicalId).collection('entries').doc(userId);

    await db.runTransaction(async (tx) => {
      const ecoDoc = await tx.get(ecoRef);
      const current: StoredEconomy = ecoDoc.exists
        ? (ecoDoc.data() as StoredEconomy)
        : { userId, coins: 100, totalEarned: 100, totalSpent: 0, lastUpdated: Date.now() };

      const updatedEco: StoredEconomy = {
        userId,
        coins: current.coins + coinsEarned,
        totalEarned: current.totalEarned + coinsEarned,
        totalSpent: current.totalSpent,
        lastUpdated: Date.now()
      };
      newCoinBalance = updatedEco.coins;

      tx.set(ecoRef, updatedEco);

      // Record transaction ledger
      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: 'GAME_REWARD',
        amount: coinsEarned,
        balanceBefore: current.coins,
        balanceAfter: updatedEco.coins,
        reason: `GAME_REWARD_${canonicalId.toUpperCase()}`,
        referenceId: sessionId,
        createdAt: nowIso
      };
      tx.set(ledgerRef, ledgerEntry);

      // Save leaderboard high score
      const leaderDoc = await tx.get(leaderRef);
      if (!leaderDoc.exists || score > (leaderDoc.data()?.score || 0)) {
        tx.set(leaderRef, {
          userId,
          playerName,
          playerAvatar,
          score,
          submittedAt: nowIso,
          gameId: canonicalId,
          masteryLevel: masteryLevel || 1
        });
      }
    });
  } else {
    const eco = await getUserEconomy(userId);
    const balanceBefore = eco.coins;
    eco.coins += coinsEarned;
    eco.totalEarned += coinsEarned;
    eco.lastUpdated = Date.now();
    memoryStore.economies.set(userId, eco);
    newCoinBalance = eco.coins;

    const ledgerEntry: StoredEconomyTransaction = {
      transactionId,
      userId,
      type: 'GAME_REWARD',
      amount: coinsEarned,
      balanceBefore,
      balanceAfter: eco.coins,
      reason: `GAME_REWARD_${canonicalId.toUpperCase()}`,
      referenceId: sessionId,
      createdAt: nowIso
    };
    memoryStore.ledger.push(ledgerEntry);

    // Save leaderboard entry in memory
    const list = memoryStore.leaderboards.get(canonicalId) || [];
    const idx = list.findIndex(e => e.userId === userId);
    if (idx >= 0) {
      if (score > list[idx].score) {
        list[idx] = { userId, playerName, playerAvatar, score, submittedAt: nowIso, gameId: canonicalId, masteryLevel };
      }
    } else {
      list.push({ userId, playerName, playerAvatar, score, submittedAt: nowIso, gameId: canonicalId, masteryLevel });
    }
    list.sort((a, b) => b.score - a.score);
    memoryStore.leaderboards.set(canonicalId, list);
  }

  const leaderboards = await getLeaderboardEntries(canonicalId);

  const result: ScoreSubmissionResult = {
    success: true,
    gameId: canonicalId,
    score,
    coinsEarned,
    xpEarned,
    newCoinBalance,
    leaderboards,
    transactionId
  };

  if (idempotencyKey) {
    await setProcessedAction(`score_${userId}_${idempotencyKey}`, result);
  }

  return result;
}

// ==========================================
// LEADERBOARD
// ==========================================

export async function getLeaderboardEntries(gameId: string, limit = 50): Promise<StoredLeaderboardEntry[]> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snapshot = await db.collection('leaderboards')
      .doc(canonicalId)
      .collection('entries')
      .orderBy('score', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(d => d.data() as StoredLeaderboardEntry);
  } else {
    const list = memoryStore.leaderboards.get(canonicalId) || [];
    return list.slice(0, limit);
  }
}

// ==========================================
// AUDITING & SUSPICIOUS SCORES
// ==========================================

export async function recordSuspiciousScore(entry: Omit<StoredSuspiciousScore, 'id' | 'timestamp'>) {
  const fullEntry: StoredSuspiciousScore = {
    ...entry,
    id: `sus_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    timestamp: new Date().toISOString()
  };

  serverLogger.security(
    'SUSPICIOUS_SCORE',
    `Suspicious score logged: ${entry.score} on ${entry.gameId} (${entry.reason})`,
    fullEntry,
    entry.userId
  );

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('suspiciousScores').doc(fullEntry.id).set(fullEntry);
  } else {
    memoryStore.suspiciousScores.push(fullEntry);
  }
}

export async function getSuspiciousScores(): Promise<StoredSuspiciousScore[]> {
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snapshot = await db.collection('suspiciousScores').orderBy('timestamp', 'desc').limit(100).get();
    return snapshot.docs.map(d => d.data() as StoredSuspiciousScore);
  } else {
    return memoryStore.suspiciousScores;
  }
}

export async function purgeSuspectScores(gameId?: string): Promise<{ purgedCount: number }> {
  assertPersistenceOperational();
  let count = 0;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snapshot = await db.collection('suspiciousScores').get();
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!gameId || data.gameId === gameId) {
        batch.delete(doc.ref);
        count++;
      }
    });

    await batch.commit();
  } else {
    if (gameId) {
      const initial = memoryStore.suspiciousScores.length;
      memoryStore.suspiciousScores = memoryStore.suspiciousScores.filter(s => s.gameId !== gameId);
      count = initial - memoryStore.suspiciousScores.length;
    } else {
      count = memoryStore.suspiciousScores.length;
      memoryStore.suspiciousScores = [];
    }
  }

  return { purgedCount: count };
}

// ==========================================
// REAL ADMIN STATS & LEDGER AGGREGATES
// ==========================================

export async function getRealAdminStats(): Promise<{
  success: boolean;
  suspiciousScoresCount: number;
  recentSuspicious: StoredSuspiciousScore[];
  totalLedgerTransactions: number;
  activeSessionsCount: number;
  serverTime: string;
}> {
  assertPersistenceOperational();
  const suspicious = await getSuspiciousScores();

  let totalLedgerTransactions = 0;
  let activeSessionsCount = 0;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const ledgerSnap = await db.collection('economyTransactions').count().get();
    totalLedgerTransactions = ledgerSnap.data().count;

    const sessionsSnap = await db.collection('gameSessions').where('consumed', '==', false).count().get();
    activeSessionsCount = sessionsSnap.data().count;
  } else {
    totalLedgerTransactions = memoryStore.ledger.length;
    for (const session of memoryStore.sessions.values()) {
      if (!session.consumed && Date.now() < session.expiresAt) {
        activeSessionsCount++;
      }
    }
  }

  return {
    success: true,
    suspiciousScoresCount: suspicious.length,
    recentSuspicious: suspicious.slice(0, 10),
    totalLedgerTransactions,
    activeSessionsCount,
    serverTime: new Date().toISOString()
  };
}

// ==========================================
// IDEMPOTENCY
// ==========================================

export async function getProcessedAction(key: string): Promise<any | null> {
  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('processedActions').doc(key).get();
    return doc.exists ? doc.data()?.result : null;
  } else {
    const item = memoryStore.processedActions.get(key);
    return item ? item.result : null;
  }
}

export async function setProcessedAction(key: string, result: any): Promise<void> {
  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('processedActions').doc(key).set({
      result,
      timestamp: Date.now()
    });
  } else {
    memoryStore.processedActions.set(key, { result, timestamp: Date.now() });
  }
}
