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

import firebaseAppletConfig from '../../../firebase-applet-config.json';

export function isFirestoreAvailable(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return false;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (process.env.NODE_ENV !== 'production') {
      return false;
    }
  }
  if (getApps().length === 0) return false;
  return true;
}

export function getDb(): Firestore {
  const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId;
  if (dbId && dbId !== '(default)') {
    return getFirestore(getApps()[0], dbId);
  }
  return getFirestore();
}

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

export function isPersistenceReady(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return isFirestoreAvailable();
  }
  return true;
}
