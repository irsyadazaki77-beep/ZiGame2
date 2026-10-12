import { AudioController } from '../../sdk/audioController';
import { inputManager } from '../../services/inputService';
import { telemetryService } from '../../services/telemetryService';
import { performanceService } from '../../services/performanceService';
import { PlayerProfile } from '../../types/player';
import { CompetitiveProfile } from '../../types/competitive';
import { EconomyState } from '../../types/economy';
import { GameSessionTicket } from '../../types/gameSdk';
import { LeaderboardEntry } from '../../types/game';

export function createTestUser(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  const uid = overrides.uid || `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return {
    uid,
    displayName: `Player_${uid.slice(-4)}`,
    email: `${uid}@example.com`,
    photoURL: 'https://example.com/avatar.png',
    level: 1,
    xp: 0,
    coins: 100,
    unlockedAvatars: ['🎮', '🕹️', '👾'],
    unlockedThemes: ['indigo', 'emerald'],
    equippedAvatar: '🎮',
    equippedTheme: 'indigo',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    ...overrides,
  };
}

export function createAdminUser(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return createTestUser({
    uid: `admin-${Date.now()}`,
    displayName: 'System Admin',
    email: 'admin@zigame.com',
    ...overrides,
  });
}

export function createGameSession(overrides: Partial<GameSessionTicket> = {}): GameSessionTicket {
  const sessionId = overrides.sessionId || `ses_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  return {
    sessionId,
    userId: overrides.userId || 'test-user-1',
    gameId: overrides.gameId || 'snake',
    mode: overrides.mode || 'casual',
    nonce: `nonce_${Date.now()}`,
    startTime: Date.now() - 5000,
    expiresAt: Date.now() + 600000,
    consumed: false,
    gameVersion: '2.0.0',
    balanceVersion: '2.0.0',
    rulesetVersion: '2.0.0',
    ...overrides,
  };
}

export function createEconomyState(overrides: Partial<EconomyState> = {}): EconomyState {
  return {
    userId: overrides.userId || 'test-user-1',
    coins: 100,
    inventory: ['av_default'],
    lastSpinTimestamp: 0,
    totalXp: 0,
    level: 1,
    ...overrides,
  };
}

export function createLeaderboardEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    gameId: overrides.gameId || 'snake',
    userId: overrides.userId || 'test-user-1',
    playerName: overrides.playerName || 'TestPlayer',
    playerAvatar: overrides.playerAvatar || '🎮',
    score: overrides.score || 100,
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createCompetitiveProfile(overrides: Partial<CompetitiveProfile> = {}): CompetitiveProfile {
  return {
    userId: overrides.userId || 'test-user-1',
    globalRating: 1000,
    globalTier: 'Bronze',
    peakGlobalRating: 1000,
    gameRatings: {},
    rankedGames: 0,
    lastUpdated: Date.now(),
    seasonId: 'season_2026_q3',
    ...overrides,
  };
}

/**
 * Resets all singleton state between tests to maintain test isolation.
 */
export function resetSingletonServices(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }

  // Telemetry service
  try {
    telemetryService.recordGameStart('snake');
  } catch (e) {}

  // Performance service
  try {
    performanceService.setTier('high', true);
  } catch (e) {}
}
