import { CompetitiveRating, CompetitiveTier } from '../types';

const STORAGE_KEY = 'zigame_competitive_ratings_v1';

const TIER_THRESHOLDS: Array<{ tier: CompetitiveTier; min: number; max: number }> = [
  { tier: 'Bronze', min: 0, max: 999 },
  { tier: 'Silver', min: 1000, max: 1399 },
  { tier: 'Gold', min: 1400, max: 1799 },
  { tier: 'Platinum', min: 1800, max: 2199 },
  { tier: 'Diamond', min: 2200, max: 2599 },
  { tier: 'Cyber Master', min: 2600, max: 99999 }
];

// Target benchmark scores for ~1500 Gold rating per game
const BENCHMARK_SCORES: Record<string, { baseScore: number; scale: number }> = {
  snake: { baseScore: 150, scale: 300 },
  space: { baseScore: 1200, scale: 2500 },
  brick: { baseScore: 1500, scale: 3000 },
  runner: { baseScore: 800, scale: 1500 },
  racer: { baseScore: 1000, scale: 2000 },
  pong: { baseScore: 5, scale: 10 },
  dinorun: { baseScore: 1200, scale: 2500 },
  tetris: { baseScore: 3000, scale: 6000 },
  '2048': { baseScore: 4000, scale: 8000 }
};

class CompetitiveService {
  private ratings: Record<string, CompetitiveRating> = {};

  constructor() {
    this.loadRatings();
  }

  private loadRatings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.ratings = JSON.parse(saved);
      }
    } catch {
      this.ratings = {};
    }
  }

  private saveRatings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ratings));
    } catch {}
  }

  public getTier(rating: number): CompetitiveTier {
    for (const t of TIER_THRESHOLDS) {
      if (rating >= t.min && rating <= t.max) {
        return t.tier;
      }
    }
    return 'Bronze';
  }

  public getRating(gameId: string): CompetitiveRating {
    if (!this.ratings[gameId]) {
      this.ratings[gameId] = {
        gameId,
        rating: 1000, // starting rating
        tier: 'Silver',
        peakRating: 1000,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        lastUpdated: Date.now()
      };
    }
    return { ...this.ratings[gameId] };
  }

  public getAllRatings(): Record<string, CompetitiveRating> {
    return { ...this.ratings };
  }

  public recordMatchScore(
    gameId: string,
    score: number
  ): { oldRating: number; newRating: number; change: number; tier: CompetitiveTier } {
    const current = this.getRating(gameId);
    const benchmark = BENCHMARK_SCORES[gameId] || { baseScore: 1000, scale: 2000 };

    // Ratio of achieved score relative to expected benchmark
    const performanceRatio = score / benchmark.baseScore;
    let ratingChange = 0;

    if (performanceRatio >= 1.0) {
      // Won against benchmark
      const bonus = Math.min(60, Math.floor((score / benchmark.scale) * 30));
      ratingChange = Math.max(10, Math.min(50, Math.floor(15 + bonus)));
    } else if (performanceRatio >= 0.5) {
      // Moderate run
      ratingChange = Math.floor((performanceRatio - 0.7) * 20);
    } else {
      // Poor run
      ratingChange = -Math.max(5, Math.min(25, Math.floor((1 - performanceRatio) * 20)));
    }

    // Dampen losses during first 5 placement matches
    if (current.matchesPlayed < 5 && ratingChange < 0) {
      ratingChange = Math.floor(ratingChange * 0.3);
    }

    const oldRating = current.rating;
    const newRating = Math.max(100, current.rating + ratingChange);
    const newTier = this.getTier(newRating);

    this.ratings[gameId] = {
      gameId,
      rating: newRating,
      tier: newTier,
      peakRating: Math.max(current.peakRating, newRating),
      matchesPlayed: current.matchesPlayed + 1,
      wins: current.wins + (ratingChange >= 0 ? 1 : 0),
      losses: current.losses + (ratingChange < 0 ? 1 : 0),
      lastUpdated: Date.now()
    };

    this.saveRatings();

    return {
      oldRating,
      newRating,
      change: ratingChange,
      tier: newTier
    };
  }
}

export const competitiveService = new CompetitiveService();
