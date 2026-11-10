import { PlayerProfile, GameStats, Achievement, DailyMission, RecentlyPlayedEntry } from '../types';
import { migrationPipeline, CURRENT_SCHEMA_VERSION } from '../data/migrations';
import { logger } from '../utils/logger';
import {
  readSignedVaultItem,
  writeSignedVaultItem,
  auditAndSealVaultKeys,
  VaultIntegrityReport,
  getTamperAttemptsCount
} from '../utils/localVault';

export interface OfflineMutationItem {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

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
  SESSION_PIN_HASH: 'zigame_session_pin_hash',
  SESSION_LOCKED: 'zigame_session_locked',
  ACTIVE_USER: 'zigame_active_user',
  OFFLINE_MUTATIONS: 'zigame_offline_mutation_queue'
};

const PROTECTED_VAULT_KEYS = [
  KEYS.PROFILE,
  KEYS.GAMES_STATS,
  KEYS.ACHIEVEMENTS,
  KEYS.DAILY_MISSIONS,
  KEYS.RECENTLY_PLAYED,
  KEYS.UNLOCKED_AVATARS,
  KEYS.UNLOCKED_THEMES
];

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
      return readSignedVaultItem<PlayerProfile>(KEYS.PROFILE);
    } catch (e) {
      logger.error("Failed to load profile from localStorage", { error: e as Error });
      return null;
    }
  },

  saveProfile: (profile: PlayerProfile): void => {
    try {
      writeSignedVaultItem(KEYS.PROFILE, profile);
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save profile to localStorage", { error: e as Error });
    }
  },

  getGamesStats: (): GameStats[] | null => {
    try {
      return readSignedVaultItem<GameStats[]>(KEYS.GAMES_STATS);
    } catch (e) {
      logger.error("Failed to load games stats from localStorage", { error: e as Error });
      return null;
    }
  },

  saveGamesStats: (games: GameStats[]): void => {
    try {
      writeSignedVaultItem(KEYS.GAMES_STATS, games);
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save games stats to localStorage", { error: e as Error });
    }
  },

  getAchievements: (): Achievement[] | null => {
    try {
      return readSignedVaultItem<Achievement[]>(KEYS.ACHIEVEMENTS);
    } catch (e) {
      logger.error("Failed to load achievements from localStorage", { error: e as Error });
      return null;
    }
  },

  saveAchievements: (achievements: Achievement[]): void => {
    try {
      writeSignedVaultItem(KEYS.ACHIEVEMENTS, achievements);
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save achievements to localStorage", { error: e as Error });
    }
  },

  getDailyMissions: (): DailyMission[] | null => {
    try {
      return readSignedVaultItem<DailyMission[]>(KEYS.DAILY_MISSIONS);
    } catch (e) {
      logger.error("Failed to load daily missions from localStorage", { error: e as Error });
      return null;
    }
  },

  saveDailyMissions: (missions: DailyMission[]): void => {
    try {
      writeSignedVaultItem(KEYS.DAILY_MISSIONS, missions);
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save daily missions to localStorage", { error: e as Error });
    }
  },

  getRecentlyPlayed: (): RecentlyPlayedEntry[] => {
    try {
      const data = readSignedVaultItem<RecentlyPlayedEntry[]>(KEYS.RECENTLY_PLAYED);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      logger.error("Failed to load recently played from localStorage", { error: e as Error });
      return [];
    }
  },

  saveRecentlyPlayed: (entries: RecentlyPlayedEntry[]): void => {
    try {
      writeSignedVaultItem(KEYS.RECENTLY_PLAYED, entries);
      incrementRevision();
    } catch (e) {
      logger.error("Failed to save recently played to localStorage", { error: e as Error });
    }
  },

  getUnlockedAvatars: (): string[] => {
    try {
      const data = readSignedVaultItem<string[]>(KEYS.UNLOCKED_AVATARS);
      return Array.isArray(data) ? data : ['🎮', '🕹️', '👾', '🚀', '🦊', '🐱', '🐶', '🐼'];
    } catch {
      return ['🎮', '🕹️', '👾', '🚀', '🦊', '🐱', '🐶', '🐼'];
    }
  },

  saveUnlockedAvatars: (avatars: string[]): void => {
    try {
      writeSignedVaultItem(KEYS.UNLOCKED_AVATARS, avatars);
    } catch (e) {
      logger.error("Failed to save unlocked avatars", { error: e as Error });
    }
  },

  getUnlockedThemes: (): string[] => {
    try {
      const data = readSignedVaultItem<string[]>(KEYS.UNLOCKED_THEMES);
      return Array.isArray(data)
        ? data
        : ['indigo', 'purple', 'rose', 'emerald', '#6366f1', '#a855f7', '#f43f5e', '#10b981'];
    } catch {
      return ['indigo', 'purple', 'rose', 'emerald', '#6366f1', '#a855f7', '#f43f5e', '#10b981'];
    }
  },

  saveUnlockedThemes: (themes: string[]): void => {
    try {
      writeSignedVaultItem(KEYS.UNLOCKED_THEMES, themes);
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

  getSessionPinHash: (): string | null => {
    try {
      return localStorage.getItem(KEYS.SESSION_PIN_HASH);
    } catch {
      return null;
    }
  },

  setSessionPinHash: (hash: string | null): void => {
    try {
      if (hash) {
        localStorage.setItem(KEYS.SESSION_PIN_HASH, hash);
      } else {
        localStorage.removeItem(KEYS.SESSION_PIN_HASH);
        localStorage.removeItem(KEYS.SESSION_LOCKED);
      }
    } catch (e) {
      logger.error("Failed to save session PIN hash", { error: e as Error });
    }
  },

  isSessionLocked: (): boolean => {
    try {
      return localStorage.getItem(KEYS.SESSION_LOCKED) === 'true';
    } catch {
      return false;
    }
  },

  setSessionLocked: (locked: boolean): void => {
    try {
      if (locked) {
        localStorage.setItem(KEYS.SESSION_LOCKED, 'true');
      } else {
        localStorage.removeItem(KEYS.SESSION_LOCKED);
      }
      window.dispatchEvent(new CustomEvent('zigame-session-lock-change', { detail: { locked } }));
    } catch (e) {
      logger.error("Failed to update session lock state", { error: e as Error });
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
  getOfflineMutationQueue: (): OfflineMutationItem[] => {
    try {
      const q = localStorage.getItem(KEYS.OFFLINE_MUTATIONS);
      return q ? (JSON.parse(q) as OfflineMutationItem[]) : [];
    } catch {
      return [];
    }
  },

  pushOfflineMutation: (mutation: OfflineMutationItem): void => {
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
  },

  verifyVaultIntegrity: (): VaultIntegrityReport => {
    return auditAndSealVaultKeys(PROTECTED_VAULT_KEYS);
  },

  getTamperAttemptsCount: (): number => {
    return getTamperAttemptsCount();
  }
};


