export interface SocialPrivacySettings {
  allowFriendRequests: 'everyone' | 'none';
  showActivityFeed: 'public' | 'friends_only' | 'private';
}

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GameMastery {
  gameId: string;
  xp: number;
  level: number;
  milestonesUnlocked: string[];
  highestScore: number;
  totalPlays: number;
  lastEarnedAt?: number;
}

export interface PlayerProfile {
  name: string;
  avatar: string;
  colorTheme: string;
  coins: number;
  hasCompletedOnboarding?: boolean;
  onboardingStep?: number;
  favoriteGenre?: string;
  favoriteGames?: string[];
  streak?: number;
  lastPlayDate?: string;
  unlockedAvatars?: string[];
  unlockedThemes?: string[];
  
  // Profile 2.0 additions
  level?: number;
  xp?: number;
  selectedTitle?: string;
  selectedBadges?: string[];
  achievementShowcase?: [string, string, string]; // 3 customizable showcase slots (achievement IDs)
  isPublicProfile?: boolean;
  totalPlaytimeSec?: number;
  socialPrivacy?: SocialPrivacySettings;
  mastery?: Record<string, GameMastery>;

  settings?: {
    reducedMotion?: boolean;
    disableParticles?: boolean;
    disableScreenShake?: boolean;
    musicVolume?: number;
    sfxVolume?: number;
    graphicsQuality?: GraphicsQuality;
  };
}

export interface MasteryTierReward {
  level: number;
  title: string;
  badge: string;
  rewardType: 'title' | 'badge' | 'avatar' | 'theme' | 'coins';
  rewardValue: string | number;
}

export interface RecentlyPlayedEntry {
  gameId: string;
  lastPlayedAt: number;
  lastScore?: number;
  highScore?: number;
  sessionDuration?: number;
  playCount?: number;
}
