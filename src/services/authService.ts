import { isFirebaseReady, auth, provider, signInWithPopup, fbSignOut, onAuthStateChanged, db, doc, getDoc, setDoc } from './firebase';
import { PlayerProfile, GameStats, Achievement, DailyMission, RecentlyPlayedEntry } from '../types';
import { storageService } from './storageService';

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
  lastSyncedAt?: number;
}

export interface LocalAccount {
  username: string;
  displayName: string;
  passwordHash: string;
  profile: PlayerProfile;
  games: GameStats[];
  achievements: Achievement[];
  missions?: DailyMission[];
  recentlyPlayed: RecentlyPlayedEntry[];
  createdAt: number;
  updatedAt: number;
}

// Password hashing utility with SHA-256 + salt
export async function hashPassword(password: string): Promise<string> {
  try {
    const msgUint8 = new TextEncoder().encode(password + "_zigame_secure_salt_2026");
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback simple hash for older environments
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }
}

class AuthService {
  private activeUser: string | null = null;
  private authListeners: Array<(session: UserSessionData | null) => void> = [];

  constructor() {
    this.activeUser = storageService.getActiveUser();
    this.initFirebaseAuthListener();
  }

  private initFirebaseAuthListener() {
    if (isFirebaseReady() && auth) {
      onAuthStateChanged(auth, async (user: any) => {
        if (user) {
          const cloudData = await this.fetchFirestoreUserData(user.uid);
          const currentProfile = storageService.getProfile() || {
            name: user.displayName || 'GUEST',
            avatar: '👾',
            colorTheme: '#ef4444',
            coins: 100
          };

          const session: UserSessionData = {
            uid: user.uid,
            username: user.email || user.uid,
            displayName: user.displayName || 'Pemain Arkade',
            isAnonymous: false,
            isFirebase: true,
            profile: cloudData?.profile || currentProfile,
            games: cloudData?.games || storageService.getGamesStats() || [],
            achievements: cloudData?.achievements || storageService.getAchievements() || [],
            missions: cloudData?.missions || storageService.getDailyMissions() || [],
            recentlyPlayed: cloudData?.recentlyPlayed || storageService.getRecentlyPlayed() || [],
            lastSyncedAt: Date.now()
          };

          this.broadcastSession(session);
        }
      });
    }
  }

  public subscribe(listener: (session: UserSessionData | null) => void) {
    this.authListeners.push(listener);
    return () => {
      this.authListeners = this.authListeners.filter(l => l !== listener);
    };
  }

  private broadcastSession(session: UserSessionData | null) {
    this.authListeners.forEach(listener => listener(session));
  }

  // Get local stored accounts
  public getLocalAccounts(): LocalAccount[] {
    try {
      const accs = localStorage.getItem('zigame_accounts');
      return accs ? JSON.parse(accs) : [];
    } catch {
      return [];
    }
  }

  private saveLocalAccounts(accounts: LocalAccount[]) {
    try {
      localStorage.setItem('zigame_accounts', JSON.stringify(accounts));
    } catch (e) {
      console.error('Failed to save local accounts:', e);
    }
  }

  // Guest to Registered account data reconciler & migration
  public reconcileUserData(
    existingCloudOrAccount: Partial<UserSessionData>,
    currentGuestData: {
      profile: PlayerProfile;
      games: GameStats[];
      achievements: Achievement[];
      recentlyPlayed: RecentlyPlayedEntry[];
    }
  ): {
    profile: PlayerProfile;
    games: GameStats[];
    achievements: Achievement[];
    recentlyPlayed: RecentlyPlayedEntry[];
  } {
    // 1. Coins: Keep the maximum or sum wisely
    const accountCoins = existingCloudOrAccount.profile?.coins ?? 0;
    const guestCoins = currentGuestData.profile.coins ?? 0;
    const mergedCoins = Math.max(accountCoins, guestCoins);

    // 2. Profile
    const mergedProfile: PlayerProfile = {
      ...currentGuestData.profile,
      ...(existingCloudOrAccount.profile || {}),
      coins: mergedCoins,
      unlockedAvatars: Array.from(new Set([
        ...(currentGuestData.profile.unlockedAvatars || []),
        ...(existingCloudOrAccount.profile?.unlockedAvatars || [])
      ])),
      unlockedThemes: Array.from(new Set([
        ...(currentGuestData.profile.unlockedThemes || []),
        ...(existingCloudOrAccount.profile?.unlockedThemes || [])
      ]))
    };

    // 3. Games: take highest highscore and sum plays
    const accountGames = existingCloudOrAccount.games || [];
    const mergedGames = currentGuestData.games.map(g => {
      const accGame = accountGames.find(ag => ag.id === g.id);
      if (!accGame) return g;
      return {
        ...g,
        plays: Math.max(g.plays, accGame.plays),
        highScore: Math.max(g.highScore, accGame.highScore)
      };
    });

    // 4. Achievements: merge unlocked
    const accountAch = existingCloudOrAccount.achievements || [];
    const mergedAchievements = currentGuestData.achievements.map(a => {
      const accAch = accountAch.find(aa => aa.id === a.id);
      const isUnlocked = a.unlocked || !!accAch?.unlocked;
      return {
        ...a,
        unlocked: isUnlocked,
        unlockedAt: a.unlockedAt || accAch?.unlockedAt || (isUnlocked ? new Date().toLocaleDateString('id-ID') : undefined)
      };
    });

    // 5. Recently played: merge and deduplicate
    const combinedRecents = [
      ...currentGuestData.recentlyPlayed,
      ...(existingCloudOrAccount.recentlyPlayed || [])
    ];
    const uniqueRecentsMap = new Map<string, RecentlyPlayedEntry>();
    combinedRecents.forEach(r => {
      const existing = uniqueRecentsMap.get(r.gameId);
      if (!existing || r.lastPlayedAt > existing.lastPlayedAt) {
        uniqueRecentsMap.set(r.gameId, r);
      }
    });
    const mergedRecentlyPlayed = Array.from(uniqueRecentsMap.values())
      .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
      .slice(0, 20);

    return {
      profile: mergedProfile,
      games: mergedGames,
      achievements: mergedAchievements,
      recentlyPlayed: mergedRecentlyPlayed
    };
  }

  // Register local account
  public async registerLocal(
    username: string,
    displayName: string,
    passwordPlain: string,
    currentGuestData: {
      profile: PlayerProfile;
      games: GameStats[];
      achievements: Achievement[];
      recentlyPlayed: RecentlyPlayedEntry[];
    }
  ): Promise<{ success: boolean; message: string; session?: UserSessionData }> {
    const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUser.length < 3) {
      return { success: false, message: 'Username minimal 3 karakter alfanumerik.' };
    }
    if (passwordPlain.length < 4) {
      return { success: false, message: 'Password minimal 4 karakter.' };
    }

    const accounts = this.getLocalAccounts();
    if (accounts.some(a => a.username.toLowerCase() === cleanUser)) {
      return { success: false, message: 'Username sudah terdaftar.' };
    }

    const passwordHash = await hashPassword(passwordPlain);
    const reconciled = this.reconcileUserData({}, currentGuestData);

    const newAccount: LocalAccount = {
      username: cleanUser,
      displayName: displayName.trim() || cleanUser.toUpperCase(),
      passwordHash,
      profile: {
        ...reconciled.profile,
        name: displayName.trim().toUpperCase() || cleanUser.toUpperCase()
      },
      games: reconciled.games,
      achievements: reconciled.achievements,
      recentlyPlayed: reconciled.recentlyPlayed,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    accounts.push(newAccount);
    this.saveLocalAccounts(accounts);
    localStorage.setItem('zigame_active_user', cleanUser);
    this.activeUser = cleanUser;

    const session: UserSessionData = {
      uid: 'local_' + cleanUser,
      username: cleanUser,
      displayName: newAccount.displayName,
      isAnonymous: false,
      isFirebase: false,
      profile: newAccount.profile,
      games: newAccount.games,
      achievements: newAccount.achievements,
      recentlyPlayed: newAccount.recentlyPlayed,
      lastSyncedAt: Date.now()
    };

    this.broadcastSession(session);
    return { success: true, message: 'Akun berhasil didaftarkan!', session };
  }

  // Login local account
  public async loginLocal(
    username: string,
    passwordPlain: string,
    currentGuestData: {
      profile: PlayerProfile;
      games: GameStats[];
      achievements: Achievement[];
      recentlyPlayed: RecentlyPlayedEntry[];
    }
  ): Promise<{ success: boolean; message: string; session?: UserSessionData }> {
    const cleanUser = username.trim().toLowerCase();
    const accounts = this.getLocalAccounts();
    const accountIndex = accounts.findIndex(a => a.username.toLowerCase() === cleanUser);

    if (accountIndex === -1) {
      return { success: false, message: 'Username tidak ditemukan.' };
    }

    const account = accounts[accountIndex];
    const passwordHash = await hashPassword(passwordPlain);

    // Support legacy plain-text migration if existing
    const isMatched = account.passwordHash === passwordHash || (account as any).password === passwordPlain;
    if (!isMatched) {
      return { success: false, message: 'Password salah.' };
    }

    // Merge offline progress if guest had higher score or coins
    const reconciled = this.reconcileUserData(account, currentGuestData);
    account.profile = reconciled.profile;
    account.games = reconciled.games;
    account.achievements = reconciled.achievements;
    account.recentlyPlayed = reconciled.recentlyPlayed;
    account.passwordHash = passwordHash; // upgrade if legacy
    account.updatedAt = Date.now();

    accounts[accountIndex] = account;
    this.saveLocalAccounts(accounts);

    localStorage.setItem('zigame_active_user', cleanUser);
    this.activeUser = cleanUser;

    const session: UserSessionData = {
      uid: 'local_' + cleanUser,
      username: cleanUser,
      displayName: account.displayName,
      isAnonymous: false,
      isFirebase: false,
      profile: account.profile,
      games: account.games,
      achievements: account.achievements,
      recentlyPlayed: account.recentlyPlayed,
      lastSyncedAt: Date.now()
    };

    this.broadcastSession(session);
    return { success: true, message: `Selamat datang kembali, ${account.displayName}!`, session };
  }

  // Login with Google (Firebase)
  public async loginWithGoogle(currentGuestData: {
    profile: PlayerProfile;
    games: GameStats[];
    achievements: Achievement[];
    recentlyPlayed: RecentlyPlayedEntry[];
  }): Promise<{ success: boolean; message: string; session?: UserSessionData }> {
    if (!isFirebaseReady() || !auth || !provider) {
      return { success: false, message: 'Firebase Authentication belum dikonfigurasi pada environment ini.' };
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const cloudData = await this.fetchFirestoreUserData(user.uid);

      const reconciled = this.reconcileUserData(cloudData || {}, currentGuestData);
      
      // Save back to Firestore
      await this.saveFirestoreUserData(user.uid, {
        profile: reconciled.profile,
        games: reconciled.games,
        achievements: reconciled.achievements,
        recentlyPlayed: reconciled.recentlyPlayed
      });

      const session: UserSessionData = {
        uid: user.uid,
        username: user.email || user.uid,
        displayName: user.displayName || reconciled.profile.name,
        isAnonymous: false,
        isFirebase: true,
        profile: reconciled.profile,
        games: reconciled.games,
        achievements: reconciled.achievements,
        recentlyPlayed: reconciled.recentlyPlayed,
        lastSyncedAt: Date.now()
      };

      this.broadcastSession(session);
      return { success: true, message: `Berhasil masuk dengan Google (${user.displayName})!`, session };
    } catch (e: any) {
      console.error('Google Sign-in Error:', e);
      return { success: false, message: e.message || 'Gagal login Google.' };
    }
  }

  // Logout
  public async logout(): Promise<void> {
    if (isFirebaseReady() && auth) {
      try {
        await fbSignOut(auth);
      } catch (e) {
        console.warn('Firebase signout warning:', e);
      }
    }

    localStorage.removeItem('zigame_active_user');
    this.activeUser = null;
    this.broadcastSession(null);
  }

  // Firestore Sync Helper
  private async fetchFirestoreUserData(uid: string): Promise<any | null> {
    if (!isFirebaseReady() || !db) return null;
    try {
      const userRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    } catch (e) {
      console.warn('Firestore fetch error:', e);
      return null;
    }
  }

  private async saveFirestoreUserData(uid: string, data: any): Promise<boolean> {
    if (!isFirebaseReady() || !db) return false;
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        ...data,
        lastSyncedAt: Date.now()
      }, { merge: true });
      return true;
    } catch (e) {
      console.warn('Firestore save error:', e);
      return false;
    }
  }
}

export const authService = new AuthService();
