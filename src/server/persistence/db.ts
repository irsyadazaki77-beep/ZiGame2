import fs from 'fs';
import path from 'path';
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

interface LocalAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function readLocalAppletConfig(): LocalAppletConfig {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (parsed?.projectId && String(parsed.projectId).includes('YOUR_FIREBASE_PROJECT_ID')) {
      return {};
    }
    return parsed || {};
  } catch {
    return {};
  }
}

let firestoreDevDisabled = false;
let firestoreProdReachable = true;
const configuredDbs = new WeakSet<Firestore>();

function isMemoryModePermitted(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || Boolean(process.env.VITEST);
}

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

export function hasValidAdcFile(rawPath: string | undefined): boolean {
  if (!rawPath || typeof rawPath !== 'string') return false;
  const trimmed = rawPath.trim();
  if (!trimmed) return false;
  try {
    const stat = fs.statSync(trimmed);
    if (!stat.isFile()) return false;
    const raw = fs.readFileSync(trimmed, 'utf-8');
    const parsed = JSON.parse(raw);
    return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
  } catch {
    return false;
  }
}

export function sanitizeInvalidAdcEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const rawPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (rawPath === undefined) return null;
  if (hasValidAdcFile(rawPath)) return null;
  delete env.GOOGLE_APPLICATION_CREDENTIALS;
  return rawPath;
}

export function isFirestoreAvailable(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return false;
  if (getApps().length === 0) return false;

  if (process.env.NODE_ENV === 'production') {
    return firestoreProdReachable && getApps().length > 0;
  }

  if (firestoreDevDisabled) return false;
  const hasSa = hasValidServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT);
  const hasGac = hasValidAdcFile(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  return hasSa || hasGac;
}

export function getDb(): Firestore {
  if (getApps().length === 0) {
    throw ApiError.serviceUnavailable('Firebase Admin SDK is not initialized.');
  }
  const localConfig = readLocalAppletConfig();
  const dbId = process.env.FIRESTORE_DATABASE_ID || process.env.VITE_FIRESTORE_DATABASE_ID || localConfig.firestoreDatabaseId;
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

async function runFirestoreProbeWithTimeout(db: Firestore, timeoutMs: number, timeoutCode: string): Promise<void> {
  let timer: NodeJS.Timeout | null = null;
  const queryPromise = db.collection('seasons').limit(1).get();
  // Ensure losing query promise never triggers an unhandled rejection after timeout settles.
  queryPromise.catch(() => {});

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  try {
    await Promise.race([queryPromise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function probeFirestoreAvailability(timeoutMs: number = 3000): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return false;
  }

  const invalidAdc = sanitizeInvalidAdcEnv(process.env);
  if (invalidAdc !== null) {
    serverLogger.warn(
      'FIREBASE_CONFIG_WARN',
      `Ignoring invalid GOOGLE_APPLICATION_CREDENTIALS ("${invalidAdc.slice(0, 30)}") before Firestore connectivity probe.`
    );
  }

  if (process.env.NODE_ENV === 'production') {
    if (getApps().length === 0) {
      firestoreProdReachable = false;
      serverLogger.fatal('PRODUCTION_FIREBASE_UNINITIALIZED', 'Firebase Admin SDK is not initialized in production.');
      return false;
    }
    try {
      const db = getDb();
      await runFirestoreProbeWithTimeout(db, timeoutMs, 'FIRESTORE_PROD_PROBE_TIMEOUT');
      firestoreProdReachable = true;
      return true;
    } catch (err) {
      firestoreProdReachable = false;
      serverLogger.fatal(
        'PRODUCTION_FIRESTORE_UNREACHABLE',
        'Firestore connectivity probe failed in production; ephemeral memoryStore fallback is forbidden.',
        err,
        { errorMessage: err instanceof Error ? err.message : String(err) }
      );
      return false;
    }
  }

  if (!isFirestoreAvailable()) {
    serverLogger.warn(
      'PERSISTENCE_DEV_MEMORY',
      'Development/Test mode: Firebase Admin credentials missing; using ephemeral InMemoryStore (never permitted in production).'
    );
    return false;
  }

  try {
    const db = getDb();
    await runFirestoreProbeWithTimeout(db, timeoutMs, 'FIRESTORE_PROBE_TIMEOUT');
    return true;
  } catch (err) {
    firestoreDevDisabled = true;
    serverLogger.warn(
      'PERSISTENCE_DEV_FALLBACK',
      'Firestore unreachable or lacks permissions in dev; falling back to ephemeral InMemoryStore.',
      { error: err instanceof Error ? err.message : String(err) }
    );
    return false;
  }
}

export function assertPersistenceOperational(): void {
  if (isFirestoreAvailable()) {
    return;
  }

  if (!isMemoryModePermitted()) {
    serverLogger.security(
      'FIREBASE_FAILURE',
      'Database persistence unavailable in production: ephemeral InMemoryStore fallback is strictly prohibited.'
    );
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
    return { status: 'unavailable', persistence: 'unavailable' };
  }
  return { status: 'ok', persistence: 'degraded' };
}

export function isPersistenceReady(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return isFirestoreAvailable();
  }
  return isMemoryModePermitted();
}

// Explicit environment notification for persistence store
if (process.env.NODE_ENV === 'development' && !process.env.VITEST) {
  serverLogger.warn(
    'PERSISTENCE_DEV_NOTICE',
    'Running in development mode: InMemoryStore fallback is permitted if Firestore is unconfigured or unreachable.'
  );
}
