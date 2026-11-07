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

export const DEFAULT_AVATARS = ['🤖', '🕹️', '👾', '🚀', '🦊', '🐱', '🐶', '🐼'];
export const DEFAULT_THEMES = ['indigo', 'purple', 'rose', 'emerald', '#6366f1', '#a855f7', '#f43f5e', '#10b981'];

/**
 * Merge local and cloud user data ensuring server-authoritative economy and cosmetic protections.
 */
export function mergeUserData(
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
  const cloudProfile = cloud?.profile || ({} as Partial<PlayerProfile>);
  const hasCloudProfile = Boolean(cloud && cloud.profile);

  // Cosmetic unlocks: when cloud data is available, only combine default starter cosmetics
  // with cloud-authoritative unlocks, rejecting unverified client-side cosmetic claims
  const mergedAvatars = hasCloudProfile && Array.isArray(cloudProfile.unlockedAvatars)
    ? Array.from(new Set([...DEFAULT_AVATARS, ...cloudProfile.unlockedAvatars]))
    : Array.from(new Set([...DEFAULT_AVATARS, ...(local.profile.unlockedAvatars || [])]));

  const mergedThemes = hasCloudProfile && Array.isArray(cloudProfile.unlockedThemes)
    ? Array.from(new Set([...DEFAULT_THEMES, ...cloudProfile.unlockedThemes]))
    : Array.from(new Set([...DEFAULT_THEMES, ...(local.profile.unlockedThemes || [])]));

  // Active avatar & theme validation: must exist within merged unlocked sets or revert to default
  const selectedAvatar = local.profile.avatar && mergedAvatars.includes(local.profile.avatar)
    ? local.profile.avatar
    : cloudProfile.avatar && mergedAvatars.includes(cloudProfile.avatar)
      ? cloudProfile.avatar
      : DEFAULT_AVATARS[0];

  const selectedTheme = local.profile.colorTheme && mergedThemes.includes(local.profile.colorTheme)
    ? local.profile.colorTheme
    : cloudProfile.colorTheme && mergedThemes.includes(cloudProfile.colorTheme)
      ? cloudProfile.colorTheme
      : DEFAULT_THEMES[0];

  // Coins: strictly respect cloud authoritative balance when present, never allow unverified local override
  const resolvedCoins = typeof cloudProfile.coins === 'number'
    ? cloudProfile.coins
    : Math.min(typeof local.profile.coins === 'number' ? local.profile.coins : 100, 500);

  const mergedProfile: PlayerProfile = {
    ...cloudProfile,
    ...local.profile,
    name: local.profile.name || cloudProfile.name || 'GUEST',
    avatar: selectedAvatar,
    colorTheme: selectedTheme,
    coins: resolvedCoins,
    unlockedAvatars: mergedAvatars,
    unlockedThemes: mergedThemes
  };

  // Strip any illegal administrative / privilege escalation fields from merged state
  delete (mergedProfile as any).isAdmin;
  delete (mergedProfile as any).isBanned;
  delete (mergedProfile as any).role;
  delete (mergedProfile as any).verifiedBalance;

  // Games: highest verified highscore & max total plays
  const cloudGames = cloud?.games || [];
  const mergedGames = local.games.map(localG => {
    const cloudG = cloudGames.find(cg => cg.id === localG.id);
    if (!cloudG) return localG;
    return {
      ...localG,
      highScore: Math.max(localG.highScore, cloudG.highScore),
      plays: Math.max(localG.plays, cloudG.plays)
    };
  });

  // Achievements: union of unlocked status
  const cloudAch = cloud?.achievements || [];
  const mergedAchievements = local.achievements.map(localA => {
    const cloudA = cloudAch.find(ca => ca.id === localA.id);
    const isUnlocked = localA.unlocked || !!cloudA?.unlocked;
    return {
      ...localA,
      unlocked: isUnlocked,
      unlockedAt: localA.unlockedAt || cloudA?.unlockedAt || (isUnlocked ? new Date().toLocaleDateString('id-ID') : undefined)
    };
  });

  // Recently Played: timestamp merge with deduplication
  const combinedRecents = [
    ...local.recentlyPlayed,
    ...(cloud?.recentlyPlayed || [])
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
    missions: local.missions.length > 0 ? local.missions : (cloud?.missions || []),
    recentlyPlayed: mergedRecentlyPlayed
  };
}

/**
 * Backward compatibility alias for resolveCloudConflict
 */
export const resolveCloudConflict = mergeUserData;

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
      // Fetch current authoritative cloud profile to prevent client-side overwrite of coins or cosmetics
      let cloudCoins: number | null = null;
      let cloudUnlockedAvatars: string[] | null = null;
      let cloudUnlockedThemes: string[] | null = null;

      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const currentData = snap.data();
          if (currentData?.profile) {
            if (typeof currentData.profile.coins === 'number') {
              cloudCoins = currentData.profile.coins;
            }
            if (Array.isArray(currentData.profile.unlockedAvatars)) {
              cloudUnlockedAvatars = currentData.profile.unlockedAvatars;
            }
            if (Array.isArray(currentData.profile.unlockedThemes)) {
              cloudUnlockedThemes = currentData.profile.unlockedThemes;
            }
          }
        }
      } catch {
        // Fallback gracefully on network / read errors
      }

      // Authoritative coins: strictly retain existing cloud balance or clamp starter bonus to max 500
      const safeCoins = cloudCoins !== null
        ? cloudCoins
        : Math.min(typeof profile.coins === 'number' ? profile.coins : 100, 500);

      // Authoritative cosmetics: only permit default starter cosmetics or server-confirmed cloud inventory
      const safeUnlockedAvatars = cloudUnlockedAvatars !== null
        ? Array.from(new Set([...DEFAULT_AVATARS, ...cloudUnlockedAvatars]))
        : DEFAULT_AVATARS;

      const safeUnlockedThemes = cloudUnlockedThemes !== null
        ? Array.from(new Set([...DEFAULT_THEMES, ...cloudUnlockedThemes]))
        : DEFAULT_THEMES;

      const safeAvatar = profile.avatar && safeUnlockedAvatars.includes(profile.avatar)
        ? profile.avatar
        : DEFAULT_AVATARS[0];

      const safeTheme = profile.colorTheme && safeUnlockedThemes.includes(profile.colorTheme)
        ? profile.colorTheme
        : DEFAULT_THEMES[0];

      const sanitizedProfile: PlayerProfile = {
        ...profile,
        name: (profile.name || 'GUEST').slice(0, 64),
        avatar: safeAvatar,
        colorTheme: safeTheme,
        coins: safeCoins,
        unlockedAvatars: safeUnlockedAvatars,
        unlockedThemes: safeUnlockedThemes
      };

      // Ensure no administrative or privilege-escalating fields can ever be sent
      delete (sanitizedProfile as any).isAdmin;
      delete (sanitizedProfile as any).isBanned;
      delete (sanitizedProfile as any).role;
      delete (sanitizedProfile as any).verifiedBalance;

      const payload: CloudSavePayload = {
        schemaVersion: storageService.getSchemaVersion(),
        revision: storageService.getStorageRevision(),
        updatedAt: Date.now(),
        userId: uid,
        deviceId: getDeviceId(),
        profile: sanitizedProfile,
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
