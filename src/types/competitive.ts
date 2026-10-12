export type CompetitiveTier =
  | 'Bronze'
  | 'Silver'
  | 'Gold'
  | 'Platinum'
  | 'Diamond'
  | 'Cyber Master';

export interface CompetitiveRating {
  gameId: string;
  rating: number; // Elo / CSR (starts ~1000)
  tier: CompetitiveTier;
  peakRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  lastUpdated: number;
}

export interface CompetitiveProfile {
  userId: string;
  globalRating: number;
  globalTier: CompetitiveTier;
  peakGlobalRating: number;
  gameRatings: Record<string, CompetitiveRating>;
  rankedGames: number;
  lastUpdated: number;
  seasonId: string;
}

export interface RankedSubmissionResult {
  success: boolean;
  gameId: string;
  score: number;
  coinsEarned: number;
  xpEarned: number;
  oldRating: number;
  newRating: number;
  ratingChange: number;
  newTier: CompetitiveTier;
}

export interface SeasonInfo {
  id: string;
  name: string;
  theme: string;
  themeName: string;
  description: string;
  startAt: string;
  endAt: string;
  featuredGames: string[];
  badgeReward: {
    id: string;
    name: string;
    icon: string;
    description: string;
  };
  cosmeticReward: {
    id: string;
    name: string;
    icon: string;
    type: 'avatar' | 'theme';
    cost: number;
  };
}

export type LeaderboardCategory = 'global' | 'friends' | 'weekly' | 'seasonal' | 'game_specific' | 'ranked';

export interface LeaderboardEntry {
  rank?: number;
  userId?: string;
  playerName: string;
  playerAvatar: string;
  score: number;
  submittedAt?: string;
  gameId?: string;
  masteryLevel?: number;
}

export interface RivalryInsight {
  type: 'behind' | 'approaching_top10' | 'leader' | 'friend_rival';
  message: string;
  targetPlayerName?: string;
  pointDifference?: number;
}

export interface ShareResultData {
  gameId: string;
  gameTitle: string;
  gameIcon: string;
  score: number;
  highScore: number;
  isPersonalBest: boolean;
  masteryXpGained: number;
  masteryLevel: number;
  competitiveRatingChange?: number;
  competitiveTier?: CompetitiveTier;
  timestamp: number;
}
