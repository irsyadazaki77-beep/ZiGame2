import { GameStats } from '../types';

export interface XpCalculationResult {
  earnedXp: number;
  performanceBonus: number;
  difficultyBonus: number;
  durationBonus: number;
}

class ProgressionService {
  /**
   * Calculate level based on total XP.
   * Progression curve: Exponential requirement.
   * Level 1: 0 XP
   * Level 2: 100 XP
   * Level 3: 300 XP
   * Level 4: 600 XP
   * Formula: required_xp = (level - 1) * (level) * 50
   */
  calculateLevel(totalXp: number): { level: number; nextLevelXp: number; currentLevelXp: number; progressPercent: number } {
    let level = 1;
    while (true) {
      const requiredForNext = level * (level + 1) * 50;
      if (totalXp >= requiredForNext) {
        level++;
      } else {
        const requiredForCurrent = (level - 1) * level * 50;
        const progressInLevel = totalXp - requiredForCurrent;
        const xpNeededForNext = requiredForNext - requiredForCurrent;
        const progressPercent = Math.min(100, Math.max(0, (progressInLevel / xpNeededForNext) * 100));
        
        return {
          level,
          currentLevelXp: requiredForCurrent,
          nextLevelXp: requiredForNext,
          progressPercent
        };
      }
    }
  }

  /**
   * Calculate mastery level based on mastery XP for a specific game.
   * Mastery is faster to level up early on but caps at 10.
   */
  calculateMasteryLevel(masteryXp: number): { level: number; maxLevel: boolean } {
    const MAX_MASTERY_LEVEL = 10;
    // Simple tiered XP for mastery
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
    
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (masteryXp >= thresholds[i]) {
        const currentLevel = i + 1;
        return {
          level: Math.min(currentLevel, MAX_MASTERY_LEVEL),
          maxLevel: currentLevel >= MAX_MASTERY_LEVEL
        };
      }
    }
    return { level: 1, maxLevel: false };
  }

  /**
   * Calculates XP earned from a single game session.
   */
  calculateSessionXp(
    game: GameStats | undefined,
    score: number,
    durationSec: number
  ): XpCalculationResult {
    // 1. Base Score XP
    const baseXp = Math.floor(score / 10);
    
    // 2. Duration Bonus (Encourage playing without rewarding AFK too much)
    // Cap duration bonus at 5 minutes (300 seconds)
    const effectiveDuration = Math.min(durationSec, 300);
    const durationBonus = Math.floor(effectiveDuration * 0.5); 
    
    // 3. Difficulty Multiplier
    let difficultyMultiplier = 1.0;
    if (game?.difficulty === 'Hard') difficultyMultiplier = 1.5;
    else if (game?.difficulty === 'Medium') difficultyMultiplier = 1.2;
    
    // 4. Performance Bonus (e.g. if they scored extremely high relative to time)
    let performanceBonus = 0;
    const scorePerSec = durationSec > 0 ? score / durationSec : 0;
    
    if (scorePerSec > 50) {
      performanceBonus = 20; // Incredible pace
    } else if (scorePerSec > 20) {
      performanceBonus = 10; // Great pace
    }
    
    const difficultyBonus = Math.floor(baseXp * (difficultyMultiplier - 1.0));
    const totalEarnedXp = baseXp + durationBonus + difficultyBonus + performanceBonus;

    return {
      earnedXp: totalEarnedXp,
      performanceBonus,
      difficultyBonus,
      durationBonus
    };
  }
}

export const progressionService = new ProgressionService();
