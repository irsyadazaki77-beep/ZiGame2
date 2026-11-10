import crypto from 'crypto';
import { serverLogger } from '../logger';
import {
  isFirestoreAvailable,
  getDb,
  memoryStore,
  assertPersistenceOperational,
  StoredGameSession,
  StoredUserSecurity,
  StoredSecurityEvent,
  AnomalySeverity
} from './db';

const SESSION_HMAC_SECRET = process.env.SESSION_HMAC_SECRET || 'zigame_authoritative_hmac_v2_secret_key_9f8a7b6c';
export const AUTO_BAN_STRIKE_THRESHOLD = 3;
export const DEFAULT_AUTO_BAN_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours default suspension

/**
 * Generates an authoritative server-side HMAC-SHA256 signature for a game session ticket.
 */
export function computeSessionSignature(
  sessionId: string,
  userId: string,
  gameId: string,
   nonce: string
): string {
  const payload = `${sessionId}:${userId}:${gameId}:${nonce}`;
  return crypto.createHmac('sha256', SESSION_HMAC_SECRET).update(payload).digest('hex');
}

/**
 * Verifies the server-side HMAC-SHA256 signature of a stored or submitted session ticket using constant-time comparison.
 */
export function verifySessionSignature(
  session: StoredGameSession,
  submittedSignature?: string
): boolean {
  const expected = computeSessionSignature(session.sessionId, session.userId, session.gameId, session.nonce);

  // If the stored session carries a signature, ensure it hasn't been tampered with
  if (session.signature) {
    try {
      const a = Buffer.from(session.signature, 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  // If client explicitly sent a session signature token, verify it in constant time
  if (submittedSignature !== undefined) {
    if (typeof submittedSignature !== 'string' || !submittedSignature.trim()) {
      return false;
    }
    try {
      const a = Buffer.from(submittedSignature.trim(), 'utf8');
      const b = Buffer.from(expected, 'utf8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Computes deterministic SHA-256 payload integrity proof over { sessionId, gameId, score, nonce }
 * that can be computed identically by both client SDK and server verifier.
 */
export function computeClientPayloadProof(
  sessionId: string,
  gameId: string,
  score: number,
  nonce: string
): string {
  const raw = `zigame_proof_v2|${sessionId}|${gameId}|${Math.floor(score)}|${nonce}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Verifies client-provided nonce and/or payload integrity proof.
 */
export function verifyClientSubmissionProof(
  session: StoredGameSession,
  score: number,
  submittedNonce?: string,
  submittedProof?: string,
  submittedSignature?: string
): { valid: boolean; reason?: string } {
  if (!verifySessionSignature(session, submittedSignature)) {
    return { valid: false, reason: 'Session cryptographic HMAC signature verification failed' };
  }

  if (submittedNonce !== undefined) {
    if (typeof submittedNonce !== 'string' || submittedNonce !== session.nonce) {
      return { valid: false, reason: 'Session nonce mismatch on score submission' };
    }
  }

  if (submittedProof !== undefined) {
    if (typeof submittedProof !== 'string') {
      return { valid: false, reason: 'Malformed client payload integrity proof' };
    }
    const expectedProof = computeClientPayloadProof(session.sessionId, session.gameId, score, session.nonce);
    try {
      const a = Buffer.from(submittedProof, 'utf8');
      const b = Buffer.from(expectedProof, 'utf8');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { valid: false, reason: 'Client payload HMAC/SHA-256 proof mismatch (score or gameId tampered)' };
      }
    } catch {
      return { valid: false, reason: 'Invalid client payload integrity proof encoding' };
    }
  }

  return { valid: true };
}

/**
 * Retrieves the authoritative security profile for a user.
 */
export async function getUserSecurityProfile(userId: string): Promise<StoredUserSecurity> {
  assertPersistenceOperational();
  if (isFirestoreAvailable()) {
    const db = getDb();
    const doc = await db.collection('userSecurity').doc(userId).get();
    if (doc.exists) {
      const data = doc.data() as StoredUserSecurity;
      // Check if temporary ban has expired
      if (data.isBanned && data.banExpiresAt && Date.now() > data.banExpiresAt) {
        const unbanned: StoredUserSecurity = {
          ...data,
          isBanned: false,
          banReason: undefined,
          banExpiresAt: null
        };
        await db.collection('userSecurity').doc(userId).set(unbanned);
        return unbanned;
      }
      return data;
    }
  } else {
    const existing = memoryStore.userSecurity.get(userId);
    if (existing) {
      if (existing.isBanned && existing.banExpiresAt && Date.now() > existing.banExpiresAt) {
        existing.isBanned = false;
        existing.banReason = undefined;
        existing.banExpiresAt = null;
        memoryStore.userSecurity.set(userId, existing);
      }
      return existing;
    }
  }

  return {
    userId,
    strikeCount: 0,
    isBanned: false
  };
}

/**
 * Checks if a user is currently suspended/banned.
 */
export async function checkUserBanStatus(userId: string): Promise<{
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  banExpiresAt?: number | null;
  strikeCount: number;
}> {
  const profile = await getUserSecurityProfile(userId);
  return {
    isBanned: profile.isBanned,
    banReason: profile.banReason,
    bannedAt: profile.bannedAt,
    banExpiresAt: profile.banExpiresAt,
    strikeCount: profile.strikeCount
  };
}

/**
 * Records a security strike against a user and triggers automatic account suspension
 * if the strike threshold is reached or if immediateBan is set.
 */
export async function recordSecurityStrike(
  userId: string,
  reason: string,
  severity: AnomalySeverity = 'HIGH',
  immediateBan = false,
  clientIp?: string
): Promise<StoredUserSecurity> {
  assertPersistenceOperational();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const current = await getUserSecurityProfile(userId);
  const strikeIncrement = severity === 'CRITICAL' ? 1 : severity === 'HIGH' ? 1 : 0;
  const newStrikeCount = current.strikeCount + strikeIncrement;
  const shouldBan = current.isBanned || immediateBan || newStrikeCount >= AUTO_BAN_STRIKE_THRESHOLD;

  const updated: StoredUserSecurity = {
    userId,
    strikeCount: newStrikeCount,
    isBanned: shouldBan,
    banReason: shouldBan
      ? (current.banReason || `Dibekukan otomatis oleh sistem pertahanan: ${reason} (${newStrikeCount} pelanggaran)`)
      : undefined,
    bannedAt: shouldBan ? (current.bannedAt || nowIso) : undefined,
    banExpiresAt: shouldBan ? (current.banExpiresAt ?? (nowMs + DEFAULT_AUTO_BAN_DURATION_MS)) : null,
    bannedBy: shouldBan ? (current.bannedBy || 'SYSTEM_AUTO_CHEAT') : undefined,
    lastViolationAt: nowIso
  };

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('userSecurity').doc(userId).set(updated);
  } else {
    memoryStore.userSecurity.set(userId, updated);
  }

  if (shouldBan && !current.isBanned) {
    serverLogger.security(
      'AUTO_ACCOUNT_SUSPENSION',
      `User ${userId} automatically suspended after ${newStrikeCount} strikes: ${reason}`,
      { strikeCount: newStrikeCount, reason, banExpiresAt: updated.banExpiresAt },
      userId,
      clientIp
    );

    await recordSecurityEvent({
      userId,
      clientIp,
      eventType: 'AUTO_ACCOUNT_SUSPENSION',
      severity: 'CRITICAL',
      reason: `Akun dibekukan otomatis setelah ${newStrikeCount} pelanggaran: ${reason}`
    });
  }

  return updated;
}

/**
 * Admin / System function to explicitly ban or suspend a user account.
 */
export async function banUserAccount(
  userId: string,
  reason: string,
  adminUid: string,
  durationMinutes?: number | null
): Promise<StoredUserSecurity> {
  assertPersistenceOperational();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const current = await getUserSecurityProfile(userId);

  const banExpiresAt = durationMinutes && durationMinutes > 0
    ? nowMs + durationMinutes * 60 * 1000
    : null; // null = permanent until unbanned

  const updated: StoredUserSecurity = {
    userId,
    strikeCount: Math.max(current.strikeCount, AUTO_BAN_STRIKE_THRESHOLD),
    isBanned: true,
    banReason: reason.trim() || 'Pelanggaran kebijakan keamanan platform.',
    bannedAt: nowIso,
    banExpiresAt,
    bannedBy: adminUid,
    lastViolationAt: nowIso
  };

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('userSecurity').doc(userId).set(updated);
  } else {
    memoryStore.userSecurity.set(userId, updated);
  }

  await recordSecurityEvent({
    userId,
    eventType: 'ADMIN_USER_BAN',
    severity: 'CRITICAL',
    reason: `Dibekukan oleh Admin (${adminUid}): ${updated.banReason}`
  });

  return updated;
}

/**
 * Admin function to unban a user account and reset their strike counter.
 */
export async function unbanUserAccount(userId: string, adminUid: string): Promise<StoredUserSecurity> {
  assertPersistenceOperational();
  const updated: StoredUserSecurity = {
    userId,
    strikeCount: 0,
    isBanned: false,
    banReason: undefined,
    bannedAt: undefined,
    banExpiresAt: null,
    bannedBy: undefined
  };

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('userSecurity').doc(userId).set(updated);
  } else {
    memoryStore.userSecurity.set(userId, updated);
  }

  await recordSecurityEvent({
    userId,
    eventType: 'ADMIN_USER_UNBAN',
    severity: 'LOW',
    reason: `Pemblokiran akun dicabut oleh Admin (${adminUid})`
  });

  return updated;
}

/**
 * Lists all users who have strikes or active bans for the Admin Security Console.
 */
export async function getFlaggedAndBannedUsers(limit = 50): Promise<StoredUserSecurity[]> {
  assertPersistenceOperational();
  const safeLimit = Math.min(100, Math.max(1, limit));

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('userSecurity').limit(safeLimit).get();
    const list = snap.docs
      .map(d => d.data() as StoredUserSecurity)
      .filter(u => u.isBanned || u.strikeCount > 0);
    return list.sort((a, b) => (Number(b.isBanned) - Number(a.isBanned)) || (b.strikeCount - a.strikeCount));
  } else {
    const list = Array.from(memoryStore.userSecurity.values()).filter(u => u.isBanned || u.strikeCount > 0);
    list.sort((a, b) => (Number(b.isBanned) - Number(a.isBanned)) || (b.strikeCount - a.strikeCount));
    return list.slice(0, safeLimit);
  }
}

/**
 * Records a security incident in the audit log.
 */
export async function recordSecurityEvent(
  event: Omit<StoredSecurityEvent, 'id' | 'timestamp'>
): Promise<StoredSecurityEvent> {
  const fullEvent: StoredSecurityEvent = {
    ...event,
    id: `sec_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    timestamp: new Date().toISOString()
  };

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('securityEvents').doc(fullEvent.id).set(fullEvent).catch(() => {});
  } else {
    memoryStore.securityEvents.push(fullEvent);
    if (memoryStore.securityEvents.length > 500) {
      memoryStore.securityEvents = memoryStore.securityEvents.slice(-500);
    }
  }

  return fullEvent;
}

/**
 * Queries recent security events for the Admin Security Console.
 */
export async function getSecurityEvents(limit = 50): Promise<StoredSecurityEvent[]> {
  const safeLimit = Math.min(100, Math.max(1, limit));

  if (isFirestoreAvailable()) {
    const db = getDb();
    const snap = await db.collection('securityEvents')
      .orderBy('timestamp', 'desc')
      .limit(safeLimit)
      .get();
    return snap.docs.map(d => d.data() as StoredSecurityEvent);
  } else {
    const copy = [...memoryStore.securityEvents];
    copy.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return copy.slice(0, safeLimit);
  }
}
