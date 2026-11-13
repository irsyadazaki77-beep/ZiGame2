import { getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { serverLogger } from '../logger';
import { ApiError } from '../errors';
import { CanonicalGameId } from '../../config/canonicalGames';

export interface StoredGameSession {
  sessionId: string;
  userId: string;
  gameId: CanonicalGameId;
  nonce: string;
  signature?: string;
  startTime: number;
  expiresAt: number;
  consumed: boolean;
  consumedAt?: number;
  invalidatedReason?: string;
  isRanked?: boolean;
  seasonId?: string;
  gameVersion?: string;
  balanceVersion?: string;
  rulesetVersion?: string;
  createdAt?: number;
}

export interface StoredUserSecurity {
  userId: string;
  strikeCount: number;
  isBanned: boolean;
  banReason?: string;
  bannedAt?: string;
  banExpiresAt?: number | null;
  bannedBy?: string;
  lastViolationAt?: string;
}

export interface StoredSecurityEvent {
  id: string;
  userId?: string;
  clientIp?: string;
  eventType: string;
  severity: AnomalySeverity;
  reason: string;
  path?: string;
  timestamp: string;
}

export interface StoredEconomy {
  userId: string;
  coins: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: number;
}

export interface StoredUserProgression {
  userId: string;
  totalXp: number;
  level: number;
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
  entryType?: 'DEBIT' | 'CREDIT';
  debitAccount?: string;
  creditAccount?: string;
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

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface StoredSuspiciousScore {
  id: string;
  sessionId: string;
  userId: string;
  gameId: string;
  score: number;
  durationMs: number;
  velocity: number;
  reason: string;
  severity?: AnomalySeverity;
  flaggedOnly?: boolean;
  requestId?: string;
  clientIp?: string;
  timestamp: string;
}

export interface StoredGameHistoryEntry {
  historyId: string;
  userId: string;
  sessionId: string;
  gameId: CanonicalGameId;
  genre: string;
  score: number;
  isPersonalBest: boolean;
  timestamp: number;
  dateStr: string;
  weekStr: string;
  seasonId: string;
  isRanked?: boolean;
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

export class InMemoryStore {
  sessions = new Map<string, StoredGameSession>();
  economies = new Map<string, StoredEconomy>();
  userProgression = new Map<string, StoredUserProgression>();
  inventory = new Map<string, Set<string>>();
  spins = new Map<string, { lastSpinDate: string; count: number; updatedAt: number }>();
  leaderboards = new Map<string, StoredLeaderboardEntry[]>();
  rankedLeaderboards = new Map<string, StoredLeaderboardEntry[]>();
  seasonalLeaderboards = new Map<string, Map<string, StoredLeaderboardEntry[]>>();
  competitiveProfiles = new Map<string, StoredCompetitiveProfile>();
  processedActions = new Map<string, { result: any; timestamp: number; payloadHash?: string }>();
  suspiciousScores: StoredSuspiciousScore[] = [];
  ledger: StoredEconomyTransaction[] = [];
  claimedRewards = new Map<string, Set<string>>();
  gameHistory: StoredGameHistoryEntry[] = [];
  userSecurity = new Map<string, StoredUserSecurity>();
  securityEvents: StoredSecurityEvent[] = [];

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
    this.userSecurity.clear();
    this.securityEvents = [];
  }
}

export const memoryStore = new InMemoryStore();

import fs from 'fs';
import firebaseAppletConfig from '../../../firebase-applet-config.json';

let firestoreDevDisabled = false;
const configuredDbs = new WeakSet<Firestore>();

function hasValidServiceAccountJson(raw: string | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && parsed.project_id) return true;
  } catch {}
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === 'object' && parsed.project_id) return true;
  } catch {}
  return false;
}

function hasValidAdcFile(rawPath: string | undefined): boolean {
  if (!rawPath || typeof rawPath !== 'string') return false;
  const trimmed = rawPath.trim();
  if (!trimmed) return false;
  try {
    return fs.existsSync(trimmed);
  } catch {
    return false;
  }
}

export function isFirestoreAvailable(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return false;
  if (getApps().length === 0) return false;

  if (process.env.NODE_ENV !== 'production') {
    if (firestoreDevDisabled) return false;
    const hasSa = hasValidServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT);
    const hasGac = hasValidAdcFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (!hasSa && !hasGac) {
      return false;
    }
  } else {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Production can still use Cloud Run implicit ADC when app is initialized
      return getApps().length > 0;
    }
  }
  return true;
}

export function getDb(): Firestore {
  const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId;
  const db = dbId && dbId !== '(default)'
    ? getFirestore(getApps()[0], dbId)
    : getFirestore();

  if (!configuredDbs.has(db)) {
    configuredDbs.add(db);
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Settings already applied on this Firestore instance
    }
  }

  return db;
}

export async function probeFirestoreAvailability(timeoutMs: number = 3000): Promise<boolean> {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return isFirestoreAvailable();
  }
  if (!isFirestoreAvailable()) {
    return false;
  }

  try {
    const db = getDb();
    await Promise.race([
      db.collection('seasons').limit(1).get(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('FIRESTORE_PROBE_TIMEOUT')), timeoutMs)
      )
    ]);
    return true;
  } catch (err) {
    firestoreDevDisabled = true;
    serverLogger.warn(
      'PERSISTENCE_DEV_FALLBACK',
      'Firestore unreachable or lacks permissions in dev; falling back to InMemoryStore.',
      { error: err instanceof Error ? err.message : String(err) }
    );
    return false;
  }
}

export function assertPersistenceOperational() {
  if (process.env.NODE_ENV === 'production' && !isFirestoreAvailable()) {
    if (process.env.ALLOW_IN_MEMORY_PROD === 'true') {
      serverLogger.warn('PERSISTENCE_OVERRIDE', 'InMemoryStore fallback permitted in production via explicit ALLOW_IN_MEMORY_PROD=true flag.');
      return;
    }
    serverLogger.security('FIREBASE_FAILURE', 'Database persistence unavailable in production: InMemoryStore prohibited without ALLOW_IN_MEMORY_PROD=true');
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
    if (process.env.ALLOW_IN_MEMORY_PROD === 'true') {
      return { status: 'ok', persistence: 'degraded' };
    }
    return { status: 'degraded', persistence: 'unavailable' };
  }
  return { status: 'ok', persistence: 'degraded' };
}

export function isPersistenceReady(): boolean {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ALLOW_IN_MEMORY_PROD === 'true') {
      return true;
    }
    return isFirestoreAvailable();
  }
  return true;
}

// Explicit environment notification for persistence store
if (process.env.NODE_ENV !== 'production' && !process.env.VITEST && process.env.NODE_ENV !== 'test') {
  serverLogger.info('PERSISTENCE_DEV', 'Running in development mode: utilizing InMemoryStore adapter with stateful cache.');
} else if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_PROD === 'true') {
  serverLogger.warn('PERSISTENCE_PROD_OVERRIDE', 'Production running with InMemoryStore override (ALLOW_IN_MEMORY_PROD=true).');
}
