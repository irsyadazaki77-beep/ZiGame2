import { CanonicalGameId, requireCanonicalGameId } from './canonicalGames';

export type CompetitiveTier = 
  | 'Bronze' 
  | 'Silver' 
  | 'Gold' 
  | 'Platinum' 
  | 'Diamond' 
  | 'Cyber Master';

export interface TierBoundary {
  tier: CompetitiveTier;
  minRating: number;
}

export const COMPETITIVE_TIERS: TierBoundary[] = [
  { tier: 'Bronze', minRating: 0 },
  { tier: 'Silver', minRating: 900 },
  { tier: 'Gold', minRating: 1100 },
  { tier: 'Platinum', minRating: 1300 },
  { tier: 'Diamond', minRating: 1500 },
  { tier: 'Cyber Master', minRating: 1700 }
];

export const RANKED_GAME_ALLOWLIST: CanonicalGameId[] = [
  'snake',
  'brick-breaker',
  'space-defender',
  'cyber-runner',
  'neon-pong',
  'cyber-tetris',
  'gravity-shift',
  'void-survivor',
  'orbital-defense'
];

export interface GameCompetitiveConfig {
  baseScore: number; // The score expected for an 'average' 1000 rating player
  volatility: number; // K-factor or sensitivity
}

export const GAME_COMPETITIVE_CONFIGS: Partial<Record<CanonicalGameId, GameCompetitiveConfig>> = {
  'snake': { baseScore: 150, volatility: 40 },
  'brick-breaker': { baseScore: 2000, volatility: 40 },
  'space-defender': { baseScore: 500, volatility: 40 },
  'cyber-runner': { baseScore: 1000, volatility: 40 },
  'neon-pong': { baseScore: 7, volatility: 40 },
  'cyber-tetris': { baseScore: 10000, volatility: 40 },
  'gravity-shift': { baseScore: 800, volatility: 40 },
  'void-survivor': { baseScore: 1200, volatility: 40 },
  'orbital-defense': { baseScore: 1500, volatility: 40 }
};

export const INITIAL_RATING = 1000;
export const PLACEMENT_MATCHES_COUNT = 5;

export function isRankedEligibleGame(gameId: string): boolean {
  try {
    const canonical = requireCanonicalGameId(gameId);
    return RANKED_GAME_ALLOWLIST.includes(canonical);
  } catch {
    return false;
  }
}

export function getTierForRating(rating: number): CompetitiveTier {
  for (let i = COMPETITIVE_TIERS.length - 1; i >= 0; i--) {
    if (rating >= COMPETITIVE_TIERS[i].minRating) {
      return COMPETITIVE_TIERS[i].tier;
    }
  }
  return 'Bronze';
}
