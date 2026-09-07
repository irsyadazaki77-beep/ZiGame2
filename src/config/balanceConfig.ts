/**
 * ZiGame Central Balancing & Economy Configuration
 * Balance Version: 2.5.0
 * 
 * All economy rates, progression curves, seasons, events, and challenge
 * tuning variables are centralized here to avoid hardcoded fragmentation.
 */

import { CanonicalGameId, CANONICAL_GAME_IDS, toCanonicalGameId } from './canonicalGames';

/**
 * ZiGame Central Balancing & Economy Configuration
 * Balance Version: 2.0.0
 * 
 * All economy rates, progression curves, seasons, events, and challenge
 * tuning variables are centralized here to avoid hardcoded fragmentation.
 */

export const BALANCE_VERSION = "2.0.0";

export interface GameBalanceConfig {
  baseCoinMultiplier: number;
  baseXpMultiplier: number;
  maxScoreCeiling: number;
  maxScorePerSec: number;
  minDurationMs: number;
  idealPlayDurationSec: number;
  masteryDifficultyWeight: number;
}

export const GAME_BALANCE_CONFIG: Record<string, GameBalanceConfig> = {
  'snake': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 50000, maxScorePerSec: 150, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'cyber-clicker': { baseCoinMultiplier: 0.005, baseXpMultiplier: 0.01, maxScoreCeiling: 1000000, maxScorePerSec: 300, minDurationMs: 1000, idealPlayDurationSec: 45, masteryDifficultyWeight: 0.8 },
  'brick-breaker': { baseCoinMultiplier: 0.08, baseXpMultiplier: 0.12, maxScoreCeiling: 200000, maxScorePerSec: 300, minDurationMs: 3000, idealPlayDurationSec: 90, masteryDifficultyWeight: 1.2 },
  'space-defender': { baseCoinMultiplier: 0.05, baseXpMultiplier: 0.1, maxScoreCeiling: 300000, maxScorePerSec: 500, minDurationMs: 3000, idealPlayDurationSec: 120, masteryDifficultyWeight: 1.3 },
  'neon-2048': { baseCoinMultiplier: 0.04, baseXpMultiplier: 0.08, maxScoreCeiling: 500000, maxScorePerSec: 400, minDurationMs: 5000, idealPlayDurationSec: 180, masteryDifficultyWeight: 1.1 },
  'flappy-pixel': { baseCoinMultiplier: 0.5, baseXpMultiplier: 0.8, maxScoreCeiling: 10000, maxScorePerSec: 50, minDurationMs: 2000, idealPlayDurationSec: 30, masteryDifficultyWeight: 1.4 },
  'memory-grid': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.2, maxScoreCeiling: 50000, maxScorePerSec: 200, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'cyber-runner': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 100000, maxScorePerSec: 250, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.2 },
  'neon-pong': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 50000, maxScorePerSec: 150, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'neon-stacker': { baseCoinMultiplier: 0.12, baseXpMultiplier: 0.18, maxScoreCeiling: 50000, maxScorePerSec: 200, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.1 },
  'vaporwave-racer': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.2, maxScoreCeiling: 150000, maxScorePerSec: 350, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.3 },
  'lock-breaker': { baseCoinMultiplier: 0.2, baseXpMultiplier: 0.25, maxScoreCeiling: 30000, maxScorePerSec: 100, minDurationMs: 2000, idealPlayDurationSec: 45, masteryDifficultyWeight: 0.9 },
  'sine-rider': { baseCoinMultiplier: 0.12, baseXpMultiplier: 0.18, maxScoreCeiling: 80000, maxScorePerSec: 200, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.1 },
  'cosmic-dodge': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.2, maxScoreCeiling: 100000, maxScorePerSec: 250, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.2 },
  'laser-grid': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.2, maxScoreCeiling: 60000, maxScorePerSec: 150, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.1 },
  'cyber-simon': { baseCoinMultiplier: 0.2, baseXpMultiplier: 0.3, maxScoreCeiling: 40000, maxScorePerSec: 100, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'plinko-neo': { baseCoinMultiplier: 0.08, baseXpMultiplier: 0.12, maxScoreCeiling: 200000, maxScorePerSec: 400, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 0.9 },
  'cosmic-asteroid': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 120000, maxScorePerSec: 300, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.2 },
  'cyber-slasher': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 150000, maxScorePerSec: 350, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.1 },
  'block-match': { baseCoinMultiplier: 0.08, baseXpMultiplier: 0.12, maxScoreCeiling: 250000, maxScorePerSec: 350, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'cyber-typer': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 80000, maxScorePerSec: 200, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.2 },
  'maze-runner': { baseCoinMultiplier: 0.2, baseXpMultiplier: 0.25, maxScoreCeiling: 50000, maxScorePerSec: 150, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'memory-path': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.2, maxScoreCeiling: 50000, maxScorePerSec: 200, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'rhythm-tap': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 100000, maxScorePerSec: 250, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.2 },
  'pixel-golf': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.2, maxScoreCeiling: 50000, maxScorePerSec: 150, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'pixel-dino': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 80000, maxScorePerSec: 200, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.1 },
  'cyber-tetris': { baseCoinMultiplier: 0.06, baseXpMultiplier: 0.1, maxScoreCeiling: 400000, maxScorePerSec: 300, minDurationMs: 3000, idealPlayDurationSec: 150, masteryDifficultyWeight: 1.25 },
  'archery-neo': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 100000, maxScorePerSec: 250, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.1 },
  'cyber-mines': { baseCoinMultiplier: 0.2, baseXpMultiplier: 0.25, maxScoreCeiling: 30000, maxScorePerSec: 150, minDurationMs: 2000, idealPlayDurationSec: 75, masteryDifficultyWeight: 1.2 },
  'whack-a-drone': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 80000, maxScorePerSec: 200, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'jump-rope': { baseCoinMultiplier: 0.3, baseXpMultiplier: 0.5, maxScoreCeiling: 15000, maxScorePerSec: 100, minDurationMs: 1500, idealPlayDurationSec: 40, masteryDifficultyWeight: 1.1 },
  'neon-drift': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.2, maxScoreCeiling: 120000, maxScorePerSec: 300, minDurationMs: 2000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.2 },
  'neon-heist': { baseCoinMultiplier: 0.2, baseXpMultiplier: 0.3, maxScoreCeiling: 80000, maxScorePerSec: 250, minDurationMs: 3000, idealPlayDurationSec: 120, masteryDifficultyWeight: 1.25 },
  'void-survivor': { baseCoinMultiplier: 0.08, baseXpMultiplier: 0.15, maxScoreCeiling: 500000, maxScorePerSec: 400, minDurationMs: 4000, idealPlayDurationSec: 180, masteryDifficultyWeight: 1.35 },
  'orbital-defense': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.2, maxScoreCeiling: 200000, maxScorePerSec: 300, minDurationMs: 4000, idealPlayDurationSec: 180, masteryDifficultyWeight: 1.2 },
  'gravity-shift': { baseCoinMultiplier: 0.2, baseXpMultiplier: 0.25, maxScoreCeiling: 60000, maxScorePerSec: 200, minDurationMs: 2000, idealPlayDurationSec: 90, masteryDifficultyWeight: 1.3 },
  'hex-dominion': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.25, maxScoreCeiling: 150000, maxScorePerSec: 250, minDurationMs: 5000, idealPlayDurationSec: 240, masteryDifficultyWeight: 1.3 },
  'default': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 250000, maxScorePerSec: 350, minDurationMs: 1500, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 }
};

export function getGameBalanceConfig(gameId: string): GameBalanceConfig {
  const canonicalId = toCanonicalGameId(gameId);
  return GAME_BALANCE_CONFIG[canonicalId] || GAME_BALANCE_CONFIG['default'];
}

export const PROGRESSION_CONFIG = {
  // Mastery level formula: level = floor(sqrt(xp / 100)) + 1
  masteryXpPerScore: 0.1,
  masteryXpPerPlay: 25,
  masteryXpPerPersonalBest: 150,
  masteryMaxLevel: 30,
  
  // Player Level XP formula: required XP = level * 250
  playerLevelBaseXp: 250,
  playerLevelGrowth: 1.2,
  
  // Starter rewards
  starterCoins: 100,
  starterTitle: 'NEO_RECRUIT',
  starterBadges: ['badge_first_step']
};

export const SEASON_CONFIG = {
  activeSeason: {
    id: 'season_1',
    name: 'Season 1: Neon Cyber Genesis',
    theme: '#6366f1',
    themeName: 'Cyber Indigo',
    description: 'Buktikan ketangguhanmu di era pertama ZiGame. Kumpulkan Cyber Shards & raih gelar Cyber Vanguard!',
    startAt: '2026-08-01T00:00:00Z',
    endAt: '2026-09-30T23:59:59Z',
    featuredGames: ['space-defender', 'brick-breaker', 'snake'],
    badgeReward: {
      id: 'badge_season_1_master',
      name: 'Cyber Vanguard 2026',
      icon: '🛡️',
      description: 'Diberikan kepada pemain berprestasi pada Season 1: Neon Cyber Genesis.'
    },
    cosmeticReward: {
      id: 'avatar_season_1_cyber_dragon',
      name: 'Cyber Dragon',
      icon: '🐉',
      type: 'avatar' as const,
      cost: 0
    }
  }
};

export const EVENT_CONFIG = {
  events: [
    {
      id: 'evt_double_xp_weekend',
      name: '⚡ Double XP Weekend',
      description: 'Dapatkan 2x XP untuk setiap game yang Anda mainkan sepanjang akhir pekan!',
      icon: '⚡',
      badgeColor: 'from-amber-500 to-orange-600',
      startAt: '2026-08-14T00:00:00Z',
      endAt: '2026-08-18T23:59:59Z',
      targetGames: ['all'],
      xpMultiplier: 2.0,
      coinMultiplier: 1.0,
      specialRule: 'Double XP on all arcade games'
    },
    {
      id: 'evt_shooter_frenzy',
      name: '🚀 Space Shooter Frenzy',
      description: 'Bonus 1.5x Koin dan 2x Mastery XP khusus game Shooter!',
      icon: '🚀',
      badgeColor: 'from-cyan-500 to-blue-600',
      startAt: '2026-08-10T00:00:00Z',
      endAt: '2026-08-20T23:59:59Z',
      targetGames: ['space-defender'],
      xpMultiplier: 1.5,
      coinMultiplier: 1.5,
      specialRule: 'Extra coin drop in Space Defender'
    }
  ]
};

export const CHALLENGE_CONFIG = {
  dailyResetHourUtc: 0,
  weeklyResetDayUtc: 1, // Monday
  maxActiveDailyChallenges: 3,
  maxActiveWeeklyChallenges: 3
};
