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
import { resolveAuthoritativeReward, RewardClaimType, AUTHORITATIVE_SEASONAL_CHALLENGES } from '../config/rewardCatalog';
import { CANONICAL_GAME_REGISTRY } from '../config/gameRegistry';
import { 
  getTierForRating, 
  INITIAL_RATING, 
  PLACEMENT_MATCHES_COUNT, 
  GAME_COMPETITIVE_CONFIGS,
  RANKED_GAME_ALLOWLIST
} from '../config/competitiveConfig';

export const SESSION_MAX_LIFETIME_MS = 60 * 60 * 1000; // 1 hour max session lifetime

export interface StoredGameHistoryEntry {
  historyId: string;
  userId: string;
  sessionId: string;
  gameId: CanonicalGameId;
  genre: string;
  score: number;
  isPersonalBest: boolean;
  timestamp: number;
  dateStr: string; // YYYY-MM-DD
  weekStr: string; // YYYY-Www
  seasonId: string;
}

export function getUtcDateString(timestamp: number = Date.now()): string {
  return new Date(timestamp).toISOString().split('T')[0];
}

export function getIsoWeekString(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekFormatted = weekNo < 10 ? `0${weekNo}` : `${weekNo}`;
  return `${date.getUTCFullYear()}-W${weekFormatted}`;
}

export interface StoredGameSession {
  sessionId: string;
  userId: string;
  gameId: CanonicalGameId;
  nonce: string;
  startTime: number;
  expiresAt: number;
  consumed: boolean;
  consumedAt?: number;
  isRanked?: boolean;
  seasonId?: string;
  gameVersion?: string;
  balanceVersion?: string;
  rulesetVersion?: string;
  createdAt?: number;
}

export interface StoredCompetitiveProfile {
  userId: string;
  globalRating: number;
  globalTier: string;
  peakGlobalRating: number;
  gameRatings: Record<string, {
    rating: number;
    tier: string;
    matchesPlayed: number;
    wins: number;
    losses: number;
    lastUpdated: number;
  }>;
  rankedGames: number;
  lastUpdated: number;
  seasonId: string;
}

export interface StoredSeason {
  seasonId: string;
  name: string;
  startAt: number;
  endAt: number;
  status: 'active' | 'finished';
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
  rating?: number;
  tier?: string;
  rank?: number;
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

export interface StoredUserProgression {
  userId: string;
  totalXp: number;
  level: number;
  lastUpdated: number;
}

export function getXpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  let totalXp = 0;
  for (let i = 1; i < level; i++) {
    if (i < 10) totalXp += i * 150;
    else if (i < 30) totalXp += 1350 + (i - 9) * 300;
    else totalXp += 7350 + (i - 29) * 600;
  }
  return totalXp;
}

export function calculateLevelFromXp(totalXp: number): number {
  let level = 1;
  while (true) {
    const nextLevelXp = getXpRequiredForLevel(level + 1);
    if (totalXp >= nextLevelXp) {
      level++;
    } else {
      return level;
    }
  }
}

// In-Memory store for testing and standalone local execution
class InMemoryStore {
  sessions = new Map<string, StoredGameSession>();
  economies = new Map<string, StoredEconomy>();
  userProgression = new Map<string, StoredUserProgression>();
  inventory = new Map<string, Set<string>>(); // userId -> set of owned itemIds
  spins = new Map<string, { lastSpinDate: string; count: number; updatedAt: number }>();
  leaderboards = new Map<string, StoredLeaderboardEntry[]>();
  rankedLeaderboards = new Map<string, StoredLeaderboardEntry[]>();
  seasonalLeaderboards = new Map<string, Map<string, StoredLeaderboardEntry[]>>(); // seasonId -> gameId -> entries
  competitiveProfiles = new Map<string, StoredCompetitiveProfile>();
  processedActions = new Map<string, { result: any; timestamp: number }>();
  suspiciousScores: StoredSuspiciousScore[] = [];
  ledger: StoredEconomyTransaction[] = [];
  claimedRewards = new Map<string, Set<string>>(); // userId -> Set of claimIds
  gameHistory: StoredGameHistoryEntry[] = [];

  clear() {
    this.sessions.clear();
    this.economies.clear();
    this.userProgression.clear();
    this.inventory.clear();
    this.spins.clear();
    this.leaderboards.clear();
    this.rankedLeaderboards.clear();
    this.seasonalLeaderboards.clear();
    this.competitiveProfiles.clear();
    this.processedActions.clear();
    this.suspiciousScores = [];
    this.ledger = [];
    this.claimedRewards.clear();
    this.gameHistory = [];
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

export async function getUserProgression(userId: string): Promise<StoredUserProgression> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('userProgression').doc(userId).get();
    if (doc.exists) {
      return doc.data() as StoredUserProgression;
    }
    const initial: StoredUserProgression = {
      userId,
      totalXp: 0,
      level: 1,
      lastUpdated: Date.now()
    };
    await db.collection('userProgression').doc(userId).set(initial);
    return initial;
  } else {
    let prog = memoryStore.userProgression.get(userId);
    if (!prog) {
      prog = {
        userId,
        totalXp: 0,
        level: 1,
        lastUpdated: Date.now()
      };
      memoryStore.userProgression.set(userId, prog);
    }
    return prog;
  }
}

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

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency valid wajib disertakan untuk taruhan.', 'INVALID_IDEMPOTENCY_KEY');
  }

  const existing = await getProcessedAction(`gamble_${userId}_${idempotencyKey}`);
  if (existing) return existing;

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

export const CANONICAL_ACHIEVEMENT_TARGETS: Record<string, { gameId: string; target: number }> = {
  snake_glutton: { gameId: 'snake', target: 20 },
  snake_turbo: { gameId: 'snake', target: 40 },
  brick_demolisher: { gameId: 'brick-breaker', target: 150 },
  flappy_pilot: { gameId: 'flappy-pixel', target: 10 },
  flappy_god: { gameId: 'flappy-pixel', target: 25 },
  space_champion: { gameId: 'space-defender', target: 150 },
  space_god: { gameId: 'space-defender', target: 500 },
  memory_master: { gameId: 'memory-grid', target: 100 },
  memory_god: { gameId: 'memory-grid', target: 300 },
  runner_speed: { gameId: 'cyber-runner', target: 80 },
  racer_apex: { gameId: 'vaporwave-racer', target: 100 },
  tetris_grandmaster: { gameId: 'cyber-tetris', target: 150 },
  mines_sweeper: { gameId: 'cyber-mines', target: 90 },
  neon_2048_master: { gameId: 'neon-2048', target: 200 }
};

export async function getUserVerifiedAchievementsCount(userId: string): Promise<number> {
  let count = 0;
  for (const [_, req] of Object.entries(CANONICAL_ACHIEVEMENT_TARGETS)) {
    const score = await getUserHighScore(userId, req.gameId);
    if (score >= req.target) {
      count++;
    }
  }
  return count;
}

export async function getUserCumulativeScore(userId: string): Promise<number> {
  const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
  let total = 0;
  for (const g of games) {
    const score = await getUserHighScore(userId, g);
    total += score;
  }
  return total;
}

export async function getUserHighScore(userId: string, gameId: string): Promise<number> {
  const canonicalId = requireCanonicalGameId(gameId);
  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('leaderboards')
      .doc(canonicalId)
      .collection('entries')
      .doc(userId)
      .get();
    if (doc.exists) {
      return (doc.data() as StoredLeaderboardEntry).score || 0;
    }
  } else {
    const list = memoryStore.leaderboards.get(canonicalId) || [];
    const entry = list.find(e => e.userId === userId);
    if (entry) return entry.score;
  }
  return 0;
}

export async function hasAnyHighScore(userId: string): Promise<boolean> {
  const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
  for (const g of games) {
    const score = await getUserHighScore(userId, g);
    if (score > 0) return true;
  }
  return false;
}

export async function hasHighScoreOfAtLeast(userId: string, threshold: number): Promise<boolean> {
  const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
  for (const g of games) {
    const score = await getUserHighScore(userId, g);
    if (score >= threshold) return true;
  }
  return false;
}

export async function getCountOfGamesPlayedToday(userId: string): Promise<number> {
  const todayPrefix = new Date().toISOString().split('T')[0];
  const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
  let count = 0;
  for (const g of games) {
    const canonical = requireCanonicalGameId(g);
    if (isFirestoreAvailable()) {
      const db = getDb();
      const doc = await db.collection('leaderboards')
        .doc(canonical)
        .collection('entries')
        .doc(userId)
        .get();
      if (doc.exists) {
        const data = doc.data() as StoredLeaderboardEntry;
        if (data.submittedAt && data.submittedAt.startsWith(todayPrefix)) {
          count++;
        }
      }
    } else {
      const list = memoryStore.leaderboards.get(canonical) || [];
      const entry = list.find(e => e.userId === userId);
      if (entry && entry.submittedAt && entry.submittedAt.startsWith(todayPrefix)) {
        count++;
      }
    }
  }
  return count;
}

export async function getUserGameHistory(userId: string): Promise<StoredGameHistoryEntry[]> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('userGameHistory').where('userId', '==', userId).get();
    return snap.docs.map(doc => doc.data() as StoredGameHistoryEntry);
  } else {
    return memoryStore.gameHistory.filter(h => h.userId === userId);
  }
}

export async function getDailySessionHistory(userId: string, dateStr: string): Promise<StoredGameHistoryEntry[]> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('userGameHistory')
      .where('userId', '==', userId)
      .where('dateStr', '==', dateStr)
      .get();
    return snap.docs.map(doc => doc.data() as StoredGameHistoryEntry);
  } else {
    return memoryStore.gameHistory.filter(h => h.userId === userId && h.dateStr === dateStr);
  }
}

export async function getWeeklySessionHistory(userId: string, weekStr: string): Promise<StoredGameHistoryEntry[]> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('userGameHistory')
      .where('userId', '==', userId)
      .where('weekStr', '==', weekStr)
      .get();
    return snap.docs.map(doc => doc.data() as StoredGameHistoryEntry);
  } else {
    return memoryStore.gameHistory.filter(h => h.userId === userId && h.weekStr === weekStr);
  }
}

export async function executeClaimReward(
  userId: string,
  claimId: string,
  claimType: RewardClaimType = 'achievement',
  idempotencyKey?: string,
  details?: Record<string, unknown>
): Promise<{
  success: boolean;
  claimId: string;
  amount: number;
  xp: number;
  newBalance: number;
  transactionId: string;
}> {
  assertPersistenceOperational();

  if (!claimId || typeof claimId !== 'string') {
    throw ApiError.badRequest('ID klaim reward (claimId) wajib diisi.', 'INVALID_REWARD_CLAIM');
  }

  const validTypes: RewardClaimType[] = ['achievement', 'daily_mission', 'challenge', 'quest_tier', 'starter_pack', 'level_up'];
  if (!validTypes.includes(claimType)) {
    throw ApiError.badRequest('Jenis reward claim tidak valid.', 'INVALID_CLAIM_SOURCE');
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Kunci idempotency valid wajib disertakan untuk klaim reward.', 'INVALID_IDEMPOTENCY_KEY');
  }

  // Check idempotency cache first
  const existing = await getProcessedAction(`claim_${userId}_${idempotencyKey}`);
  if (existing) return existing;

  // Resolve target number (for level_up or quest_tier)
  let targetNum: number | undefined;
  if (claimType === 'level_up') {
    targetNum = typeof details?.level === 'number' ? details.level : parseInt(claimId.replace(/\D/g, ''), 10);
    if (!targetNum || isNaN(targetNum) || targetNum < 2 || targetNum > 100) {
      throw ApiError.badRequest('Level klaim tidak valid (harus antara level 2 - 100).', 'INVALID_LEVEL');
    }
  } else if (claimType === 'quest_tier') {
    targetNum = typeof details?.tier === 'number' ? details.tier : parseInt(claimId.replace(/\D/g, ''), 10);
    if (!targetNum || isNaN(targetNum) || targetNum < 1 || targetNum > 10) {
      throw ApiError.badRequest('Quest tier tidak valid (harus antara tier 1 - 10).', 'INVALID_QUEST_TIER');
    }
  }

  // Lookup authoritative reward definition on the server
  const definition = resolveAuthoritativeReward(claimId, claimType, targetNum);
  if (!definition) {
    throw ApiError.badRequest('Definisi reward tidak ditemukan atau tidak valid.', 'INVALID_REWARD_CLAIM');
  }

  const canonicalClaimId = definition.canonicalId;

  // Server-side authoritative verification of completed requirements
  // NO test/substring bypasses! Every check verifies authoritative server records.
  let verified = false;

  if (claimType === 'starter_pack') {
    // Starter pack is available to all users once
    verified = true;
  } else if (claimType === 'achievement') {
    if (claimId in CANONICAL_ACHIEVEMENT_TARGETS) {
      const req = CANONICAL_ACHIEVEMENT_TARGETS[claimId];
      const highScore = await getUserHighScore(userId, req.gameId);
      if (highScore >= req.target) {
        verified = true;
      }
    } else if (claimId === 'ach_first_win') {
      const anyScore = await hasAnyHighScore(userId);
      if (anyScore) verified = true;
    } else if (claimId === 'ach_score_500') {
      const highEnough = await hasHighScoreOfAtLeast(userId, 500);
      if (highEnough) verified = true;
    }
  } else if (claimType === 'level_up') {
    const targetLevel = targetNum || 2;
    const prog = await getUserProgression(userId);
    if (prog.level >= targetLevel) {
      verified = true;
    }
  } else if (claimType === 'quest_tier') {
    const targetTier = targetNum || 1;
    const verifiedAchCount = await getUserVerifiedAchievementsCount(userId);
    const anyScore = await hasAnyHighScore(userId);
    if (targetTier === 1 && anyScore) {
      verified = true;
    } else if (targetTier > 1 && verifiedAchCount >= targetTier - 1) {
      verified = true;
    }
  } else if (claimType === 'daily_mission') {
    const match = canonicalClaimId.match(/^m_(\d{4}-\d{2}-\d{2})_([123])$/);
    if (match) {
      const dateStr = match[1];
      const index = match[2];
      const dailySessions = await getDailySessionHistory(userId, dateStr);
      const countPlayedToday = await getCountOfGamesPlayedToday(userId);

      if (index === '1') {
        const dateObj = new Date(dateStr);
        const seed = isNaN(dateObj.getDate()) ? 1 : dateObj.getDate();
        const games = ['snake', 'brick-breaker', 'flappy-pixel', 'space-defender', 'memory-grid', 'cyber-runner', 'vaporwave-racer', 'cyber-tetris', 'cyber-mines', 'neon-2048'];
        const gameIdx = seed % games.length;
        const selectedGame = games[gameIdx];
        const target = 50 + (seed % 3) * 50;

        const highScore = await getUserHighScore(userId, selectedGame);
        const sessionHigh = dailySessions.some(s => s.gameId === selectedGame && s.score >= target);
        if (sessionHigh || highScore >= target) {
          verified = true;
        }
      } else if (index === '2') {
        const hasPb = dailySessions.some(s => s.isPersonalBest);
        const distinctGenres = new Set(dailySessions.map(s => s.genre)).size;
        if (hasPb || distinctGenres >= 2 || countPlayedToday >= 2) {
          verified = true;
        }
      } else if (index === '3') {
        if (dailySessions.length >= 3 || countPlayedToday >= 3) {
          verified = true;
        }
      }
    }
  } else if (claimType === 'challenge') {
    const dailyMatch = canonicalClaimId.match(/^daily_(\d{4}-\d{2}-\d{2})_([123])$/);
    const weeklyMatch = canonicalClaimId.match(/^weekly_(\d{4}-W\d{2})_([123])$/);

    if (dailyMatch) {
      const dateStr = dailyMatch[1];
      const index = dailyMatch[2];
      const dailySessions = await getDailySessionHistory(userId, dateStr);
      const countPlayedToday = await getCountOfGamesPlayedToday(userId);

      if (index === '1') {
        if (dailySessions.some(s => s.score >= 50) || countPlayedToday >= 1) {
          verified = true;
        }
      } else if (index === '2') {
        const distinctGenres = new Set(dailySessions.map(s => s.genre)).size;
        if (distinctGenres >= 2 || dailySessions.length >= 2 || countPlayedToday >= 2) {
          verified = true;
        }
      } else if (index === '3') {
        if (dailySessions.length >= 3 || countPlayedToday >= 3) {
          verified = true;
        }
      }
    } else if (weeklyMatch) {
      const weekStr = weeklyMatch[1];
      const index = weeklyMatch[2];
      const weeklySessions = await getWeeklySessionHistory(userId, weekStr);
      const achCount = await getUserVerifiedAchievementsCount(userId);
      const countPlayedToday = await getCountOfGamesPlayedToday(userId);
      const cumScore = await getUserCumulativeScore(userId);

      if (index === '1') {
        const pbCount = weeklySessions.filter(s => s.isPersonalBest).length;
        if (pbCount >= 2 || achCount >= 2) {
          verified = true;
        }
      } else if (index === '2') {
        if (weeklySessions.length >= 5 || countPlayedToday >= 3) {
          verified = true;
        }
      } else if (index === '3') {
        const weeklySum = weeklySessions.reduce((acc, s) => acc + s.score, 0);
        if (weeklySum >= 500 || cumScore >= 1000) {
          verified = true;
        }
      }
    } else if (canonicalClaimId in AUTHORITATIVE_SEASONAL_CHALLENGES) {
      const history = await getUserGameHistory(userId);
      const comp = await getCompetitiveProfile(userId);
      const hasScore = await hasAnyHighScore(userId);
      if (history.length >= 3 || comp.rankedGames >= 1 || hasScore) {
        verified = true;
      }
    }
  }

  if (!verified) {
    throw ApiError.badRequest('Persyaratan klaim reward belum terpenuhi berdasarkan verifikasi server.', 'REWARD_REQUIREMENTS_NOT_MET');
  }

  const amount = definition.rewardCoins;
  const xp = definition.rewardXp;
  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();
  let newBalance = 0;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const ecoRef = db.collection('userEconomy').doc(userId);
    const progRef = db.collection('userProgression').doc(userId);
    const claimRef = db.collection('userClaimedRewards').doc(`${userId}_${canonicalClaimId}`);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);

    await db.runTransaction(async (tx) => {
      const claimDoc = await tx.get(claimRef);
      if (claimDoc.exists) {
        throw new ApiError(400, 'REWARD_ALREADY_CLAIMED', 'Reward ini sudah pernah Anda klaim sebelumnya.');
      }

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

      if (xp > 0) {
        const progDoc = await tx.get(progRef);
        const currentProg: StoredUserProgression = progDoc.exists
          ? (progDoc.data() as StoredUserProgression)
          : { userId, totalXp: 0, level: 1, lastUpdated: Date.now() };

        const newTotalXp = currentProg.totalXp + xp;
        const updatedProg: StoredUserProgression = {
          userId,
          totalXp: newTotalXp,
          level: calculateLevelFromXp(newTotalXp),
          lastUpdated: Date.now()
        };
        tx.set(progRef, updatedProg);
      }

      tx.set(claimRef, {
        userId,
        claimId: canonicalClaimId,
        originalClaimId: claimId,
        claimType,
        amount,
        xp,
        claimedAt: nowIso
      });

      const ledgerEntry: StoredEconomyTransaction = {
        transactionId,
        userId,
        type: 'QUEST_REWARD',
        amount,
        balanceBefore: current.coins,
        balanceAfter: updatedEco.coins,
        reason: `REWARD_${claimType.toUpperCase()}_${canonicalClaimId}`,
        referenceId: canonicalClaimId,
        createdAt: nowIso
      };
      tx.set(ledgerRef, ledgerEntry);

      newBalance = updatedEco.coins;
    });
  } else {
    const userClaims = memoryStore.claimedRewards.get(userId) || new Set<string>();
    if (userClaims.has(canonicalClaimId)) {
      throw new ApiError(400, 'REWARD_ALREADY_CLAIMED', 'Reward ini sudah pernah Anda klaim sebelumnya.');
    }

    const current = await getUserEconomy(userId);
    const balanceBefore = current.coins;
    current.coins += amount;
    current.totalEarned += amount;
    current.lastUpdated = Date.now();
    memoryStore.economies.set(userId, current);

    if (xp > 0) {
      let prog = memoryStore.userProgression.get(userId) || { userId, totalXp: 0, level: 1, lastUpdated: Date.now() };
      const newTotalXp = prog.totalXp + xp;
      prog = {
        userId,
        totalXp: newTotalXp,
        level: calculateLevelFromXp(newTotalXp),
        lastUpdated: Date.now()
      };
      memoryStore.userProgression.set(userId, prog);
    }

    userClaims.add(canonicalClaimId);
    memoryStore.claimedRewards.set(userId, userClaims);

    const ledgerEntry: StoredEconomyTransaction = {
      transactionId,
      userId,
      type: 'QUEST_REWARD',
      amount,
      balanceBefore,
      balanceAfter: current.coins,
      reason: `REWARD_${claimType.toUpperCase()}_${canonicalClaimId}`,
      referenceId: canonicalClaimId,
      createdAt: nowIso
    };
    memoryStore.ledger.push(ledgerEntry);
    newBalance = current.coins;
  }

  const result = {
    success: true,
    claimId: canonicalClaimId,
    amount,
    xp,
    newBalance,
    transactionId
  };

  await setProcessedAction(`claim_${userId}_${idempotencyKey}`, result);
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

  if (!idempotencyKey || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Idempotency key wajib disertakan.', 'INVALID_IDEMPOTENCY_KEY');
  }

  const canonicalId = requireCanonicalGameId(gameId);
  const config = getGameBalanceConfig(canonicalId);
  const idempotencyId = `score_${userId}_${idempotencyKey}`;
  const transactionId = `tx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const genre = CANONICAL_GAME_REGISTRY[canonicalId]?.genre || 'Arcade';

  if (isFirestoreAvailable()) {
    const db = getDb();
    const idemRef = db.collection('processedActions').doc(idempotencyId);
    const sessionRef = db.collection('gameSessions').doc(sessionId);
    const ecoRef = db.collection('userEconomy').doc(userId);
    const ledgerRef = db.collection('economyTransactions').doc(transactionId);
    const leaderRef = db.collection('leaderboards').doc(canonicalId).collection('entries').doc(userId);
    const historyId = `hist_${nowMs}_${crypto.randomBytes(6).toString('hex')}`;
    const historyRef = db.collection('userGameHistory').doc(historyId);
    const progRef = db.collection('userProgression').doc(userId);

    let antiCheatError: { reason: string; duration: number; velocity: number } | null = null;
    let finalResult: ScoreSubmissionResult | null = null;

    try {
      await db.runTransaction(async (tx) => {
        // 1. Idempotency Check
        const idemDoc = await tx.get(idemRef);
        if (idemDoc.exists) {
          finalResult = (idemDoc.data() as any).result as ScoreSubmissionResult;
          return; // Already processed
        }

        // 2. Verified Session Required
        if (!sessionId) {
          throw ApiError.unprocessable('ID Sesi wajib disertakan.', 'VERIFIED_SESSION_REQUIRED');
        }

        const sessionDoc = await tx.get(sessionRef);
        if (!sessionDoc.exists) throw ApiError.unprocessable('Sesi tidak ditemukan.', 'SESSION_NOT_FOUND');
        const session = sessionDoc.data() as StoredGameSession;

        if (session.userId !== userId) throw ApiError.unprocessable('Sesi bukan milik Anda.', 'SESSION_USER_MISMATCH');
        if (session.gameId !== canonicalId) throw ApiError.unprocessable('Sesi game tidak cocok.', 'SESSION_GAME_MISMATCH');
        if (session.consumed) throw ApiError.unprocessable('Sesi sudah digunakan.', 'SESSION_ALREADY_CONSUMED');
        if (nowMs > session.expiresAt) throw ApiError.unprocessable('Sesi kedaluwarsa.', 'SESSION_EXPIRED');

        // 3. Anti-Cheat & Duration Validation
        const verifiedDurationMs = nowMs - session.startTime;
        const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
        const scoreVelocity = score / durationSeconds;

        if (score > config.maxScoreCeiling) {
          antiCheatError = { reason: `Score ${score} exceeded hard ceiling ${config.maxScoreCeiling}`, duration: 0, velocity: 0 };
          throw ApiError.unprocessable('Skor melebihi batas maksimum.', 'SCORE_CEILING_EXCEEDED');
        }
        if (score > 0 && verifiedDurationMs < config.minDurationMs) {
          antiCheatError = { reason: `Duration ${verifiedDurationMs}ms below min ${config.minDurationMs}ms`, duration: verifiedDurationMs, velocity: scoreVelocity };
          throw ApiError.unprocessable('Durasi permainan terlalu singkat.', 'INSUFFICIENT_DURATION');
        }
        if (score > 50 && scoreVelocity > config.maxScorePerSec) {
          antiCheatError = { reason: `Velocity ${scoreVelocity.toFixed(1)}/s exceeded limit ${config.maxScorePerSec}/s`, duration: verifiedDurationMs, velocity: scoreVelocity };
          throw ApiError.unprocessable('Laju perolehan skor melebihi batas wajar.', 'SCORE_CEILING_EXCEEDED');
        }

        // 4. Rewards Calculation
        const isEligibleForReward = score > 0 && verifiedDurationMs >= config.minDurationMs;
        const coinsEarned = isEligibleForReward ? Math.min(250, Math.floor(score * config.baseCoinMultiplier)) : 0;
        const xpEarned = isEligibleForReward ? Math.min(500, Math.floor(score * config.baseXpMultiplier)) : 0;

        // 5. Leaderboard Update
        const leaderDoc = await tx.get(leaderRef);
        const prevPb = leaderDoc.exists ? (leaderDoc.data()?.score || 0) : 0;
        const isPersonalBest = score > prevPb;

        if (isPersonalBest || !leaderDoc.exists) {
          tx.set(leaderRef, {
            userId,
            playerName: playerName.slice(0, 32),
            playerAvatar: playerAvatar.slice(0, 16),
            score,
            submittedAt: nowIso,
            gameId: canonicalId,
            masteryLevel: masteryLevel || 1
          });
        }

        // 6. Session Consumption
        tx.update(sessionRef, { consumed: true, consumedAt: nowMs });

        // 7. Insert History
        tx.set(historyRef, {
          historyId, userId, sessionId, gameId: canonicalId, genre, score, isPersonalBest, timestamp: nowMs, dateStr: getUtcDateString(nowMs), weekStr: getIsoWeekString(nowMs), seasonId: 'season_1'
        });

        // 8. Economy
        const ecoDoc = await tx.get(ecoRef);
        const currentEco = ecoDoc.exists ? (ecoDoc.data() as StoredEconomy) : { userId, coins: 100, totalEarned: 100, totalSpent: 0, lastUpdated: nowMs };
        
        let newCoinBalance = currentEco.coins;
        if (coinsEarned > 0) {
          const updatedEco = { ...currentEco, coins: currentEco.coins + coinsEarned, totalEarned: currentEco.totalEarned + coinsEarned, lastUpdated: nowMs };
          newCoinBalance = updatedEco.coins;
          tx.set(ecoRef, updatedEco);
          tx.set(ledgerRef, {
            transactionId, userId, type: 'GAME_REWARD', amount: coinsEarned, balanceBefore: currentEco.coins, balanceAfter: updatedEco.coins, reason: `GAME_REWARD_${canonicalId.toUpperCase()}`, referenceId: sessionId, createdAt: nowIso
          });
        }

        // 9. Progression
        if (xpEarned > 0) {
          const progDoc = await tx.get(progRef);
          const currentProg = progDoc.exists ? (progDoc.data() as StoredUserProgression) : { userId, totalXp: 0, level: 1, lastUpdated: nowMs };
          const newTotalXp = currentProg.totalXp + xpEarned;
          tx.set(progRef, { userId, totalXp: newTotalXp, level: calculateLevelFromXp(newTotalXp), lastUpdated: nowMs });
        }

        // 10. Save result & Idempotency
        const result: ScoreSubmissionResult = { success: true, gameId: canonicalId, score, coinsEarned, xpEarned, newCoinBalance, leaderboards: [], transactionId };
        tx.set(idemRef, { actionId: idempotencyId, userId, result, processedAt: nowIso });
        
        finalResult = result;
      });
    } catch (err) {
      if (antiCheatError) {
        await recordSuspiciousScore({
          sessionId: sessionId || 'none',
          userId,
          gameId: canonicalId,
          score,
          durationMs: antiCheatError.duration,
          velocity: antiCheatError.velocity,
          reason: antiCheatError.reason
        });
      }
      throw err;
    }

    if (finalResult) {
       finalResult.leaderboards = await getLeaderboardEntries(canonicalId);
    }
    return finalResult!;
  } else {
    // Memory Fallback
    const cached = await getProcessedAction(idempotencyId);
    if (cached) return cached.result as ScoreSubmissionResult;

    if (!sessionId) throw ApiError.unprocessable('ID Sesi wajib disertakan.', 'VERIFIED_SESSION_REQUIRED');
    const session = memoryStore.sessions.get(sessionId);
    if (!session) throw ApiError.unprocessable('Sesi tidak ditemukan.', 'SESSION_NOT_FOUND');
    if (session.userId !== userId) throw ApiError.unprocessable('Sesi bukan milik Anda.', 'SESSION_USER_MISMATCH');
    if (session.gameId !== canonicalId) throw ApiError.unprocessable('Sesi game tidak cocok.', 'SESSION_GAME_MISMATCH');
    if (session.consumed) throw ApiError.unprocessable('Sesi sudah digunakan.', 'SESSION_ALREADY_CONSUMED');
    if (nowMs > session.expiresAt) throw ApiError.unprocessable('Sesi kedaluwarsa.', 'SESSION_EXPIRED');

    const verifiedDurationMs = nowMs - session.startTime;
    const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
    const scoreVelocity = score / durationSeconds;

    if (score > config.maxScoreCeiling) {
      await recordSuspiciousScore({ sessionId, userId, gameId: canonicalId, score, durationMs: 0, velocity: 0, reason: `Score exceeded ceiling` });
      throw ApiError.unprocessable('Skor melebihi batas maksimum.', 'SCORE_CEILING_EXCEEDED');
    }
    if (score > 0 && verifiedDurationMs < config.minDurationMs) {
      await recordSuspiciousScore({ sessionId, userId, gameId: canonicalId, score, durationMs: verifiedDurationMs, velocity: scoreVelocity, reason: `Duration too short` });
      throw ApiError.unprocessable('Durasi permainan terlalu singkat.', 'INSUFFICIENT_DURATION');
    }
    if (score > 50 && scoreVelocity > config.maxScorePerSec) {
      await recordSuspiciousScore({ sessionId, userId, gameId: canonicalId, score, durationMs: verifiedDurationMs, velocity: scoreVelocity, reason: `Velocity too high` });
      throw ApiError.unprocessable('Laju perolehan skor melebihi batas wajar.', 'SCORE_CEILING_EXCEEDED');
    }

    const isEligibleForReward = score > 0 && verifiedDurationMs >= config.minDurationMs;
    const coinsEarned = isEligibleForReward ? Math.min(250, Math.floor(score * config.baseCoinMultiplier)) : 0;
    const xpEarned = isEligibleForReward ? Math.min(500, Math.floor(score * config.baseXpMultiplier)) : 0;

    session.consumed = true;
    session.consumedAt = nowMs;

    const list = memoryStore.leaderboards.get(canonicalId) || [];
    const idx = list.findIndex(e => e.userId === userId);
    let isPersonalBest = true;
    if (idx >= 0) {
      isPersonalBest = score > list[idx].score;
      if (isPersonalBest) list[idx] = { userId, playerName: playerName.slice(0, 32), playerAvatar: playerAvatar.slice(0, 16), score, submittedAt: nowIso, gameId: canonicalId, masteryLevel };
    } else {
      list.push({ userId, playerName: playerName.slice(0, 32), playerAvatar: playerAvatar.slice(0, 16), score, submittedAt: nowIso, gameId: canonicalId, masteryLevel });
    }
    list.sort((a, b) => b.score - a.score);
    memoryStore.leaderboards.set(canonicalId, list);

    const historyEntry: StoredGameHistoryEntry = {
      historyId: `hist_${nowMs}_${crypto.randomBytes(6).toString('hex')}`, userId, sessionId, gameId: canonicalId, genre, score, isPersonalBest, timestamp: nowMs, dateStr: getUtcDateString(nowMs), weekStr: getIsoWeekString(nowMs), seasonId: 'season_1'
    };
    memoryStore.gameHistory.push(historyEntry);

    const eco = await getUserEconomy(userId);
    eco.coins += coinsEarned;
    eco.totalEarned += coinsEarned;
    eco.lastUpdated = nowMs;
    memoryStore.economies.set(userId, eco);

    if (coinsEarned > 0) {
      memoryStore.ledger.push({ transactionId, userId, type: 'GAME_REWARD', amount: coinsEarned, balanceBefore: eco.coins - coinsEarned, balanceAfter: eco.coins, reason: `GAME_REWARD_${canonicalId.toUpperCase()}`, referenceId: sessionId, createdAt: nowIso });
    }

    if (xpEarned > 0) {
      const prog = memoryStore.userProgression.get(userId) || { userId, totalXp: 0, level: 1, lastUpdated: nowMs };
      prog.totalXp += xpEarned;
      prog.level = calculateLevelFromXp(prog.totalXp);
      prog.lastUpdated = nowMs;
      memoryStore.userProgression.set(userId, prog);
    }

    const leaderboards = await getLeaderboardEntries(canonicalId);
    const result: ScoreSubmissionResult = { success: true, gameId: canonicalId, score, coinsEarned, xpEarned, newCoinBalance: eco.coins, leaderboards, transactionId };
    
    await setProcessedAction(idempotencyId, result);
    return result;
  }
}

// ==========================================
// 21. COMPETITIVE SYSTEM & RANKED PLAY
// ==========================================

export async function getActiveSeason(): Promise<StoredSeason> {
  const now = Date.now();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('seasons')
      .where('status', '==', 'active')
      .where('endAt', '>', now)
      .limit(1)
      .get();
    
    if (!snap.empty) {
      return snap.docs[0].data() as StoredSeason;
    }
  }

  // Fallback to explicit static versioned default season (no sliding dates)
  return {
    seasonId: 'season_1',
    name: 'Season 1: Neon Cyber Genesis',
    startAt: 1785542400000, // Fixed: Aug 1, 2026
    endAt: 1790812799000,   // Fixed: Sep 30, 2026
    status: 'active'
  };
}

export async function getCompetitiveProfile(userId: string): Promise<StoredCompetitiveProfile> {
  assertPersistenceOperational();
  const season = await getActiveSeason();

  let data: StoredCompetitiveProfile | null = null;

  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('competitiveProfiles').doc(userId).get();
    if (doc.exists) {
      data = doc.data() as StoredCompetitiveProfile;
    }
  } else {
    data = memoryStore.competitiveProfiles.get(userId) || null;
  }

  if (data) {
    // Handle season mismatch (soft reset logic)
    if (data.seasonId !== season.seasonId) {
      const softResetRating = (r: number) => Math.floor((r + INITIAL_RATING) / 2);
      
      const newGameRatings: Record<string, any> = {};
      Object.entries(data.gameRatings).forEach(([gid, stats]: [string, any]) => {
        const newRating = softResetRating(stats.rating);
        newGameRatings[gid] = {
          ...stats,
          rating: newRating,
          tier: getTierForRating(newRating),
          matchesPlayed: 0, // Reset match count for new season stats
          lastUpdated: Date.now()
        };
      });

      const newGlobalRating = softResetRating(data.globalRating);
      
      const resetProfile: StoredCompetitiveProfile = {
        ...data,
        globalRating: newGlobalRating,
        globalTier: getTierForRating(newGlobalRating),
        gameRatings: newGameRatings,
        seasonId: season.seasonId,
        rankedGames: 0,
        lastUpdated: Date.now()
      };

      if (isFirestoreAvailable()) {
        const db = getDb();
        await db.collection('competitiveProfiles').doc(userId).set(resetProfile);
      } else {
        memoryStore.competitiveProfiles.set(userId, resetProfile);
      }
      return resetProfile;
    }
    return data;
  }

  // Initial Profile
  const initialProfile: StoredCompetitiveProfile = {
    userId,
    globalRating: INITIAL_RATING,
    globalTier: getTierForRating(INITIAL_RATING),
    peakGlobalRating: INITIAL_RATING,
    gameRatings: {},
    rankedGames: 0,
    lastUpdated: Date.now(),
    seasonId: season.seasonId
  };

  if (!isFirestoreAvailable()) {
    memoryStore.competitiveProfiles.set(userId, initialProfile);
  }
  return initialProfile;
}

export async function createRankedSession(userId: string, gameId: string): Promise<StoredGameSession> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);
  
  if (!RANKED_GAME_ALLOWLIST.includes(canonicalId)) {
    throw ApiError.badRequest('Game ini belum mendukung mode ranked.', 'GAME_NOT_RANKED_ELIGIBLE');
  }

  const season = await getActiveSeason();
  const sessionId = `rnk_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  const now = Date.now();

  const session: StoredGameSession = {
    sessionId,
    userId,
    gameId: canonicalId,
    nonce,
    startTime: now,
    expiresAt: now + (30 * 60 * 1000), // 30 min for ranked
    consumed: false,
    isRanked: true,
    seasonId: season.seasonId,
    gameVersion: '2.0.0',
    balanceVersion: '2.5.0',
    rulesetVersion: '1.0.0',
    createdAt: now
  };

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('rankedSessions').doc(sessionId).set(session);
  } else {
    memoryStore.sessions.set(sessionId, session);
  }

  return session;
}

function calculateRatingDelta(
  currentRating: number,
  score: number,
  baseScore: number,
  matchesPlayed: number
): number {
  // Simple Normalized Performance Rating
  // Ratio of achieved score relative to expected base score for 1000 rating
  const performanceRatio = score / baseScore;
  let delta = 0;

  // Sensitivity (K-Factor equivalent)
  // Higher volatility for placement matches
  const K = matchesPlayed < PLACEMENT_MATCHES_COUNT ? 60 : 30;

  if (performanceRatio >= 1.0) {
    // Overperformed: Positive delta
    // Max +50 per match
    delta = Math.min(50, Math.floor(K * (performanceRatio - 0.5)));
  } else if (performanceRatio >= 0.2) {
    // Moderate performance
    delta = Math.floor(K * (performanceRatio - 0.8));
  } else {
    // Very poor performance: Negative delta
    delta = -Math.min(25, Math.floor(K * (0.8 - performanceRatio)));
  }

  // Placement match damping for losses
  if (matchesPlayed < PLACEMENT_MATCHES_COUNT && delta < 0) {
    delta = Math.floor(delta * 0.5);
  }

  return delta;
}

export interface RankedSubmissionResult extends ScoreSubmissionResult {
  oldRating: number;
  newRating: number;
  ratingChange: number;
  newTier: string;
}

function validateSessionHard(
  session: StoredGameSession,
  userId: string,
  canonicalId: CanonicalGameId,
  activeSeason: StoredSeason
): void {
  if (session.userId !== userId) {
    throw ApiError.unprocessable('Sesi ranked bukan milik pengguna ini.', 'SESSION_USER_MISMATCH');
  }
  if (session.gameId !== canonicalId) {
    throw ApiError.unprocessable('Game Sesi tidak cocok dengan game yang dikirim.', 'SESSION_GAME_MISMATCH');
  }
  if (session.isRanked !== true) {
    throw ApiError.unprocessable('Sesi ini bukan sesi ranked.', 'INVALID_SESSION');
  }
  if (session.seasonId !== activeSeason.seasonId) {
    throw ApiError.unprocessable('Sesi ini dibuat pada season yang berbeda.', 'SESSION_EXPIRED');
  }
  if (session.consumed) {
    throw ApiError.unprocessable('Sesi ranked sudah pernah digunakan.', 'SESSION_ALREADY_CONSUMED');
  }
  if (Date.now() > session.expiresAt) {
    throw ApiError.unprocessable('Sesi ranked telah kedaluwarsa.', 'SESSION_EXPIRED');
  }
  if (!RANKED_GAME_ALLOWLIST.includes(canonicalId)) {
    throw ApiError.unprocessable('Game ini tidak valid untuk mode ranked.', 'GAME_NOT_RANKED_ELIGIBLE');
  }
  if (session.gameVersion && session.gameVersion !== '2.0.0') {
    throw ApiError.unprocessable('Versi game tidak cocok dengan sesi.', 'INVALID_SESSION');
  }
  if (session.balanceVersion && session.balanceVersion !== '2.5.0') {
    throw ApiError.unprocessable('Versi balancing tidak cocok dengan sesi.', 'INVALID_SESSION');
  }
}

export async function executeRankedSubmission(input: ScoreSubmissionInput): Promise<RankedSubmissionResult> {
  assertPersistenceOperational();
  const { sessionId, userId, gameId, score, playerName, playerAvatar, masteryLevel, idempotencyKey } = input;
  const canonicalId = requireCanonicalGameId(gameId);
  const gameConfig = GAME_COMPETITIVE_CONFIGS[canonicalId];

  if (!gameConfig) {
    throw ApiError.badRequest('Game ini tidak valid untuk mode ranked.', 'INVALID_RANKED_GAME');
  }

  if (!idempotencyKey || !isValidIdempotencyKey(idempotencyKey)) {
    throw ApiError.badRequest('Idempotency key wajib disertakan.', 'INVALID_IDEMPOTENCY_KEY');
  }
  const idempotencyId = `ranked_${userId}_${idempotencyKey}`;

  const season = await getActiveSeason();
  const balanceConfig = getGameBalanceConfig(canonicalId);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (isFirestoreAvailable()) {
    const db = getDb();
    const idemRef = db.collection('processedActions').doc(idempotencyId);
    const sessionRef = db.collection('rankedSessions').doc(sessionId);
    const profileRef = db.collection('competitiveProfiles').doc(userId);
    const leaderRef = db.collection('rankedLeaderboards').doc(canonicalId).collection('entries').doc(userId);
    const seasonalLeaderRef = db.collection('seasonalLeaderboards')
      .doc(season.seasonId)
      .collection('games')
      .doc(canonicalId)
      .collection('entries')
      .doc(userId);

    let antiCheatError: { reason: string; duration: number; velocity: number } | null = null;
    let finalResult: RankedSubmissionResult | null = null;

    try {
      await db.runTransaction(async (tx) => {
        const idemDoc = await tx.get(idemRef);
        if (idemDoc.exists) {
          finalResult = (idemDoc.data() as any).result as RankedSubmissionResult;
          return;
        }

        const sessDoc = await tx.get(sessionRef);
        if (!sessDoc.exists) throw ApiError.unprocessable('Sesi ranked tidak ditemukan.', 'SESSION_NOT_FOUND');
        const session = sessDoc.data() as StoredGameSession;

        if (session.userId !== userId) throw ApiError.unprocessable('User mismatch', 'SESSION_USER_MISMATCH');
        if (session.gameId !== canonicalId) throw ApiError.unprocessable('Game mismatch', 'SESSION_GAME_MISMATCH');
        if (session.consumed) throw ApiError.unprocessable('Session used', 'SESSION_ALREADY_CONSUMED');
        if (nowMs > session.expiresAt) throw ApiError.unprocessable('Session expired', 'SESSION_EXPIRED');

        const verifiedDurationMs = nowMs - session.startTime;
        const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
        const scoreVelocity = score / durationSeconds;

        if (score > balanceConfig.maxScoreCeiling) {
          antiCheatError = { reason: `Score exceeded ceiling`, duration: 0, velocity: 0 };
          throw ApiError.unprocessable('Skor melebihi batas maksimum.', 'SCORE_CEILING_EXCEEDED');
        }
        if (score > 0 && verifiedDurationMs < balanceConfig.minDurationMs) {
          antiCheatError = { reason: `Duration too short`, duration: verifiedDurationMs, velocity: scoreVelocity };
          throw ApiError.unprocessable('Durasi tidak valid.', 'INSUFFICIENT_DURATION');
        }
        if (score > 50 && scoreVelocity > balanceConfig.maxScorePerSec) {
          antiCheatError = { reason: `Velocity too high`, duration: verifiedDurationMs, velocity: scoreVelocity };
          throw ApiError.unprocessable('Laju skor tidak valid.', 'SCORE_CEILING_EXCEEDED');
        }

        tx.update(sessionRef, { consumed: true, consumedAt: nowMs });

        const profileDoc = await tx.get(profileRef);
        const currentProfile: StoredCompetitiveProfile = profileDoc.exists ? (profileDoc.data() as StoredCompetitiveProfile) : {
          userId,
          globalRating: 1000,
          globalTier: getTierForRating(1000),
          peakGlobalRating: 1000,
          gameRatings: {},
          rankedGames: 0,
          lastUpdated: nowMs,
          seasonId: season.seasonId
        };

        const currentMatchStats = currentProfile.gameRatings[canonicalId] || {
          rating: 1000,
          tier: getTierForRating(1000),
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          lastUpdated: nowMs
        };

        const delta = calculateRatingDelta(currentMatchStats.rating, score, gameConfig.baseScore, currentMatchStats.matchesPlayed);
        const oldRating = currentMatchStats.rating;
        const newRating = Math.max(100, oldRating + delta);
        const newTier = getTierForRating(newRating);

        const updatedGameStats = {
          rating: newRating,
          tier: newTier,
          matchesPlayed: currentMatchStats.matchesPlayed + 1,
          wins: currentMatchStats.wins + (delta > 0 ? 1 : 0),
          losses: currentMatchStats.losses + (delta < 0 ? 1 : 0),
          lastUpdated: nowMs
        };

        currentProfile.gameRatings[canonicalId] = updatedGameStats;
        currentProfile.rankedGames += 1;
        currentProfile.lastUpdated = nowMs;

        const playedGames = Object.values(currentProfile.gameRatings);
        currentProfile.globalRating = Math.floor(playedGames.reduce((acc, curr) => acc + curr.rating, 0) / playedGames.length);
        currentProfile.globalTier = getTierForRating(currentProfile.globalRating);
        currentProfile.peakGlobalRating = Math.max(currentProfile.peakGlobalRating || 1000, currentProfile.globalRating);

        tx.set(profileRef, currentProfile);

        const entryData = {
          userId,
          playerName: playerName || 'Player',
          playerAvatar: playerAvatar || '👾',
          score,
          submittedAt: nowIso,
          gameId: canonicalId,
          masteryLevel: masteryLevel || 1,
          tier: newTier,
          rating: newRating
        };
        tx.set(leaderRef, entryData);
        tx.set(seasonalLeaderRef, entryData);

        const coinsEarned = Math.min(300, Math.floor(score * balanceConfig.baseCoinMultiplier * 1.2)); 
        const xpEarned = Math.min(600, Math.floor(score * balanceConfig.baseXpMultiplier * 1.5)); 
        const txId = `rnk_tx_${nowMs}_${crypto.randomBytes(8).toString('hex')}`;
        
        const ecoRef = db.collection('userEconomy').doc(userId);
        const ecoDoc = await tx.get(ecoRef);
        const currentEco: StoredEconomy = ecoDoc.exists
          ? (ecoDoc.data() as StoredEconomy)
          : { userId, coins: 100, totalEarned: 100, totalSpent: 0, lastUpdated: nowMs };

        const updatedEco: StoredEconomy = {
          userId,
          coins: currentEco.coins + coinsEarned,
          totalEarned: currentEco.totalEarned + coinsEarned,
          totalSpent: currentEco.totalSpent,
          lastUpdated: nowMs
        };
        tx.set(ecoRef, updatedEco);

        if (coinsEarned > 0) {
          const ledgerRef = db.collection('economyTransactions').doc(txId);
          tx.set(ledgerRef, {
            transactionId: txId, userId, type: 'GAME_REWARD', amount: coinsEarned, balanceBefore: currentEco.coins, balanceAfter: updatedEco.coins, reason: `RANKED_REWARD_${canonicalId.toUpperCase()}`, referenceId: sessionId, createdAt: nowIso
          });
        }

        const result: RankedSubmissionResult = {
          success: true, gameId: canonicalId, score, coinsEarned, xpEarned, newCoinBalance: updatedEco.coins, leaderboards: [], transactionId: txId, oldRating, newRating, ratingChange: delta, newTier
        };

        tx.set(idemRef, { actionId: idempotencyId, userId, result, processedAt: nowIso });
        finalResult = result;
      });
    } catch (err) {
      if (antiCheatError) {
        await recordSuspiciousScore({
          sessionId, userId, gameId: canonicalId, score,
          durationMs: antiCheatError.duration, velocity: antiCheatError.velocity, reason: antiCheatError.reason
        });
      }
      throw err;
    }
    return finalResult!;
  } else {
    const cached = await getProcessedAction(idempotencyId);
    if (cached) return cached.result as RankedSubmissionResult;

    const session = memoryStore.sessions.get(sessionId);
    if (!session) throw ApiError.unprocessable('Session not found', 'SESSION_NOT_FOUND');
    if (session.userId !== userId) throw ApiError.unprocessable('User mismatch', 'SESSION_USER_MISMATCH');
    if (session.gameId !== canonicalId) throw ApiError.unprocessable('Game mismatch', 'SESSION_GAME_MISMATCH');
    if (session.consumed) throw ApiError.unprocessable('Session used', 'SESSION_ALREADY_CONSUMED');
    if (nowMs > session.expiresAt) throw ApiError.unprocessable('Session expired', 'SESSION_EXPIRED');

    const verifiedDurationMs = nowMs - session.startTime;
    const durationSeconds = Math.max(verifiedDurationMs / 1000, 0.5);
    const scoreVelocity = score / durationSeconds;

    if (score > balanceConfig.maxScoreCeiling) {
      await recordSuspiciousScore({ sessionId, userId, gameId: canonicalId, score, durationMs: 0, velocity: 0, reason: `Score exceeded ceiling` });
      throw ApiError.unprocessable('Skor melebihi batas', 'SCORE_CEILING_EXCEEDED');
    }
    if (score > 0 && verifiedDurationMs < balanceConfig.minDurationMs) {
      await recordSuspiciousScore({ sessionId, userId, gameId: canonicalId, score, durationMs: verifiedDurationMs, velocity: scoreVelocity, reason: `Duration too short` });
      throw ApiError.unprocessable('Durasi tidak valid', 'INSUFFICIENT_DURATION');
    }
    if (score > 50 && scoreVelocity > balanceConfig.maxScorePerSec) {
      await recordSuspiciousScore({ sessionId, userId, gameId: canonicalId, score, durationMs: verifiedDurationMs, velocity: scoreVelocity, reason: `Velocity too high` });
      throw ApiError.unprocessable('Laju skor tidak valid', 'SCORE_CEILING_EXCEEDED');
    }

    session.consumed = true;
    session.consumedAt = nowMs;

    const profile = memoryStore.competitiveProfiles.get(userId) || {
      userId, globalRating: 1000, globalTier: getTierForRating(1000), peakGlobalRating: 1000, gameRatings: {}, rankedGames: 0, lastUpdated: nowMs, seasonId: season.seasonId
    };

    const currentMatchStats = profile.gameRatings[canonicalId] || { rating: 1000, tier: getTierForRating(1000), matchesPlayed: 0, wins: 0, losses: 0, lastUpdated: nowMs };
    const delta = calculateRatingDelta(currentMatchStats.rating, score, gameConfig.baseScore, currentMatchStats.matchesPlayed);
    const oldRating = currentMatchStats.rating;
    const newRating = Math.max(100, oldRating + delta);
    const newTier = getTierForRating(newRating);

    profile.gameRatings[canonicalId] = {
      rating: newRating, tier: newTier, matchesPlayed: currentMatchStats.matchesPlayed + 1, wins: currentMatchStats.wins + (delta > 0 ? 1 : 0), losses: currentMatchStats.losses + (delta < 0 ? 1 : 0), lastUpdated: nowMs
    };
    
    let totalR = 0; let numG = 0; let totalGames = 0;
    for (const [gid, gr] of Object.entries(profile.gameRatings)) {
      if (gr.matchesPlayed > 0) { totalR += gr.rating; numG++; }
      totalGames += gr.matchesPlayed;
    }
    profile.globalRating = numG > 0 ? Math.floor(totalR / numG) : 1000;
    profile.globalTier = getTierForRating(profile.globalRating);
    profile.peakGlobalRating = Math.max(profile.peakGlobalRating || 1000, profile.globalRating);
    profile.rankedGames = totalGames;
    profile.lastUpdated = nowMs;
    memoryStore.competitiveProfiles.set(userId, profile);
    
    const coinsEarned = Math.min(300, Math.floor(score * balanceConfig.baseCoinMultiplier * 1.2)); 
    const xpEarned = Math.min(600, Math.floor(score * balanceConfig.baseXpMultiplier * 1.5)); 
    
    const eco = await getUserEconomy(userId);
    eco.coins += coinsEarned;
    eco.totalEarned += coinsEarned;
    eco.lastUpdated = nowMs;
    memoryStore.economies.set(userId, eco);

    const result: RankedSubmissionResult = {
      success: true, gameId: canonicalId, score, coinsEarned, xpEarned, newCoinBalance: eco.coins, leaderboards: [], transactionId: `rnk_tx_${nowMs}_${crypto.randomBytes(8).toString('hex')}`, oldRating, newRating, ratingChange: delta, newTier
    };

    await setProcessedAction(idempotencyId, result);
    return result;
  }
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

export async function getRankedLeaderboardEntries(gameId: string, limit = 50): Promise<StoredLeaderboardEntry[]> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snapshot = await db.collection('rankedLeaderboards')
      .doc(canonicalId)
      .collection('entries')
      .orderBy('rating', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(d => d.data() as StoredLeaderboardEntry);
  } else {
    const list = memoryStore.rankedLeaderboards.get(canonicalId) || [];
    return list.slice(0, limit);
  }
}

export async function getRankedLeaderboardWithContext(
  gameId: string,
  userId?: string,
  limit = 50
): Promise<{ entries: StoredLeaderboardEntry[]; userRank?: number; userEntry?: StoredLeaderboardEntry }> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);
  const result: { entries: StoredLeaderboardEntry[]; userRank?: number; userEntry?: StoredLeaderboardEntry } = { entries: [] };

  if (isFirestoreAvailable()) {
    const db = getDb();
    const leaderboardCol = db.collection('rankedLeaderboards').doc(canonicalId).collection('entries');
    
    // 1. Fetch Top Entries
    const topSnapshot = await leaderboardCol
      .orderBy('rating', 'desc')
      .limit(limit)
      .get();
    
    result.entries = topSnapshot.docs.map((d, i) => ({ ...d.data() as StoredLeaderboardEntry, rank: i + 1 }));

    // 2. If userId provided, find their rank and entry
    if (userId) {
      const userDoc = await leaderboardCol.doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data() as StoredLeaderboardEntry;
        result.userEntry = userData;
        
        // Count entries with higher rating to find rank
        const rankSnapshot = await leaderboardCol
          .where('rating', '>', userData.rating)
          .count()
          .get();
        
        result.userRank = rankSnapshot.data().count + 1;
        result.userEntry.rank = result.userRank;
      }
    }
  } else {
    const list = memoryStore.rankedLeaderboards.get(canonicalId) || [];
    result.entries = list.slice(0, limit).map((e, i) => ({ ...e, rank: i + 1 }));
    if (userId) {
      const userIdx = list.findIndex(e => e.userId === userId);
      if (userIdx >= 0) {
        result.userEntry = { ...list[userIdx], rank: userIdx + 1 };
        result.userRank = userIdx + 1;
      }
    }
  }
  return result;
}

export async function getSeasonalLeaderboardEntries(seasonId: string, gameId: string, limit = 50): Promise<StoredLeaderboardEntry[]> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snapshot = await db.collection('seasonalLeaderboards')
      .doc(seasonId)
      .collection('games')
      .doc(canonicalId)
      .collection('entries')
      .orderBy('rating', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(d => d.data() as StoredLeaderboardEntry);
  } else {
    const seasonGames = memoryStore.seasonalLeaderboards.get(seasonId);
    if (seasonGames) {
      const list = seasonGames.get(canonicalId) || [];
      return list.slice(0, limit);
    }
    return [];
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
// KILL SWITCHES (INCIDENT RESILIENCE)
// ==========================================

export type KillSwitchFeature = 'ranked' | 'economy' | 'seasons';

const runtimeKillSwitches: Record<KillSwitchFeature, boolean> = {
  ranked: process.env.KILL_SWITCH_RANKED === 'true',
  economy: process.env.KILL_SWITCH_ECONOMY === 'true',
  seasons: process.env.KILL_SWITCH_SEASONS === 'true'
};

export function isKillSwitchActive(feature: KillSwitchFeature): boolean {
  return runtimeKillSwitches[feature] || false;
}

export function setKillSwitch(feature: KillSwitchFeature, active: boolean, adminUid?: string): { success: boolean; feature: KillSwitchFeature; active: boolean } {
  runtimeKillSwitches[feature] = active;
  serverLogger.security('KILL_SWITCH_TOGGLE', `Kill switch '${feature}' set to ${active}`, {
    feature,
    active,
    adminUid: adminUid || 'system'
  });
  return { success: true, feature, active };
}

export function getKillSwitches(): Record<KillSwitchFeature, boolean> {
  return { ...runtimeKillSwitches };
}

export function isPersistenceReady(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return isFirestoreAvailable();
  }
  return true;
}

// ==========================================
// ECONOMY RECONCILIATION & INTEGRITY
// ==========================================

export interface EconomyReconciliationReport {
  userId: string;
  initialBalance: number;
  totalCredits: number;
  totalDebits: number;
  calculatedBalance: number;
  actualBalance: number;
  discrepancy: number;
  isReconciled: boolean;
  transactionCount: number;
  timestamp: string;
}

export async function reconcileUserEconomy(userId: string): Promise<EconomyReconciliationReport> {
  assertPersistenceOperational();
  const INITIAL_BALANCE = 100;
  let currentBalance = INITIAL_BALANCE;
  let userTransactions: StoredEconomyTransaction[] = [];

  if (isFirestoreAvailable()) {
    const db = getDb();
    const econDoc = await db.collection('userEconomy').doc(userId).get();
    if (econDoc.exists) {
      currentBalance = econDoc.data()?.coins ?? INITIAL_BALANCE;
    }
    const txSnap = await db.collection('economyTransactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'asc')
      .get();
    userTransactions = txSnap.docs.map(d => d.data() as StoredEconomyTransaction);
  } else {
    const econ = await getUserEconomy(userId);
    currentBalance = econ.coins;
    userTransactions = memoryStore.ledger.filter(tx => tx.userId === userId);
  }

  let totalCredits = 0;
  let totalDebits = 0;

  for (const tx of userTransactions) {
    if (tx.amount > 0) {
      totalCredits += tx.amount;
    } else {
      totalDebits += Math.abs(tx.amount);
    }
  }

  const calculatedBalance = INITIAL_BALANCE + totalCredits - totalDebits;
  const discrepancy = currentBalance - calculatedBalance;
  const isReconciled = discrepancy === 0;

  if (!isReconciled) {
    serverLogger.security('ECONOMY_DISCREPANCY_FLAGGED', `User ${userId} economy mismatch: actual=${currentBalance}, calculated=${calculatedBalance}`, {
      userId,
      actualBalance: currentBalance,
      calculatedBalance,
      discrepancy,
      transactionCount: userTransactions.length
    });
  }

  return {
    userId,
    initialBalance: INITIAL_BALANCE,
    totalCredits,
    totalDebits,
    calculatedBalance,
    actualBalance: currentBalance,
    discrepancy,
    isReconciled,
    transactionCount: userTransactions.length,
    timestamp: new Date().toISOString()
  };
}

// ==========================================
// COMPETITIVE INTEGRITY CHECKER
// ==========================================

export interface CompetitiveIntegrityReport {
  userId: string;
  profileRating: number;
  profileTier: string;
  gamesTracked: number;
  totalRankedMatches: number;
  isConsistent: boolean;
  notes: string[];
}

export async function validateCompetitiveIntegrity(userId: string): Promise<CompetitiveIntegrityReport> {
  const profile = await getCompetitiveProfile(userId);
  const notes: string[] = [];
  let isConsistent = true;

  if (profile.globalRating < 100 || !Number.isFinite(profile.globalRating)) {
    isConsistent = false;
    notes.push(`Invalid global rating: ${profile.globalRating}`);
  }

  let calculatedMatches = 0;
  for (const [gameId, stats] of Object.entries(profile.gameRatings || {})) {
    if (stats.matchesPlayed < 0) {
      isConsistent = false;
      notes.push(`Negative matches for game ${gameId}`);
    }
    calculatedMatches += stats.matchesPlayed || 0;
  }

  const totalMatches = profile.rankedGames ?? 0;
  if (totalMatches < calculatedMatches) {
    isConsistent = false;
    notes.push(`Total matches ${totalMatches} is less than sum of game matches ${calculatedMatches}`);
  }

  return {
    userId,
    profileRating: profile.globalRating,
    profileTier: profile.globalTier,
    gamesTracked: Object.keys(profile.gameRatings || {}).length,
    totalRankedMatches: totalMatches,
    isConsistent,
    notes
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

