import React, { createContext, useContext, useEffect, useState } from 'react';
import { PlayerProfile, GameStats, Achievement, DailyMission, RecentlyPlayedEntry } from '../types';
import { useToast } from '../utils/ToastContext';
import { usePlayerProfile } from '../hooks/usePlayerProfile';
import { useGameProgress } from '../hooks/useGameProgress';
import { useProgressionManager } from '../hooks/useProgressionManager';
import { GameMastery } from '../types';
import { auth, onAuthStateChanged, isFirebaseReady } from '../services/firebase';
import { syncDataToCloud, fetchCloudData } from '../services/sync';
import { INITIAL_GAMES } from '../data/games';
import { INITIAL_ACHIEVEMENTS } from '../data/achievements';

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
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const { profile, setProfile, handleUpdateProfile } = usePlayerProfile();
  const { masteries, processGameSession } = useProgressionManager(profile, handleUpdateProfile, INITIAL_GAMES);
  const gameProgress = useGameProgress(profile, handleUpdateProfile, showToast, processGameSession);

  useEffect(() => {
    if (profile.settings?.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }, [profile.settings?.reducedMotion]);

  useEffect(() => {
    if (!isFirebaseReady() || !auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const cloudData = await fetchCloudData();
        if (cloudData) {
          if (cloudData.profile) setProfile(cloudData.profile);
          if (cloudData.games) {
            const mergedGames = INITIAL_GAMES.map(initialGame => {
              const found = cloudData.games.find((g: GameStats) => g.id === initialGame.id);
              return found ? { ...initialGame, plays: found.plays, highScore: found.highScore } : initialGame;
            });
            gameProgress.setGames(mergedGames);
          }
          if (cloudData.achievements) {
            const mergedAchievements = INITIAL_ACHIEVEMENTS.map(initialAch => {
              const found = cloudData.achievements.find((a: Achievement) => a.id === initialAch.id);
              return found ? { ...initialAch, unlocked: found.unlocked, unlockedAt: found.unlockedAt } : initialAch;
            });
            gameProgress.setAchievements(mergedAchievements);
          }
          if (cloudData.missions) gameProgress.setDailyMissions(cloudData.missions);
          if (cloudData.recentlyPlayed) gameProgress.setRecentlyPlayed(cloudData.recentlyPlayed);
          showToast('Sinkronisasi Sukses', 'Data berhasil dimuat dari cloud.', 'success', '☁️');
        } else {
          syncDataToCloud(profile, gameProgress.games, gameProgress.achievements, gameProgress.dailyMissions, gameProgress.recentlyPlayed);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isFirebaseReady() && auth?.currentUser) {
      const timer = setTimeout(() => {
        syncDataToCloud(profile, gameProgress.games, gameProgress.achievements, gameProgress.dailyMissions, gameProgress.recentlyPlayed);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [profile, gameProgress.games, gameProgress.achievements, gameProgress.dailyMissions, gameProgress.recentlyPlayed]);

  return (
    <GameContext.Provider value={{ profile, setProfile, handleUpdateProfile, masteries, ...gameProgress }}>
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
