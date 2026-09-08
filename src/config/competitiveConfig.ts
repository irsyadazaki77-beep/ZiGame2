import { CanonicalGameId } from './canonicalGames';

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
  'brick',
  'space',
  'runner',
  'pong',
  'tetris',
  'gravity_shift',
  'void_survivor',
  'orbital_defense'
];

export interface GameCompetitiveConfig {
  baseScore: number; // The score expected for an 'average' 1000 rating player
  volatility: number; // K-factor or sensitivity
}

export const GAME_COMPETITIVE_CONFIGS: Record<string, GameCompetitiveConfig> = {
  snake: { baseScore: 150, volatility: 40 },
  brick: { baseScore: 2000, volatility: 40 },
  space: { baseScore: 500, volatility: 40 },
  runner: { baseScore: 1000, volatility: 40 },
  pong: { baseScore: 7, volatility: 40 },
  tetris: { baseScore: 10000, volatility: 40 },
  gravity_shift: { baseScore: 800, volatility: 40 },
  void_survivor: { baseScore: 1200, volatility: 40 },
  orbital_defense: { baseScore: 1500, volatility: 40 }
};

export const INITIAL_RATING = 1000;
export const PLACEMENT_MATCHES_COUNT = 5;

export function getTierForRating(rating: number): CompetitiveTier {
  for (let i = COMPETITIVE_TIERS.length - 1; i >= 0; i--) {
    if (rating >= COMPETITIVE_TIERS[i].minRating) {
      return COMPETITIVE_TIERS[i].tier;
    }
  }
  return 'Bronze';
}
