import { isFirebaseReady, auth, db, doc, getDoc, setDoc } from './firebase';
import { PlayerProfile, GameStats, Achievement, DailyMission, RecentlyPlayedEntry } from '../types';
import { storageService } from './storageService';
import { withRetry } from '../utils/resilience';
import { logger } from '../utils/logger';
import { ECONOMY_BALANCE_CONFIG } from '../config/balanceConfig';

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
 * Safely merges only UI/accessibility/control preferences from local storage when cloud settings are unset.
 * Never carries over coins, XP, levels, scores, or inventory.
 */
function mergeSafeUiSettings(
  localSettings: PlayerProfile['settings'] | undefined,
  cloudSettings: PlayerProfile['settings'] | undefined
): PlayerProfile['settings'] | undefined {
  if (!localSettings && !cloudSettings) return undefined;
  return {
    ...(localSettings || {}),
    ...(cloudSettings || {})
  };
}

/**
 * Resolves cloud state as the single authoritative source of truth for authenticated users.
 * Local guest coins, inventory, XP, levels, ranked/high scores, achievements, and missions
 * NEVER overwrite or inflate Firestore cloud state upon login.
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

  // Inventory / Cosmetics: strictly authoritative from cloud (or starter defaults for new cloud accounts)
  const authoritativeAvatars = hasCloudProfile && Array.isArray(cloudProfile.unlockedAvatars)
    ? Array.from(new Set([...DEFAULT_AVATARS, ...cloudProfile.unlockedAvatars]))
    : [...DEFAULT_AVATARS];

  const authoritativeThemes = hasCloudProfile && Array.isArray(cloudProfile.unlockedThemes)
    ? Array.from(new Set([...DEFAULT_THEMES, ...cloudProfile.unlockedThemes]))
    : [...DEFAULT_THEMES];

  const selectedAvatar = hasCloudProfile && cloudProfile.avatar && authoritativeAvatars.includes(cloudProfile.avatar)
    ? cloudProfile.avatar
    : DEFAULT_AVATARS[0];

  const selectedTheme = hasCloudProfile && cloudProfile.colorTheme && authoritativeThemes.includes(cloudProfile.colorTheme)
    ? cloudProfile.colorTheme
    : DEFAULT_THEMES[0];

  // Economy & Progression: strictly cloud authoritative, never trust localStorage guest balances or XP
  const starterCoins = ECONOMY_BALANCE_CONFIG.starterCoins;
  const resolvedCoins = hasCloudProfile && typeof cloudProfile.coins === 'number'
    ? Math.max(0, Math.floor(cloudProfile.coins))
    : starterCoins;

  const safeSettings = mergeSafeUiSettings(local.profile.settings, cloudProfile.settings);

  const mergedProfile: PlayerProfile = {
    uid: hasCloudProfile ? cloudProfile.uid : undefined,
    username: hasCloudProfile ? cloudProfile.username : undefined,
    name: hasCloudProfile && cloudProfile.name ? cloudProfile.name : (local.profile.name || 'PLAYER'),
    avatar: selectedAvatar,
    colorTheme: selectedTheme,
    coins: resolvedCoins,
    xp: hasCloudProfile && typeof cloudProfile.xp === 'number' ? cloudProfile.xp : 0,
    level: hasCloudProfile && typeof cloudProfile.level === 'number' ? cloudProfile.level : 1,
    streak: hasCloudProfile && typeof cloudProfile.streak === 'number' ? cloudProfile.streak : 0,
    lastPlayDate: hasCloudProfile ? cloudProfile.lastPlayDate : undefined,
    totalPlaytimeSec: hasCloudProfile && typeof cloudProfile.totalPlaytimeSec === 'number' ? cloudProfile.totalPlaytimeSec : 0,
    mastery: hasCloudProfile && cloudProfile.mastery ? cloudProfile.mastery : {},
    hasCompletedOnboarding: hasCloudProfile ? cloudProfile.hasCompletedOnboarding : local.profile.hasCompletedOnboarding,
    onboardingStep: hasCloudProfile ? cloudProfile.onboardingStep : local.profile.onboardingStep,
    favoriteGenre: hasCloudProfile ? cloudProfile.favoriteGenre : local.profile.favoriteGenre,
    favoriteGames: hasCloudProfile && Array.isArray(cloudProfile.favoriteGames) ? cloudProfile.favoriteGames : [],
    selectedTitle: hasCloudProfile ? cloudProfile.selectedTitle : undefined,
    selectedBadges: hasCloudProfile && Array.isArray(cloudProfile.selectedBadges) ? cloudProfile.selectedBadges : [],
    achievementShowcase: hasCloudProfile ? cloudProfile.achievementShowcase : undefined,
    isPublicProfile: hasCloudProfile ? cloudProfile.isPublicProfile : true,
    socialPrivacy: hasCloudProfile ? cloudProfile.socialPrivacy : local.profile.socialPrivacy,
    settings: safeSettings,
    unlockedAvatars: authoritativeAvatars,
    unlockedThemes: authoritativeThemes
  };

  // Strip any administrative or privilege-escalating fields
  delete (mergedProfile as any).isAdmin;
  delete (mergedProfile as any).isBanned;
  delete (mergedProfile as any).role;
  delete (mergedProfile as any).verifiedBalance;

  // Games: strictly cloud authoritative high scores & play counts (zero out unverified local guest progress)
  const cloudGames = Array.isArray(cloud?.games) ? cloud.games : [];
  const mergedGames = local.games.map(localG => {
    const cloudG = cloudGames.find(cg => cg.id === localG.id);
    return {
      ...localG,
      highScore: cloudG ? Math.max(0, Number(cloudG.highScore) || 0) : 0,
      plays: cloudG ? Math.max(0, Number(cloudG.plays) || 0) : 0
    };
  });

  // Achievements: strictly cloud authoritative unlocked state
  const cloudAch = Array.isArray(cloud?.achievements) ? cloud.achievements : [];
  const mergedAchievements = local.achievements.map(localA => {
    const cloudA = cloudAch.find(ca => ca.id === localA.id);
    const isUnlocked = Boolean(cloudA?.unlocked);
    return {
      ...localA,
      unlocked: isUnlocked,
      unlockedAt: isUnlocked ? cloudA?.unlockedAt : undefined
    };
  });

  // Missions & Recently Played: strictly from cloud
  const mergedMissions = Array.isArray(cloud?.missions) ? cloud.missions : [];
  const mergedRecentlyPlayed = Array.isArray(cloud?.recentlyPlayed)
    ? [...cloud.recentlyPlayed].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt).slice(0, 20)
    : [];

  return {
    profile: mergedProfile,
    games: mergedGames,
    achievements: mergedAchievements,
    missions: mergedMissions,
    recentlyPlayed: mergedRecentlyPlayed
  };
};

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
  // Never persist offline guest snapshots or enqueue them to overwrite authenticated cloud accounts
  if (!isFirebaseReady() || !auth?.currentUser || !db) {
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

      const safeCoins = cloudCoins !== null
        ? cloudCoins
        : ECONOMY_BALANCE_CONFIG.starterCoins;

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
        name: (profile.name || 'PLAYER').slice(0, 64),
        avatar: safeAvatar,
        colorTheme: safeTheme,
        coins: safeCoins,
        unlockedAvatars: safeUnlockedAvatars,
        unlockedThemes: safeUnlockedThemes
      };

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
