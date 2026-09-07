import { PlayerProfile, GameStats, Achievement, DailyMission, RecentlyPlayedEntry } from '../types';
import { migrationPipeline, CURRENT_SCHEMA_VERSION } from '../data/migrations';
import { logger } from '../utils/logger';

const KEYS = {
  SCHEMA_VERSION: 'zigame_schema_version',
  STORAGE_REVISION: 'zigame_storage_revision',
  PROFILE: 'arcade_player_profile',
  GAMES_STATS: 'arcade_games_stats',
  ACHIEVEMENTS: 'arcade_achievements',
  DAILY_MISSIONS: 'arcade_daily_missions',
  RECENTLY_PLAYED: 'arcade_recently_played',
  UNLOCKED_AVATARS: 'arcade_unlocked_avatars',
  UNLOCKED_THEMES: 'arcade_unlocked_themes',
  AUTOLOCK: 'zigame_session_autolock',
  ACTIVE_USER: 'zigame_active_user',
  OFFLINE_MUTATIONS: 'zigame_offline_mutation_queue'
};

// Initialize and execute migration pipeline upon boot
try {
  migrationPipeline.runMigrations();
} catch (e) {
  logger.error("Initialization migration failed", { error: e as Error });
}

function incrementRevision(): number {
  try {
    const rev = parseInt(localStorage.getItem(KEYS.STORAGE_REVISION) || '0', 10) + 1;
    localStorage.setItem(KEYS.STORAGE_REVISION, rev.toString());
    return rev;
  } catch {
    return 1;
  }
}

export const storageService = {
  getSchemaVersion: (): number => {
    return parseInt(localStorage.getItem(KEYS.SCHEMA_VERSION) || CURRENT_SCHEMA_VERSION.toString(), 10);
  },

  getStorageRevision: (): number => {
    return parseInt(localStorage.getItem(KEYS.STORAGE_REVISION) || '1', 10);
  },

  getProfile: (): PlayerProfile | null => {
    try {
      const data = localStorage.getItem(KEYS.PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      logger.error("Failed to load profile from localStorage", { error: e as Error });
      return null;
    }
  },

  saveProfile: (profile: PlayerProfile): void => {
    try {
      localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save profile to localStorage", { error: e as Error });
    }
  },

  getGamesStats: (): GameStats[] | null => {
    try {
      const data = localStorage.getItem(KEYS.GAMES_STATS);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      logger.error("Failed to load games stats from localStorage", { error: e as Error });
      return null;
    }
  },

  saveGamesStats: (games: GameStats[]): void => {
    try {
      localStorage.setItem(KEYS.GAMES_STATS, JSON.stringify(games));
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save games stats to localStorage", { error: e as Error });
    }
  },

  getAchievements: (): Achievement[] | null => {
    try {
      const data = localStorage.getItem(KEYS.ACHIEVEMENTS);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      logger.error("Failed to load achievements from localStorage", { error: e as Error });
      return null;
    }
  },

  saveAchievements: (achievements: Achievement[]): void => {
    try {
      localStorage.setItem(KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save achievements to localStorage", { error: e as Error });
    }
  },

  getDailyMissions: (): DailyMission[] | null => {
    try {
      const data = localStorage.getItem(KEYS.DAILY_MISSIONS);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      logger.error("Failed to load daily missions from localStorage", { error: e as Error });
      return null;
    }
  },

  saveDailyMissions: (missions: DailyMission[]): void => {
    try {
      localStorage.setItem(KEYS.DAILY_MISSIONS, JSON.stringify(missions));
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save daily missions to localStorage", { error: e as Error });
    }
  },

  getRecentlyPlayed: (): RecentlyPlayedEntry[] => {
    try {
      const data = localStorage.getItem(KEYS.RECENTLY_PLAYED);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      logger.error("Failed to load recently played from localStorage", { error: e as Error });
      return [];
    }
  },

  saveRecentlyPlayed: (entries: RecentlyPlayedEntry[]): void => {
    try {
      localStorage.setItem(KEYS.RECENTLY_PLAYED, JSON.stringify(entries));
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save recently played to localStorage", { error: e as Error });
    }
  },

  getUnlockedAvatars: (): string[] => {
    try {
      const data = localStorage.getItem(KEYS.UNLOCKED_AVATARS);
      return data ? JSON.parse(data) : ['🎮', '🕹️', '👾', '🚀', '🦊', '🐱', '🐶', '🐼'];
    } catch (e) {
      return ['🎮', '🕹️', '👾', '🚀', '🦊', '🐱', '🐶', '🐼'];
    }
  },

  saveUnlockedAvatars: (avatars: string[]): void => {
    try {
      localStorage.setItem(KEYS.UNLOCKED_AVATARS, JSON.stringify(avatars));
    } catch (e) {
      logger.error("Failed to save unlocked avatars", { error: e as Error });
    }
  },

  getUnlockedThemes: (): string[] => {
    try {
      const data = localStorage.getItem(KEYS.UNLOCKED_THEMES);
      return data ? JSON.parse(data) : ['indigo', 'purple', 'rose', 'emerald', '#6366f1', '#a855f7', '#f43f5e', '#10b981'];
    } catch (e) {
      return ['indigo', 'purple', 'rose', 'emerald', '#6366f1', '#a855f7', '#f43f5e', '#10b981'];
    }
  },

  saveUnlockedThemes: (themes: string[]): void => {
    try {
      localStorage.setItem(KEYS.UNLOCKED_THEMES, JSON.stringify(themes));
    } catch (e) {
      logger.error("Failed to save unlocked themes", { error: e as Error });
    }
  },

  getSessionAutolock: (): string => {
    try {
      return localStorage.getItem(KEYS.AUTOLOCK) || 'off';
    } catch {
      return 'off';
    }
  },

  setSessionAutolock: (value: string): void => {
    try {
      localStorage.setItem(KEYS.AUTOLOCK, value);
    } catch (e) {
      logger.error("Failed to save session autolock setting", { error: e as Error });
    }
  },

  getActiveUser: (): string | null => {
    try {
      return localStorage.getItem(KEYS.ACTIVE_USER);
    } catch {
      return null;
    }
  },

  setActiveUser: (userId: string): void => {
    try {
      localStorage.setItem(KEYS.ACTIVE_USER, userId);
    } catch (e) {
      logger.error("Failed to save active user", { error: e as Error });
    }
  },

  clearActiveUser: (): void => {
    try {
      localStorage.removeItem(KEYS.ACTIVE_USER);
    } catch {}
  },

  // Offline mutation queue for resilience
  getOfflineMutationQueue: (): any[] => {
    try {
      const q = localStorage.getItem(KEYS.OFFLINE_MUTATIONS);
      return q ? JSON.parse(q) : [];
    } catch {
      return [];
    }
  },

  pushOfflineMutation: (mutation: { type: string; payload: any; timestamp: number }): void => {
    try {
      const q = storageService.getOfflineMutationQueue();
      q.push(mutation);
      localStorage.setItem(KEYS.OFFLINE_MUTATIONS, JSON.stringify(q));
    } catch (e) {
      logger.error("Failed to enqueue offline mutation", { error: e as Error });
    }
  },

  clearOfflineMutations: (): void => {
    try {
      localStorage.setItem(KEYS.OFFLINE_MUTATIONS, JSON.stringify([]));
    } catch {}
  }
};

