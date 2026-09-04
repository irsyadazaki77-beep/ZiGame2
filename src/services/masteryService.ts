import { GameMastery, MasteryTierReward, GameStats } from '../types';
import { GAME_BALANCE_CONFIG, PROGRESSION_CONFIG } from '../config/balanceConfig';

export const MASTERY_TITLES: Record<string, { [level: number]: string }> = {
  'snake': {
    5: 'SNAKE_CHARMER',
    10: 'VIPER_STRIKER',
    15: 'ANACONDA_TITAN',
    20: 'OUROBOROS_LEGEND'
  },
  'cyber-clicker': {
    5: 'CLICK_APPRENTICE',
    10: 'TURBO_TAPPER',
    15: 'QUANTUM_CLICKER',
    20: 'NEO_CYBER_OVERLORD'
  },
  'brick-breaker': {
    5: 'PADDLE_ROOKIE',
    10: 'SHATTER_ARTISAN',
    15: 'BRICK_ANNIHILATOR',
    20: 'PRISM_DEFENDER'
  },
  'space-defender': {
    5: 'STAR_PILOT',
    10: 'LASER_COMMANDER',
    15: 'GALAXY_STORM',
    20: 'VOID_DESTROYER'
  },
  'neon-2048': {
    5: 'TILE_CALCULATOR',
    10: 'FUSION_ARCHITECT',
    15: 'MATRIX_BREAKER',
    20: 'SINGULARITY_MASTER'
  },
  'flappy-pixel': {
    5: 'WING_GLIDER',
    10: 'OBSTACLE_DODGER',
    15: 'GRAVITY_DEFIER',
    20: 'AETHER_SOARER'
  },
  'default': {
    5: 'ARCADE_APPRENTICE',
    10: 'SKILL_OPERATOR',
    15: 'ELITE_CHAMPION',
    20: 'ARCADE_GRANDMASTER'
  }
};

export const MASTERY_TIER_REWARDS: MasteryTierReward[] = [
  { level: 5, title: 'Mastery Tier I', badge: '🥉', rewardType: 'title', rewardValue: 'TIER_1_TITLE' },
  { level: 10, title: 'Mastery Tier II', badge: '🥈', rewardType: 'coins', rewardValue: 250 },
  { level: 15, title: 'Mastery Tier III', badge: '🥇', rewardType: 'avatar', rewardValue: '👑' },
  { level: 20, title: 'Mastery Tier IV', badge: '💎', rewardType: 'theme', rewardValue: '#ec4899' },
  { level: 25, title: 'Mastery Grandmaster', badge: '🌌', rewardType: 'coins', rewardValue: 1000 }
];

export const masteryService = {
  getMasteries(): Record<string, GameMastery> {
    try {
      const raw = localStorage.getItem('zigame_game_masteries_v2');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  saveMasteries(masteries: Record<string, GameMastery>) {
    try {
      localStorage.setItem('zigame_game_masteries_v2', JSON.stringify(masteries));
    } catch {
      // Storage quota safe
    }
  },

  getGameMastery(gameId: string): GameMastery {
    const all = this.getMasteries();
    if (!all[gameId]) {
      return {
        gameId,
        xp: 0,
        level: 1,
        milestonesUnlocked: [],
        highestScore: 0,
        totalPlays: 0
      };
    }
    return all[gameId];
  },

  calculateLevelFromXp(xp: number): number {
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    return Math.min(level, PROGRESSION_CONFIG.masteryMaxLevel);
  },

  getXpForNextLevel(currentLevel: number): { currentLevelXp: number; nextLevelXp: number; percent: number; xpInLevel: number; requiredXpInLevel: number } {
    const currentLevelXp = Math.pow(currentLevel - 1, 2) * 100;
    const nextLevelXp = Math.pow(currentLevel, 2) * 100;
    const requiredXpInLevel = nextLevelXp - currentLevelXp;
    return {
      currentLevelXp,
      nextLevelXp,
      percent: 0,
      xpInLevel: 0,
      requiredXpInLevel
    };
  },

  recordGameSession(
    gameId: string, 
    score: number, 
    durationMs: number, 
    isPersonalBest: boolean = false,
    eventMultiplier: number = 1.0
  ): { 
    mastery: GameMastery; 
    xpEarned: number; 
    leveledUp: boolean; 
    unlockedRewards: MasteryTierReward[];
    newTitle?: string;
  } {
    const all = this.getMasteries();
    const current = this.getGameMastery(gameId);
    const config = GAME_BALANCE_CONFIG[gameId] || GAME_BALANCE_CONFIG['default'];

    // Balanced XP calculation
    const baseScoreXp = Math.min(score * config.baseXpMultiplier, 300);
    const playXp = PROGRESSION_CONFIG.masteryXpPerPlay;
    const pbXp = isPersonalBest ? PROGRESSION_CONFIG.masteryXpPerPersonalBest : 0;
    const durationBonus = Math.min(Math.floor(durationMs / 10000) * 5, 50);

    const rawXp = (baseScoreXp + playXp + pbXp + durationBonus) * config.masteryDifficultyWeight;
    const xpEarned = Math.round(rawXp * eventMultiplier);

    const newXp = current.xp + xpEarned;
    const oldLevel = current.level;
    const newLevel = this.calculateLevelFromXp(newXp);
    const leveledUp = newLevel > oldLevel;

    const newHighest = Math.max(current.highestScore, score);
    const newPlays = current.totalPlays + 1;

    // Check unlocked milestones/rewards
    const unlockedRewards: MasteryTierReward[] = [];
    if (leveledUp) {
      for (const reward of MASTERY_TIER_REWARDS) {
        if (oldLevel < reward.level && newLevel >= reward.level) {
          unlockedRewards.push(reward);
        }
      }
    }

    let newTitle: string | undefined = undefined;
    const titleDict = MASTERY_TITLES[gameId] || MASTERY_TITLES['default'];
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
      if (titleDict[lvl]) {
        newTitle = titleDict[lvl];
      }
    }

    const updated: GameMastery = {
      gameId,
      xp: newXp,
      level: newLevel,
      milestonesUnlocked: current.milestonesUnlocked,
      highestScore: newHighest,
      totalPlays: newPlays,
      lastEarnedAt: Date.now()
    };

    all[gameId] = updated;
    this.saveMasteries(all);

    return {
      mastery: updated,
      xpEarned,
      leveledUp,
      unlockedRewards,
      newTitle
    };
  },

  getHighestMastery(games: GameStats[]): { gameTitle: string; gameId: string; level: number; xp: number; icon: string } | null {
    const all = this.getMasteries();
    let highest: { gameTitle: string; gameId: string; level: number; xp: number; icon: string } | null = null;

    for (const game of games) {
      const m = all[game.id];
      if (m && (!highest || m.level > highest.level || (m.level === highest.level && m.xp > highest.xp))) {
        highest = {
          gameTitle: game.title,
          gameId: game.id,
          level: m.level,
          xp: m.xp,
          icon: game.icon
        };
      }
    }

    return highest;
  }
};
