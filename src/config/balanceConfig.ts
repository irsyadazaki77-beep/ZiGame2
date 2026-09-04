/**
 * ZiGame Central Balancing & Economy Configuration
 * Balance Version: 2.5.0
 * 
 * All economy rates, progression curves, seasons, events, and challenge
 * tuning variables are centralized here to avoid hardcoded fragmentation.
 */

export const BALANCE_VERSION = "2.5.0";

export interface GameBalanceConfig {
  baseCoinMultiplier: number;
  baseXpMultiplier: number;
  maxScoreCeiling: number;
  idealPlayDurationSec: number;
  masteryDifficultyWeight: number;
}

export const GAME_BALANCE_CONFIG: Record<string, GameBalanceConfig> = {
  'snake': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 50000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'cyber-clicker': { baseCoinMultiplier: 0.005, baseXpMultiplier: 0.01, maxScoreCeiling: 1000000, idealPlayDurationSec: 45, masteryDifficultyWeight: 0.8 },
  'brick-breaker': { baseCoinMultiplier: 0.08, baseXpMultiplier: 0.12, maxScoreCeiling: 200000, idealPlayDurationSec: 90, masteryDifficultyWeight: 1.2 },
  'space-defender': { baseCoinMultiplier: 0.05, baseXpMultiplier: 0.1, maxScoreCeiling: 300000, idealPlayDurationSec: 120, masteryDifficultyWeight: 1.3 },
  'neon-2048': { baseCoinMultiplier: 0.04, baseXpMultiplier: 0.08, maxScoreCeiling: 500000, idealPlayDurationSec: 180, masteryDifficultyWeight: 1.1 },
  'flappy-pixel': { baseCoinMultiplier: 0.5, baseXpMultiplier: 0.8, maxScoreCeiling: 10000, idealPlayDurationSec: 30, masteryDifficultyWeight: 1.4 },
  'memory-matrix': { baseCoinMultiplier: 0.15, baseXpMultiplier: 0.2, maxScoreCeiling: 50000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 },
  'minesweeper': { baseCoinMultiplier: 0.2, baseXpMultiplier: 0.25, maxScoreCeiling: 30000, idealPlayDurationSec: 75, masteryDifficultyWeight: 1.2 },
  'tetris': { baseCoinMultiplier: 0.06, baseXpMultiplier: 0.1, maxScoreCeiling: 400000, idealPlayDurationSec: 150, masteryDifficultyWeight: 1.25 },
  'jumprope': { baseCoinMultiplier: 0.3, baseXpMultiplier: 0.5, maxScoreCeiling: 15000, idealPlayDurationSec: 40, masteryDifficultyWeight: 1.1 },
  'default': { baseCoinMultiplier: 0.1, baseXpMultiplier: 0.15, maxScoreCeiling: 250000, idealPlayDurationSec: 60, masteryDifficultyWeight: 1.0 }
};

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
