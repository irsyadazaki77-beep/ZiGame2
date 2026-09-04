import { useState, useCallback, useEffect } from 'react';
import { PlayerProfile, GameStats, GameMastery } from '../types';
import { progressionService } from '../services/progressionService';
import { useToast } from '../utils/ToastContext';
import { audio } from '../utils/audio';
import { storageService } from '../services/storageService';

export function useProgressionManager(
  profile: PlayerProfile,
  onUpdateProfile: (p: PlayerProfile) => void,
  games: GameStats[]
) {
  const { showToast } = useToast();
  
  // Load masteries from local storage or initialize empty
  const [masteries, setMasteries] = useState<Record<string, GameMastery>>(() => {
    const saved = localStorage.getItem('zigame_masteries');
    return saved ? JSON.parse(saved) : {};
  });

  // Persist masteries when changed
  useEffect(() => {
    localStorage.setItem('zigame_masteries', JSON.stringify(masteries));
  }, [masteries]);

  const processGameSession = useCallback((
    gameId: string, 
    score: number, 
    durationMs: number
  ) => {
    const durationSec = Math.floor(durationMs / 1000);
    const game = games.find(g => g.id === gameId);
    
    // Calculate XP payload
    const xpResult = progressionService.calculateSessionXp(game, score, durationSec);
    const { earnedXp } = xpResult;
    
    if (earnedXp <= 0) return;

    // --- 1. GLOBAL PROFILE PROGRESSION ---
    const currentTotalXp = profile.xp || 0;
    const newTotalXp = currentTotalXp + earnedXp;
    
    const currentLevelData = progressionService.calculateLevel(currentTotalXp);
    const newLevelData = progressionService.calculateLevel(newTotalXp);
    
    const leveledUp = newLevelData.level > currentLevelData.level;
    
    if (leveledUp) {
      showToast('LEVEL UP!', `Kamu mencapai Level ${newLevelData.level}! (+${earnedXp} XP)`, 'success', '⭐');
      audio.playLevelUp();
    }

    onUpdateProfile({
      ...profile,
      xp: newTotalXp,
      level: newLevelData.level,
      totalPlaytimeSec: (profile.totalPlaytimeSec || 0) + durationSec
    });

    // --- 2. PER-GAME MASTERY PROGRESSION ---
    setMasteries(prev => {
      const currentMastery = prev[gameId] || {
        gameId,
        xp: 0,
        level: 1,
        milestonesUnlocked: [],
        highestScore: 0,
        totalPlays: 0
      };

      const newMasteryXp = currentMastery.xp + earnedXp;
      const masteryLvlData = progressionService.calculateMasteryLevel(newMasteryXp);
      
      const masteryLeveledUp = masteryLvlData.level > currentMastery.level;
      
      if (masteryLeveledUp && !masteryLvlData.maxLevel) {
        setTimeout(() => {
          showToast('Mastery Up!', `Mastery ${game?.title || gameId} naik ke Lv.${masteryLvlData.level}!`, 'success', '🔥');
        }, 1500); // offset toast
      }

      return {
        ...prev,
        [gameId]: {
          ...currentMastery,
          xp: newMasteryXp,
          level: masteryLvlData.level,
          highestScore: Math.max(currentMastery.highestScore, score),
          totalPlays: currentMastery.totalPlays + 1,
          lastEarnedAt: Date.now()
        }
      };
    });

    return xpResult;

  }, [profile, onUpdateProfile, games, showToast]);

  return {
    masteries,
    processGameSession,
    getLevelInfo: progressionService.calculateLevel
  };
}
