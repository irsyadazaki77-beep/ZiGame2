import { GraphicsQuality, PlayerProfile, RecentlyPlayedEntry, GameMastery } from './player';
import { GameStats } from './game';
import { Achievement, DailyMission, Challenge } from './economy';

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
  | 'ACTION_PRIMARY'
  | 'SECONDARY'
  | 'ACTION_SECONDARY'
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

export interface OnboardingPreferences {
  completed: boolean;
  favoriteGenres: string[];
  playStyle: 'casual' | 'competitive' | 'completionist';
  preferredInput: InputSource;
  recommendedGameIds: string[];
  completedAt?: number;
}

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
