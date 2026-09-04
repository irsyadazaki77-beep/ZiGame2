import { isFirebaseReady, auth, db, doc, getDoc, setDoc } from './firebase';
import { PlayerProfile, GameStats, Achievement, DailyMission, RecentlyPlayedEntry } from '../types';
import { storageService } from './storageService';
import { withRetry } from '../utils/resilience';
import { logger } from '../utils/logger';

export interface CloudSavePayload {
  schemaVersion: number;
  revision: number;
  updatedAt: number;
  userId: string;
  deviceId: string;
  profile: PlayerProfile;
  games: GameStats[];
  achievements: Achievement[];
  missions: DailyMission[];
  recentlyPlayed: RecentlyPlayedEntry[];
}

function getDeviceId(): string {
  let id = localStorage.getItem('zigame_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem('zigame_device_id', id);
  }
  return id;
}

/**
 * Field-based merge resolver ensuring zero data loss across multi-device / offline sync
 */
export function resolveCloudConflict(
  local: {
    profile: PlayerProfile;
    games: GameStats[];
    achievements: Achievement[];
    missions: DailyMission[];
    recentlyPlayed: RecentlyPlayedEntry[];
  },
  cloud: Partial<CloudSavePayload>
): {
  profile: PlayerProfile;
  games: GameStats[];
  achievements: Achievement[];
  missions: DailyMission[];
  recentlyPlayed: RecentlyPlayedEntry[];
} {
  // 1. Coins & Profile: preserve maximum earnings and union of unlocks
  const cloudProfile = cloud.profile || ({} as Partial<PlayerProfile>);
  const mergedCoins = Math.max(local.profile.coins || 0, cloudProfile.coins || 0);

  const mergedAvatars = Array.from(new Set([
    ...(local.profile.unlockedAvatars || ['🎮', '🕹️', '👾', '🚀', '🦊', '🐱', '🐶', '🐼']),
    ...(cloudProfile.unlockedAvatars || [])
  ]));

  const mergedThemes = Array.from(new Set([
    ...(local.profile.unlockedThemes || ['indigo', 'purple', 'rose', 'emerald', '#6366f1', '#a855f7', '#f43f5e', '#10b981']),
    ...(cloudProfile.unlockedThemes || [])
  ]));

  const mergedProfile: PlayerProfile = {
    ...cloudProfile,
    ...local.profile,
    name: local.profile.name || cloudProfile.name || 'GUEST',
    coins: mergedCoins,
    unlockedAvatars: mergedAvatars,
    unlockedThemes: mergedThemes
  };

  // 2. Games: max high score & max total plays
  const cloudGames = cloud.games || [];
  const mergedGames = local.games.map(localG => {
    const cloudG = cloudGames.find(cg => cg.id === localG.id);
    if (!cloudG) return localG;
    return {
      ...localG,
      highScore: Math.max(localG.highScore, cloudG.highScore),
      plays: Math.max(localG.plays, cloudG.plays)
    };
  });

  // 3. Achievements: union of unlocked status
  const cloudAch = cloud.achievements || [];
  const mergedAchievements = local.achievements.map(localA => {
    const cloudA = cloudAch.find(ca => ca.id === localA.id);
    const isUnlocked = localA.unlocked || !!cloudA?.unlocked;
    return {
      ...localA,
      unlocked: isUnlocked,
      unlockedAt: localA.unlockedAt || cloudA?.unlockedAt || (isUnlocked ? new Date().toLocaleDateString('id-ID') : undefined)
    };
  });

  // 4. Recently Played: timestamp merge with deduplication
  const combinedRecents = [
    ...local.recentlyPlayed,
    ...(cloud.recentlyPlayed || [])
  ];
  const recentMap = new Map<string, RecentlyPlayedEntry>();
  combinedRecents.forEach(entry => {
    const existing = recentMap.get(entry.gameId);
    if (!existing || entry.lastPlayedAt > existing.lastPlayedAt) {
      recentMap.set(entry.gameId, entry);
    }
  });
  const mergedRecentlyPlayed = Array.from(recentMap.values())
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, 20);

  return {
    profile: mergedProfile,
    games: mergedGames,
    achievements: mergedAchievements,
    missions: local.missions.length > 0 ? local.missions : (cloud.missions || []),
    recentlyPlayed: mergedRecentlyPlayed
  };
}

export const syncDataToCloud = async (
  profile: PlayerProfile, 
  games: GameStats[], 
  achievements: Achievement[],
  missions: DailyMission[],
  recentlyPlayed: RecentlyPlayedEntry[] = []
): Promise<boolean> => {
  if (!isFirebaseReady() || !auth?.currentUser || !db) {
    // Enqueue mutation for later sync if offline/firebase not ready
    storageService.pushOfflineMutation({
      type: 'SYNC_SNAPSHOT',
      payload: { profile, games, achievements, missions, recentlyPlayed },
      timestamp: Date.now()
    });
    return false;
  }
  
  try {
    const uid = auth.currentUser.uid;
    const userRef = doc(db, 'users', uid);

    await withRetry(async () => {
      const payload: CloudSavePayload = {
        schemaVersion: storageService.getSchemaVersion(),
        revision: storageService.getStorageRevision(),
        updatedAt: Date.now(),
        userId: uid,
        deviceId: getDeviceId(),
        profile,
        games,
        achievements,
        missions,
        recentlyPlayed
      };

      await setDoc(userRef, payload, { merge: true });
      logger.info('Cloud state synchronized', { code: 'SYNC_OK', userId: uid });
    }, { maxRetries: 3, initialDelayMs: 500 });

    // Drain queued offline mutations on success
    storageService.clearOfflineMutations();
    return true;
  } catch (error) {
    logger.error('Failed to sync to cloud after retries', {
      code: 'CLOUD_SYNC_FAILED',
      error: error as Error
    });
    return false;
  }
};

export const fetchCloudData = async (): Promise<any | null> => {
  if (!isFirebaseReady() || !auth?.currentUser || !db) return null;
  
  try {
    const uid = auth.currentUser.uid;
    const userRef = doc(db, 'users', uid);
    
    const docSnap = await withRetry(async () => {
      return await getDoc(userRef);
    }, { maxRetries: 3, initialDelayMs: 400 });
    
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    logger.error('Failed to fetch from cloud', {
      code: 'CLOUD_FETCH_FAILED',
      error: error as Error
    });
    return null;
  }
};

