import { Challenge, GameStats } from '../types';
import { SEASON_CONFIG } from '../config/balanceConfig';
import { 
  getUtcTodayDateString, 
  getUtcWeekString, 
  getAuthoritativeDailyChallenges, 
  getAuthoritativeWeeklyChallenges 
} from '../config/authoritativeMissions';

export const challengeService = {
  getStoredChallenges(): Challenge[] {
    try {
      const raw = localStorage.getItem('zigame_challenges_v2');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  saveChallenges(challenges: Challenge[]) {
    try {
      localStorage.setItem('zigame_challenges_v2', JSON.stringify(challenges));
    } catch {
      // Storage safe
    }
  },

  generateChallengesIfOutdated(games: GameStats[]): Challenge[] {
    const existing = this.getStoredChallenges();
    const today = getUtcTodayDateString();
    const weekId = getUtcWeekString();
    
    // Check if daily challenges need refresh
    const hasTodayDaily = existing.some(c => c.frequency === 'daily' && c.expiryDate === today);
    const hasThisWeek = existing.some(c => c.frequency === 'weekly' && c.expiryDate === weekId);

    let updated = existing.filter(c => {
      if (c.frequency === 'daily') return c.expiryDate === today;
      if (c.frequency === 'weekly') return c.expiryDate === weekId;
      return true; // keep special
    });

    // Generate fresh Daily Challenges
    if (!hasTodayDaily && games.length > 0) {
      const dailyChallenges = getAuthoritativeDailyChallenges(today, games);
      updated = [...updated.filter(c => c.frequency !== 'daily'), ...dailyChallenges];
    }

    // Generate fresh Weekly Challenges
    if (!hasThisWeek) {
      const weeklyChallenges = getAuthoritativeWeeklyChallenges(weekId);
      updated = [...updated.filter(c => c.frequency !== 'weekly'), ...weeklyChallenges];
    }


    // Ensure Special Seasonal Challenge exists
    const seasonId = SEASON_CONFIG.activeSeason.id;
    const hasSeasonal = updated.some(c => c.id === `special_${seasonId}`);
    if (!hasSeasonal) {
      updated.push({
        id: `special_${seasonId}`,
        title: 'Cyber Genesis Vanguard',
        description: 'Capai minimal Mastery Level 5 pada salah satu game unggulan Season 1',
        frequency: 'special',
        category: 'featured',
        target: 5,
        progress: 0,
        completed: false,
        claimed: false,
        rewardCoins: 500,
        rewardXp: 1000,
        expiryDate: SEASON_CONFIG.activeSeason.endAt,
        icon: '🛡️'
      });
    }

    this.saveChallenges(updated);
    return updated;
  },

  updateChallengeProgress(
    event: {
      gameId: string;
      genre?: string;
      score: number;
      isPersonalBest: boolean;
      masteryLevel?: number;
    }
  ): { updatedChallenges: Challenge[]; newlyCompleted: Challenge[] } {
    const current = this.getStoredChallenges();
    const newlyCompleted: Challenge[] = [];

    const updated = current.map(ch => {
      if (ch.completed) return ch;

      let newProgress = ch.progress;

      // Score target in specific game
      if (ch.category === 'score' && ch.gameId && ch.gameId === event.gameId) {
        if (event.score >= ch.target) newProgress = ch.target;
      }
      // General accumulation score
      else if (ch.category === 'score' && !ch.gameId) {
        newProgress += event.score;
      }
      // Personal best breaker
      else if (ch.category === 'personal_best' && event.isPersonalBest) {
        newProgress += 1;
      }
      // Endurance plays
      else if (ch.category === 'endurance') {
        newProgress += 1;
      }
      // Featured game play
      else if (ch.category === 'featured' && ch.gameId === event.gameId) {
        newProgress += 1;
      }
      // Genre variety
      else if (ch.category === 'genre') {
        newProgress = Math.min(newProgress + 1, ch.target);
      }

      const isDone = newProgress >= ch.target;
      if (isDone && !ch.completed) {
        newlyCompleted.push({
          ...ch,
          progress: Math.min(newProgress, ch.target),
          completed: true
        });
      }

      return {
        ...ch,
        progress: Math.min(newProgress, ch.target),
        completed: isDone
      };
    });

    this.saveChallenges(updated);
    return { updatedChallenges: updated, newlyCompleted };
  },

  claimChallenge(challengeId: string): { success: boolean; coins: number; xp: number } {
    const current = this.getStoredChallenges();
    const index = current.findIndex(c => c.id === challengeId);
    if (index === -1) return { success: false, coins: 0, xp: 0 };

    const target = current[index];
    if (!target.completed || target.claimed) return { success: false, coins: 0, xp: 0 };

    current[index] = {
      ...target,
      claimed: true
    };

    this.saveChallenges(current);
    return {
      success: true,
      coins: target.rewardCoins,
      xp: target.rewardXp
    };
  }
};
