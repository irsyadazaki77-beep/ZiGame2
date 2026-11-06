export interface ShopItem {
  id: string;
  name: string;
  type: 'avatar' | 'theme';
  value: string;
  cost: number;
  description: string;
  themePreviewBg?: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  gameId: string;
  unlocked: boolean;
  icon: string;
  unlockedAt?: string;
  rewardCoins: number;
  progress?: number;
  target?: number;
  secret?: boolean;
  tier?: 'Beginner' | 'Skill' | 'Mastery' | 'Rare' | 'Secret';
}

export type ChallengeFrequency = 'daily' | 'weekly' | 'special';
export type ChallengeCategory = 'score' | 'genre' | 'personal_best' | 'combo' | 'endurance' | 'featured';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  frequency: ChallengeFrequency;
  category: ChallengeCategory;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardXp: number;
  gameId?: string; // specific game if required
  genre?: string; // specific genre if required
  expiryDate: string; // ISO date string
  icon: string;
}

export interface DailyMission {
  id: string;
  type: 'play_count' | 'score_target' | 'unique_games' | 'beat_pb' | 'play_genre_count' | 'survive_time' | 'total_score';
  metadata?: any;
  target: number;
  progress: number;
  rewardCoins: number;
  completed: boolean;
  gameId?: string;
  description: string;
  date: string;
}

export interface DynamicEvent {
  id: string;
  name: string;
  description: string;
  icon: string;
  badgeColor: string;
  startAt: string;
  endAt: string;
  targetGames: string[];
  xpMultiplier: number;
  coinMultiplier: number;
  specialRule?: string;
  reward?: {
    type: string;
    value: string | number;
  };
}

export interface EconomyState {
  userId: string;
  coins: number;
  inventory: string[];
  lastSpinTimestamp: number;
  totalXp: number;
  level: number;
}

