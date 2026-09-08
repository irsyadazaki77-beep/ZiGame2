import { GameStats } from '../types';
import { getGameBalanceConfig } from '../config/balanceConfig';

export interface XpCalculationResult {
  earnedXp: number;
  performanceBonus: number;
  difficultyBonus: number;
  durationBonus: number;
}

class ProgressionService {
  /**
   * Calculate level based on total XP.
   * Progression curve:
   * Level 1-10: 100 * level^2 / 2 approx
   * Actually, let's use a clear formula:
   * xp_req_for_level(L) = 
   * L <= 10: (L-1) * 150
   * L <= 30: (10 * 150) + (L-10) * 350
   * L > 30: (10 * 150) + (20 * 350) + (L-30) * 800
   * Wait, these are flat increments. Let's make it cumulative.
   */
  getXpRequiredForLevel(level: number): number {
    if (level <= 1) return 0;
    
    let totalXp = 0;
    for (let i = 1; i < level; i++) {
      if (i < 10) totalXp += i * 150;
      else if (i < 30) totalXp += 1350 + (i - 9) * 300;
      else totalXp += 7350 + (i - 29) * 600;
    }
    return totalXp;
  }

  calculateLevel(totalXp: number): { level: number; nextLevelXp: number; currentLevelXp: number; progressPercent: number } {
    let level = 1;
    while (true) {
      const nextLevelXp = this.getXpRequiredForLevel(level + 1);
      if (totalXp >= nextLevelXp) {
        level++;
      } else {
        const currentLevelXp = this.getXpRequiredForLevel(level);
        const progressInLevel = totalXp - currentLevelXp;
        const xpNeededForNext = nextLevelXp - currentLevelXp;
        const progressPercent = Math.min(100, Math.max(0, (progressInLevel / xpNeededForNext) * 100));
        
        return {
          level,
          currentLevelXp,
          nextLevelXp,
          progressPercent
        };
      }
    }
  }

  /**
   * Mastery is game specific.
   * We can calculate it based on Mastery XP.
   * 1-5 mastery levels.
   */
  calculateMasteryLevel(masteryXp: number): { level: number; maxLevel: boolean; title: string } {
    const MAX_MASTERY_LEVEL = 5;
    const thresholds = [0, 500, 1500, 3500, 7000];
    const titles = ['Rookie', 'Skilled', 'Expert', 'Elite', 'Master'];
    
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (masteryXp >= thresholds[i]) {
        const currentLevel = i + 1;
        return {
          level: Math.min(currentLevel, MAX_MASTERY_LEVEL),
          maxLevel: currentLevel >= MAX_MASTERY_LEVEL,
          title: titles[i]
        };
      }
    }
    return { level: 1, maxLevel: false, title: 'Rookie' };
  }

  /**
   * Calculates XP earned from a single game session based on Balance Config.
   */
  calculateSessionXp(
    gameId: string,
    score: number,
    durationSec: number
  ): XpCalculationResult {
    const config = getGameBalanceConfig(gameId);
    
    // 1. Base Score XP using config multiplier
    const rawXp = score * config.baseXpMultiplier;
    
    // Cap raw XP per second to prevent exploits
    const maxRawXp = durationSec * config.maxScorePerSec * config.baseXpMultiplier;
    const baseXp = Math.floor(Math.min(rawXp, maxRawXp));
    
    // 2. Duration Bonus (Encourage playing without rewarding AFK too much)
    // Reward for playing closer to idealPlayDurationSec
    const effectiveDuration = Math.min(durationSec, config.idealPlayDurationSec);
    const durationBonus = Math.floor(effectiveDuration * 1.5); 
    
    // 3. Difficulty Multiplier (Mastery Weight from config)
    const difficultyMultiplier = config.masteryDifficultyWeight || 1.0;
    
    // 4. Performance Bonus (Incredible pace)
    let performanceBonus = 0;
    const scorePerSec = durationSec > 0 ? score / durationSec : 0;
    
    if (scorePerSec > (config.maxScorePerSec * 0.8)) {
      performanceBonus = Math.floor(baseXp * 0.2); // 20% bonus for playing optimally
    } else if (scorePerSec > (config.maxScorePerSec * 0.5)) {
      performanceBonus = Math.floor(baseXp * 0.1); // 10% bonus
    }
    
    const difficultyBonus = Math.floor(baseXp * (difficultyMultiplier - 1.0));
    
    // Diminishing returns cap on extreme sessions
    let totalEarnedXp = baseXp + durationBonus + difficultyBonus + performanceBonus;
    const absoluteMaxXp = 5000;
    if (totalEarnedXp > absoluteMaxXp) {
        totalEarnedXp = absoluteMaxXp;
    }
    
    return {
      earnedXp: totalEarnedXp,
      performanceBonus,
      difficultyBonus,
      durationBonus
    };
  }
}

export const progressionService = new ProgressionService();
