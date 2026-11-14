import crypto from 'crypto';
import { serverLogger } from '../logger';
import {
  isFirestoreAvailable,
  getDb,
  memoryStore,
  assertPersistenceOperational,
  StoredSuspiciousScore,
  AnomalySeverity
} from './db';
import { recordSecurityStrike, getFlaggedAndBannedUsers, getSecurityEvents } from './security';

export interface RecordSuspiciousScoreParams extends Omit<StoredSuspiciousScore, 'id' | 'timestamp'> {
  severity?: AnomalySeverity;
  flaggedOnly?: boolean;
}

export async function recordSuspiciousScore(entry: RecordSuspiciousScoreParams): Promise<StoredSuspiciousScore> {
  const fullEntry: StoredSuspiciousScore = {
    ...entry,
    severity: entry.severity || 'HIGH',
    id: `sus_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    timestamp: new Date().toISOString()
  };

  serverLogger.security(
    'SUSPICIOUS_SCORE',
    `Suspicious score logged [${fullEntry.severity}]: ${entry.score} on ${entry.gameId} (${entry.reason})${entry.flaggedOnly ? ' [FLAGGED ONLY]' : ' [REJECTED]'}`,
    fullEntry,
    entry.userId
  );

  if (isFirestoreAvailable()) {
    const db = getDb();
    await db.collection('suspiciousScores').doc(fullEntry.id).set(fullEntry);
  } else if (process.env.NODE_ENV !== 'production') {
    memoryStore.suspiciousScores.push(fullEntry);
  }

  // Trigger automated strike & account suspension policy for hard anti-cheat violations
  if (!entry.flaggedOnly && entry.userId && (fullEntry.severity === 'CRITICAL' || fullEntry.severity === 'HIGH')) {
    await recordSecurityStrike(
      entry.userId,
      entry.reason,
      fullEntry.severity,
      false,
      entry.clientIp
    ).catch(() => {});
  }

  return fullEntry;
}

export interface SuspiciousScoreFilter {
  gameId?: string;
  userId?: string;
  severity?: AnomalySeverity;
  limit?: number;
}

export async function getSuspiciousScores(filter?: SuspiciousScoreFilter): Promise<StoredSuspiciousScore[]> {
  assertPersistenceOperational();
  const limit = Math.min(100, Math.max(1, filter?.limit || 100));

  if (isFirestoreAvailable()) {
    const db = getDb();
    const hasFilter = Boolean(filter?.gameId || filter?.userId || filter?.severity);
    const fetchLimit = hasFilter ? 250 : limit;
    const snapshot = await db.collection('suspiciousScores')
      .orderBy('timestamp', 'desc')
      .limit(fetchLimit)
      .get();

    let list = snapshot.docs.map(d => d.data() as StoredSuspiciousScore);
    if (filter?.gameId) {
      list = list.filter(s => s.gameId === filter.gameId);
    }
    if (filter?.userId) {
      list = list.filter(s => s.userId === filter.userId);
    }
    if (filter?.severity) {
      list = list.filter(s => s.severity === filter.severity);
    }
    return list.slice(0, limit);
  } else {
    let list = [...memoryStore.suspiciousScores];
    if (filter?.gameId) {
      list = list.filter(s => s.gameId === filter.gameId);
    }
    if (filter?.userId) {
      list = list.filter(s => s.userId === filter.userId);
    }
    if (filter?.severity) {
      list = list.filter(s => s.severity === filter.severity);
    }
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return list.slice(0, limit);
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

export async function getRealAdminStats(): Promise<{
  success: boolean;
  suspiciousScoresCount: number;
  recentSuspicious: StoredSuspiciousScore[];
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  totalLedgerTransactions: number;
  activeSessionsCount: number;
  bannedUsersCount: number;
  securityEventsCount: number;
  serverTime: string;
}> {
  assertPersistenceOperational();
  const suspicious = await getSuspiciousScores({ limit: 100 });
  const flaggedUsers = await getFlaggedAndBannedUsers(100);
  const securityEvents = await getSecurityEvents(50);

  const severityBreakdown = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  for (const s of suspicious) {
    const sev = s.severity || 'HIGH';
    if (sev === 'CRITICAL') severityBreakdown.critical++;
    else if (sev === 'HIGH') severityBreakdown.high++;
    else if (sev === 'MEDIUM') severityBreakdown.medium++;
    else if (sev === 'LOW') severityBreakdown.low++;
  }

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

  const bannedUsersCount = flaggedUsers.filter(u => u.isBanned).length;

  return {
    success: true,
    suspiciousScoresCount: suspicious.length,
    recentSuspicious: suspicious.slice(0, 10),
    severityBreakdown,
    totalLedgerTransactions,
    activeSessionsCount,
    bannedUsersCount,
    securityEventsCount: securityEvents.length,
    serverTime: new Date().toISOString()
  };
}

