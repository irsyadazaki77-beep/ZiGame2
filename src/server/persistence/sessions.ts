import crypto from 'crypto';
import { requireCanonicalGameId } from '../../config/canonicalGames';
import { isFirestoreAvailable, getDb, memoryStore, assertPersistenceOperational, StoredGameSession } from './db';
import { computeSessionSignature } from './security';

export const SESSION_MAX_LIFETIME_MS = 60 * 60 * 1000; // 1 hour max session lifetime

export async function createGameSession(userId: string, gameId: string): Promise<StoredGameSession> {
  assertPersistenceOperational();
  const canonicalId = requireCanonicalGameId(gameId);

  const sessionId = `ses_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = computeSessionSignature(sessionId, userId, canonicalId, nonce);
  const now = Date.now();

  const session: StoredGameSession = {
    sessionId,
    userId,
    gameId: canonicalId,
    nonce,
    signature,
    startTime: now,
    expiresAt: now + SESSION_MAX_LIFETIME_MS,
    consumed: false,
    isRanked: false,
    gameVersion: '2.0.0',
    balanceVersion: '2.5.0',
    rulesetVersion: '1.0.0',
    createdAt: now
  };

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('gameSessions').doc(sessionId).set(session);
  } else {
    memoryStore.sessions.set(sessionId, session);
  }

  return session;
}

export async function invalidateSession(sessionId: string, isRanked = false, reason = 'ANTI_CHEAT_VIOLATION'): Promise<void> {
  const now = Date.now();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const collection = isRanked ? 'rankedSessions' : 'gameSessions';
    await db.collection(collection).doc(sessionId).update({
      consumed: true,
      consumedAt: now,
      invalidatedReason: reason
    }).catch(() => {});
  } else {
    const session = memoryStore.sessions.get(sessionId);
    if (session) {
      session.consumed = true;
      session.consumedAt = now;
    }
  }
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
