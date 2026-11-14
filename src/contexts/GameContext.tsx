import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PlayerProfile, GameStats, Achievement, DailyMission, RecentlyPlayedEntry, GameMastery } from '../types';
import { useToast } from '../utils/ToastContext';
import { usePlayerProfile } from '../hooks/usePlayerProfile';
import { useGameProgress } from '../hooks/useGameProgress';
import { useProgressionManager } from '../hooks/useProgressionManager';
import { useAuth } from './AuthContext';
import { syncDataToCloud, fetchCloudData, mergeUserData } from '../services/sync';
import { economyService } from '../services/economyService';
import { INITIAL_GAMES } from '../data/games';

interface GameContextType {
  profile: PlayerProfile;
  setProfile: (p: PlayerProfile) => void;
  handleUpdateProfile: (updates: Partial<PlayerProfile>) => void;
  games: GameStats[];
  setGames: (g: GameStats[]) => void;
  achievements: Achievement[];
  setAchievements: (a: Achievement[]) => void;
  dailyMissions: DailyMission[];
  setDailyMissions: (m: DailyMission[]) => void;
  recentlyPlayed: RecentlyPlayedEntry[];
  setRecentlyPlayed: (r: RecentlyPlayedEntry[]) => void;
  clearRecentlyPlayed: () => void;
  handleSelectGame: (id: string) => void;
  handleScoreUpdate: (gameId: string, score: number) => void;
  handleGameOver: (gameId: string, finalScore: number, sessionId?: string, sessionDuration?: number) => Promise<void>;
  handleResetStats: () => void;
  masteries: Record<string, GameMastery>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const { profile, setProfile, handleUpdateProfile: rawUpdateProfile } = usePlayerProfile();
  const { masteries, processGameSession } = useProgressionManager(profile, rawUpdateProfile, INITIAL_GAMES);
  const gameProgress = useGameProgress(profile, rawUpdateProfile, showToast, processGameSession);

  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('zigame_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return systemPrefersDark ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('zigame_theme', next);
        document.documentElement.setAttribute('data-theme', next);
        if (next === 'light') {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        }
      } catch (e) {
        console.error('Error toggling theme', e);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    if (profile.settings?.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }, [profile.settings?.reducedMotion]);

  const { user, isFirebaseUser } = useAuth();
  const hydratedCloudUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseUser || !user?.uid) {
      hydratedCloudUidRef.current = null;
      return;
    }

    let isCancelled = false;
    hydratedCloudUidRef.current = null;

    async function syncOnAuth() {
      try {
        const [cloudData, authoritativeCoins] = await Promise.all([
          fetchCloudData().catch(err => {
            console.error('Failed to fetch cloud data during auth sync:', err);
            return null;
          }),
          economyService.syncBalance().catch(err => {
            console.error('Failed to sync balance during auth sync:', err);
            return null;
          })
        ]);

        if (isCancelled) return;

        // Strictly authoritative cloud hydration: local guest coins/scores/inventory never overwrite Firestore
        const authoritativeState = mergeUserData(
          {
            profile,
            games: gameProgress.games,
            achievements: gameProgress.achievements,
            missions: gameProgress.dailyMissions,
            recentlyPlayed: gameProgress.recentlyPlayed
          },
          cloudData || {}
        );

        const nextProfile: PlayerProfile = {
          ...authoritativeState.profile,
          name: cloudData?.profile?.name || user?.displayName || authoritativeState.profile.name,
          coins: typeof authoritativeCoins === 'number'
            ? authoritativeCoins
            : authoritativeState.profile.coins
        };

        setProfile(nextProfile);
        gameProgress.setGames(authoritativeState.games);
        gameProgress.setAchievements(authoritativeState.achievements);
        if (authoritativeState.missions.length > 0) {
          gameProgress.setDailyMissions(authoritativeState.missions);
        }
        gameProgress.setRecentlyPlayed(authoritativeState.recentlyPlayed);

        hydratedCloudUidRef.current = user?.uid || null;

        if (cloudData) {
          showToast('Sinkronisasi Sukses', 'Data profil cloud berhasil dimuat (Server Authoritative).', 'success', '☁️');
        } else {
          // Initialize clean cloud record for first-time authenticated user without importing local guest wallet/scores
          await syncDataToCloud(
            nextProfile,
            authoritativeState.games,
            authoritativeState.achievements,
            gameProgress.dailyMissions,
            authoritativeState.recentlyPlayed
          ).catch(err => {
            console.error('Failed to upload initial cloud baseline:', err);
          });
          showToast('Akun Cloud Siap', 'Profil cloud baru diinisialisasi dengan saldo server.', 'success', '☁️');
        }
      } catch (err) {
        console.error('Unexpected error during syncOnAuth:', err);
      }
    }

    syncOnAuth();

    return () => {
      isCancelled = true;
    };
  }, [isFirebaseUser, user?.uid]);

  useEffect(() => {
    // Only sync to Firestore after authoritative cloud hydration has completed for the active user
    if (isFirebaseUser && user?.uid && hydratedCloudUidRef.current === user.uid) {
      const timer = setTimeout(() => {
        syncDataToCloud(
          profile,
          gameProgress.games,
          gameProgress.achievements,
          gameProgress.dailyMissions,
          gameProgress.recentlyPlayed
        ).catch(err => {
          console.error('Failed to sync user data to cloud:', err);
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [
    isFirebaseUser,
    user?.uid,
    profile,
    gameProgress.games,
    gameProgress.achievements,
    gameProgress.dailyMissions,
    gameProgress.recentlyPlayed
  ]);

  const {
    games,
    setGames,
    achievements,
    setAchievements,
    dailyMissions,
    setDailyMissions,
    recentlyPlayed,
    setRecentlyPlayed,
    clearRecentlyPlayed: rawClearRecentlyPlayed,
    handleSelectGame: rawHandleSelectGame,
    handleScoreUpdate: rawHandleScoreUpdate,
    handleGameOver: rawHandleGameOver,
    handleResetStats: rawHandleResetStats
  } = gameProgress;

  const handleUpdateProfile = useCallback(
    (updates: Partial<PlayerProfile>) => {
      rawUpdateProfile(updates);
    },
    [rawUpdateProfile]
  );

  const clearRecentlyPlayed = useCallback(() => {
    rawClearRecentlyPlayed();
  }, [rawClearRecentlyPlayed]);

  const handleSelectGame = useCallback(
    (id: string) => {
      rawHandleSelectGame(id);
    },
    [rawHandleSelectGame]
  );

  const handleScoreUpdate = useCallback(
    (gameId: string, score: number) => {
      rawHandleScoreUpdate(gameId, score);
    },
    [rawHandleScoreUpdate]
  );

  const handleGameOver = useCallback(
    (gameId: string, finalScore: number, sessionId?: string, sessionDuration?: number) =>
      rawHandleGameOver(gameId, finalScore, sessionId, sessionDuration),
    [rawHandleGameOver]
  );

  const handleResetStats = useCallback(() => {
    rawHandleResetStats();
  }, [rawHandleResetStats]);

  const contextValue = useMemo<GameContextType>(
    () => ({
      profile,
      setProfile,
      handleUpdateProfile,
      games,
      setGames,
      achievements,
      setAchievements,
      dailyMissions,
      setDailyMissions,
      recentlyPlayed,
      setRecentlyPlayed,
      clearRecentlyPlayed,
      handleSelectGame,
      handleScoreUpdate,
      handleGameOver,
      handleResetStats,
      masteries,
      theme,
      toggleTheme
    }),
    [
      profile,
      setProfile,
      handleUpdateProfile,
      games,
      setGames,
      achievements,
      setAchievements,
      dailyMissions,
      setDailyMissions,
      recentlyPlayed,
      setRecentlyPlayed,
      clearRecentlyPlayed,
      handleSelectGame,
      handleScoreUpdate,
      handleGameOver,
      handleResetStats,
      masteries,
      theme,
      toggleTheme
    ]
  );

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
}
