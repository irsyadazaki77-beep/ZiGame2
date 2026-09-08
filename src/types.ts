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

export interface SocialPrivacySettings {
  allowFriendRequests: 'everyone' | 'none';
  showActivityFeed: 'public' | 'friends_only' | 'private';
}

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type PerformanceTier = 'low' | 'medium' | 'high';

export interface PerformanceSettings {
  tier: PerformanceTier;
  targetFps: number;
  particlesMultiplier: number;
  enableGlow: boolean;
  enableBlur: boolean;
  enableShadows: boolean;
  dprCap: number;
  batterySaver: boolean;
  autoDetect: boolean;
}

export type GameQualityTier = 'flagship' | 'core' | 'experimental' | 'legacy';

export type InputSource = 'keyboard' | 'touch' | 'mouse' | 'gamepad';

export interface GamepadState {
  connected: boolean;
  id: string;
  index: number;
  buttons: Record<string, boolean>;
  axes: {
    leftStickX: number;
    leftStickY: number;
    rightStickX: number;
    rightStickY: number;
  };
}

export type InputAction =
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'PRIMARY'
  | 'SECONDARY'
  | 'PAUSE'
  | 'RESTART';

export interface InputMappingConfig {
  keys: {
    up?: string[];
    down?: string[];
    left?: string[];
    right?: string[];
    primary?: string[];
    secondary?: string[];
    pause?: string[];
    restart?: string[];
  };
  gamepad: {
    primaryButton?: number;
    secondaryButton?: number;
    pauseButton?: number;
    restartButton?: number;
  };
  supportsTouch: boolean;
  supportsGamepad: boolean;
  supportsMouse: boolean;
}

export type GameLifecycleState =
  | 'initialize'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'paused'
  | 'gameover'
  | 'restart'
  | 'dispose';

export interface GameSaveState<T = any> {
  gameId: string;
  gameVersion: string;
  balanceVersion: string;
  score: number;
  timestamp: number;
  data: T;
  checksum: string;
}

export interface GhostPoint {
  t: number; // time in ms from start
  x?: number;
  y?: number;
  a?: string; // action
  s?: number; // score snapshot
}

export interface GhostRunData {
  gameId: string;
  score: number;
  durationMs: number;
  recordedAt: number;
  points: GhostPoint[];
  gameVersion: string;
}

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

export interface FeatureFlags {
  gamepadSupport: boolean;
  ghostMode: boolean;
  saveState: boolean;
  batterySaver: boolean;
  competitiveRating: boolean;
  telemetry: boolean;
  theaterMode: boolean;
  publicProfiles: boolean;
  soundNormalization: boolean;
  newDiscovery: boolean;
  onboardingWizard: boolean;
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

export interface OnboardingPreferences {
  completed: boolean;
  favoriteGenres: string[];
  playStyle: 'casual' | 'competitive' | 'completionist';
  preferredInput: InputSource;
  recommendedGameIds: string[];
  completedAt?: number;
}

export interface GameStats {
  id: string;
  title: string;
  description: string;
  plays: number;
  highScore: number;
  themeColor: string;
  accentShadow: string;
  icon: string;
  coverImage?: string;
  thumbnailUrl?: string;
  genre?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  controls?: string;
  avgDuration?: string;
  completionRate?: number;
  restartCount?: number;
  totalPlaytimeSec?: number;
}

export interface GameComponentProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

// 4. Game Mastery System Types
export interface GameMastery {
  gameId: string;
  xp: number;
  level: number;
  milestonesUnlocked: string[];
  highestScore: number;
  totalPlays: number;
  lastEarnedAt?: number;
}

export interface MasteryTierReward {
  level: number;
  title: string;
  badge: string;
  rewardType: 'title' | 'badge' | 'avatar' | 'theme' | 'coins';
  rewardValue: string | number;
}

// 3. Challenge 2.0 Types
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

// 5. Seasonal System Types
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

// 6. Dynamic Event System Types
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

// 7. Friends & Social System Types
export type RelationshipStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' | 'BLOCKED';

export interface FriendProfile {
  uid: string;
  name: string;
  avatar: string;
  colorTheme: string;
  status: RelationshipStatus;
  isOnline?: boolean;
  lastActive?: number;
  highestScoreGame?: {
    gameTitle: string;
    score: number;
  };
  masteryTitle?: string;
}

export interface ActivityFeedItem {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  type: 'high_score' | 'mastery_up' | 'achievement' | 'challenge_clear';
  gameTitle?: string;
  score?: number;
  details: string;
  timestamp: number;
}

// 8. Leaderboard 2.0 Types
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

export type GameCategory = 'All' | 'Classic' | 'Arcade' | 'Shooter' | 'Puzzle' | 'Endless' | 'Action';

export interface GameResult {
  gameId: string;
  score: number;
  durationMs: number;
  timestamp: number;
}

export type TouchControlsType = 'dpad' | 'leftright' | 'updown' | 'actiononly' | 'none';

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

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  radius: number;
  alpha: number;
  decay: number;
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

export interface RecentlyPlayedEntry {
  gameId: string;
  lastPlayedAt: number;
  lastScore?: number;
  highScore?: number;
  sessionDuration?: number;
  playCount?: number;
}

// 10. Product Analytics Types
export type AnalyticsEventType = 
  | 'app_open'
  | 'game_view'
  | 'game_start'
  | 'game_complete'
  | 'game_abandon'
  | 'game_restart'
  | 'score_submit'
  | 'personal_best'
  | 'challenge_complete'
  | 'reward_claim'
  | 'shop_purchase'
  | 'level_up'
  | 'mastery_level_up';

export interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  userId: string;
  timestamp: number;
  gameId?: string;
  durationMs?: number;
  score?: number;
  difficulty?: string;
  masteryLevel?: number;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface UserSessionData {
  uid: string;
  username: string;
  displayName: string;
  isAnonymous: boolean;
  isFirebase: boolean;
  profile: PlayerProfile;
  games: GameStats[];
  achievements: Achievement[];
  missions?: DailyMission[];
  recentlyPlayed: RecentlyPlayedEntry[];
  masteries?: Record<string, GameMastery>;
  challenges?: Challenge[];
  lastSyncedAt?: number;
}

