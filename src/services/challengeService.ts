import { Challenge, GameStats } from '../types';
import { SEASON_CONFIG } from '../config/balanceConfig';

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
    const today = new Date().toISOString().split('T')[0];
    
    // Check if daily challenges need refresh
    const hasTodayDaily = existing.some(c => c.frequency === 'daily' && c.expiryDate === today);
    
    // Calculate current week id
    const now = new Date();
    const weekNum = Math.ceil((((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
    const weekId = `${now.getFullYear()}-W${weekNum}`;
    const hasThisWeek = existing.some(c => c.frequency === 'weekly' && c.expiryDate === weekId);

    let updated = existing.filter(c => {
      if (c.frequency === 'daily') return c.expiryDate === today;
      if (c.frequency === 'weekly') return c.expiryDate === weekId;
      return true; // keep special
    });

    // Generate fresh Daily Challenges
    if (!hasTodayDaily && games.length > 0) {
      const seed = now.getDate();
      const featuredGame1 = games[seed % games.length];
      const featuredGame2 = games[(seed + 3) % games.length];

      const dailyChallenges: Challenge[] = [
        {
          id: `daily_${today}_1`,
          title: `Skor Target: ${featuredGame1.title}`,
          description: `Raih minimal 100 poin dalam satu sesi di ${featuredGame1.title}`,
          frequency: 'daily',
          category: 'score',
          target: 100,
          progress: 0,
          completed: false,
          claimed: false,
          rewardCoins: 80,
          rewardXp: 120,
          gameId: featuredGame1.id,
          expiryDate: today,
          icon: '🎯'
        },
        {
          id: `daily_${today}_2`,
          title: 'Eksplorasi Multigenre',
          description: 'Mainkan 3 genre game yang berbeda hari ini',
          frequency: 'daily',
          category: 'genre',
          target: 3,
          progress: 0,
          completed: false,
          claimed: false,
          rewardCoins: 75,
          rewardXp: 100,
          expiryDate: today,
          icon: '🌐'
        },
        {
          id: `daily_${today}_3`,
          title: `Tantangan Refleks: ${featuredGame2.title}`,
          description: `Selesaikan sesi tanpa menyerah di ${featuredGame2.title}`,
          frequency: 'daily',
          category: 'featured',
          target: 1,
          progress: 0,
          completed: false,
          claimed: false,
          rewardCoins: 60,
          rewardXp: 90,
          gameId: featuredGame2.id,
          expiryDate: today,
          icon: '⚡'
        }
      ];

      updated = [...updated.filter(c => c.frequency !== 'daily'), ...dailyChallenges];
    }

    // Generate fresh Weekly Challenges
    if (!hasThisWeek && games.length > 0) {
      const weeklyChallenges: Challenge[] = [
        {
          id: `weekly_${weekId}_1`,
          title: 'Pemecah Rekor Mingguan',
          description: 'Pecahkan 2 rekor skor tertinggi (Personal Best) di game apa pun',
          frequency: 'weekly',
          category: 'personal_best',
          target: 2,
          progress: 0,
          completed: false,
          claimed: false,
          rewardCoins: 250,
          rewardXp: 400,
          expiryDate: weekId,
          icon: '🔥'
        },
        {
          id: `weekly_${weekId}_2`,
          title: 'Maraton Arcade 15 Ronde',
          description: 'Mainkan total 15 sesi permainan game apa pun minggu ini',
          frequency: 'weekly',
          category: 'endurance',
          target: 15,
          progress: 0,
          completed: false,
          claimed: false,
          rewardCoins: 200,
          rewardXp: 350,
          expiryDate: weekId,
          icon: '🕹️'
        },
        {
          id: `weekly_${weekId}_3`,
          title: 'Kolektor Skor Akbar',
          description: 'Kumpulkan akumulasi total 5,000 poin di berbagai game',
          frequency: 'weekly',
          category: 'score',
          target: 5000,
          progress: 0,
          completed: false,
          claimed: false,
          rewardCoins: 300,
          rewardXp: 500,
          expiryDate: weekId,
          icon: '🏆'
        }
      ];

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
