/**
 * Authoritative Server Persistence Layer
 * ZiGame 2.0 Stabilization
 */

import { getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { serverLogger } from './logger';
import { toCanonicalGameId, CanonicalGameId } from '../config/canonicalGames';

export interface StoredGameSession {
  sessionId: string;
  userId: string;
  gameId: string;
  nonce: string;
  startTime: number;
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

export interface StoredLeaderboardEntry {
  userId: string;
  playerName: string;
  playerAvatar: string;
  score: number;
  submittedAt: string;
  gameId: string;
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

// In-Memory fallback store for non-production development and unit testing
class InMemoryStore {
  sessions = new Map<string, StoredGameSession>();
  economies = new Map<string, StoredEconomy>();
  spins = new Map<string, { lastSpinDate: string; count: number }>();
  leaderboards = new Map<string, StoredLeaderboardEntry[]>();
  processedActions = new Map<string, { result: any; timestamp: number }>();
  suspiciousScores: StoredSuspiciousScore[] = [];
}

const memoryStore = new InMemoryStore();

/**
 * Returns true if Firestore is available, initialized, and operational.
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
 * Helper to ensure production fails closed if Firestore is missing
 */
function assertPersistenceOperational() {
  if (process.env.NODE_ENV === 'production' && !isFirestoreAvailable()) {
    serverLogger.security('FIREBASE_FAILURE', 'Database persistence unavailable in production environment');
    const err = new Error('Database persistence service unavailable.');
    (err as any).code = 'SERVICE_UNAVAILABLE';
    throw err;
  }
}

// ==========================================
// SESSION MANAGEMENT (Anti-Cheat)
// ==========================================

export async function createGameSession(userId: string, gameId: string, nonce: string): Promise<StoredGameSession> {
  assertPersistenceOperational();

  const canonicalId = toCanonicalGameId(gameId);
  const sessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const session: StoredGameSession = {
    sessionId,
    userId,
    gameId: canonicalId,
    nonce,
    startTime: Date.now(),
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
  const canonicalId = toCanonicalGameId(gameId);

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

      if (toCanonicalGameId(session.gameId) !== canonicalId) {
        return { valid: false, reason: 'SESSION_GAME_MISMATCH' };
      }

      if (session.consumed) {
        return { valid: false, reason: 'SESSION_ALREADY_CONSUMED' };
      }

      // Mark consumed atomically
      const consumedAt = Date.now();
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
    if (toCanonicalGameId(session.gameId) !== canonicalId) return { valid: false, reason: 'SESSION_GAME_MISMATCH' };
    if (session.consumed) return { valid: false, reason: 'SESSION_ALREADY_CONSUMED' };

    session.consumed = true;
    session.consumedAt = Date.now();
    return { valid: true, session };
  }
}

// ==========================================
// USER ECONOMY & CURRENCY (Server-Authoritative)
// ==========================================

export async function getUserEconomy(userId: string): Promise<StoredEconomy> {
  assertPersistenceOperational();

  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('userEconomy').doc(userId).get();
    if (doc.exists) {
      return doc.data() as StoredEconomy;
    }
    // Default initial economy
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

export async function creditCoins(userId: string, amount: number, reason: string): Promise<StoredEconomy> {
  assertPersistenceOperational();
  if (amount < 0) throw new Error('Cannot credit negative coins');

  if (isFirestoreAvailable()) {
    const db = getDb();
    const docRef = db.collection('userEconomy').doc(userId);

    return await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      const current: StoredEconomy = doc.exists
        ? (doc.data() as StoredEconomy)
        : { userId, coins: 100, totalEarned: 100, totalSpent: 0, lastUpdated: Date.now() };

      const updated: StoredEconomy = {
        userId,
        coins: current.coins + amount,
        totalEarned: current.totalEarned + amount,
        totalSpent: current.totalSpent,
        lastUpdated: Date.now()
      };

      tx.set(docRef, updated);

      // Record transaction ledger
      const txRef = db.collection('economyTransactions').doc();
      tx.set(txRef, {
        txId: txRef.id,
        userId,
        type: 'CREDIT',
        amount,
        reason,
        balanceAfter: updated.coins,
        timestamp: new Date().toISOString()
      });

      return updated;
    });
  } else {
    const eco = await getUserEconomy(userId);
    eco.coins += amount;
    eco.totalEarned += amount;
    eco.lastUpdated = Date.now();
    memoryStore.economies.set(userId, eco);
    return eco;
  }
}

export async function debitCoins(userId: string, amount: number, reason: string): Promise<StoredEconomy> {
  assertPersistenceOperational();
  if (amount <= 0) throw new Error('Amount to debit must be positive');

  if (isFirestoreAvailable()) {
    const db = getDb();
    const docRef = db.collection('userEconomy').doc(userId);

    return await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const current = doc.data() as StoredEconomy;
      if (current.coins < amount) {
        const err = new Error('INSUFFICIENT_FUNDS');
        (err as any).code = 'INSUFFICIENT_FUNDS';
        throw err;
      }

      const updated: StoredEconomy = {
        userId,
        coins: current.coins - amount,
        totalEarned: current.totalEarned,
        totalSpent: current.totalSpent + amount,
        lastUpdated: Date.now()
      };

      tx.set(docRef, updated);

      // Record transaction ledger
      const txRef = db.collection('economyTransactions').doc();
      tx.set(txRef, {
        txId: txRef.id,
        userId,
        type: 'DEBIT',
        amount,
        reason,
        balanceAfter: updated.coins,
        timestamp: new Date().toISOString()
      });

      return updated;
    });
  } else {
    const eco = await getUserEconomy(userId);
    if (eco.coins < amount) {
      const err = new Error('INSUFFICIENT_FUNDS');
      (err as any).code = 'INSUFFICIENT_FUNDS';
      throw err;
    }
    eco.coins -= amount;
    eco.totalSpent += amount;
    eco.lastUpdated = Date.now();
    memoryStore.economies.set(userId, eco);
    return eco;
  }
}

// ==========================================
// DAILY SPIN & COOLDOWNS
// ==========================================

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

export async function recordDailySpin(userId: string, prizeCoins: number): Promise<{ success: boolean; coins: number; prize: number }> {
  assertPersistenceOperational();
  const todayStr = new Date().toISOString().split('T')[0];

  const cooldown = await getSpinCooldown(userId);
  if (!cooldown.canSpin) {
    const err = new Error('SPIN_COOLDOWN');
    (err as any).code = 'SPIN_COOLDOWN';
    throw err;
  }

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('spinCooldowns').doc(userId).set({
      userId,
      lastSpinDate: todayStr,
      updatedAt: Date.now()
    });
  } else {
    memoryStore.spins.set(userId, { lastSpinDate: todayStr, count: (memoryStore.spins.get(userId)?.count || 0) + 1 });
  }

  const updatedEco = await creditCoins(userId, prizeCoins, 'DAILY_SPIN');
  return {
    success: true,
    coins: updatedEco.coins,
    prize: prizeCoins
  };
}

// ==========================================
// LEADERBOARD (Server-Authoritative)
// ==========================================

export async function saveLeaderboardScore(
  gameId: string,
  userId: string,
  playerName: string,
  playerAvatar: string,
  score: number,
  masteryLevel?: number
): Promise<StoredLeaderboardEntry[]> {
  assertPersistenceOperational();
  const canonicalId = toCanonicalGameId(gameId);
  const now = new Date().toISOString();

  if (isFirestoreAvailable()) {
    const db = getDb();
    const entryRef = db.collection('leaderboards').doc(canonicalId).collection('entries').doc(userId);

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(entryRef);
      if (doc.exists) {
        const existing = doc.data() as StoredLeaderboardEntry;
        if (score > existing.score) {
          tx.set(entryRef, {
            userId,
            playerName,
            playerAvatar,
            score,
            submittedAt: now,
            gameId: canonicalId,
            masteryLevel: masteryLevel || existing.masteryLevel || 1
          });
        }
      } else {
        tx.set(entryRef, {
          userId,
          playerName,
          playerAvatar,
          score,
          submittedAt: now,
          gameId: canonicalId,
          masteryLevel: masteryLevel || 1
        });
      }
    });

    return await getLeaderboardEntries(canonicalId);
  } else {
    let list = memoryStore.leaderboards.get(canonicalId) || [];
    const idx = list.findIndex(e => e.userId === userId);
    if (idx >= 0) {
      if (score > list[idx].score) {
        list[idx] = { userId, playerName, playerAvatar, score, submittedAt: now, gameId: canonicalId, masteryLevel };
      }
    } else {
      list.push({ userId, playerName, playerAvatar, score, submittedAt: now, gameId: canonicalId, masteryLevel });
    }
    list.sort((a, b) => b.score - a.score);
    list = list.slice(0, 100);
    memoryStore.leaderboards.set(canonicalId, list);
    return list;
  }
}

export async function getLeaderboardEntries(gameId: string, limit = 50): Promise<StoredLeaderboardEntry[]> {
  assertPersistenceOperational();
  const canonicalId = toCanonicalGameId(gameId);

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
// SUSPICIOUS SCORE AUDITING
// ==========================================

export async function recordSuspiciousScore(entry: Omit<StoredSuspiciousScore, 'id' | 'timestamp'>) {
  const fullEntry: StoredSuspiciousScore = {
    ...entry,
    id: `sus_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString()
  };

  serverLogger.security('SUSPICIOUS_SCORE', `Suspicious score logged: ${entry.score} pts in ${entry.durationMs}ms (velocity: ${entry.velocity}/s) on ${entry.gameId}`, fullEntry, entry.userId);

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
