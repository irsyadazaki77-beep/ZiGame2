import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameStats, Achievement, DailyMission, PlayerProfile, RecentlyPlayedEntry } from '../types';
import { INITIAL_GAMES } from '../data/games';
import { INITIAL_ACHIEVEMENTS } from '../data/achievements';
import { generateDailyMissions, getTodayDateString } from '../data/missions';
import { storageService } from '../services/storageService';
import { scoreService } from '../services/scoreService';
import { audio } from '../utils/audio';
import { auth, isFirebaseReady } from '../services/firebase';

export const useGameProgress = (
  profile: PlayerProfile,
  onUpdateProfile: (updates: Partial<PlayerProfile> | ((prev: PlayerProfile) => PlayerProfile)) => void,
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info', icon?: string) => void,
  processGameSession: (gameId: string, score: number, durationMs: number) => any
) => {
  const navigate = useNavigate();
  const [games, setGames] = useState<GameStats[]>(INITIAL_GAMES);
  const [achievements, setAchievements] = useState<Achievement[]>(INITIAL_ACHIEVEMENTS);
  const [dailyMissions, setDailyMissions] = useState<DailyMission[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedEntry[]>([]);


  // Initialize data from storage on mount
  useEffect(() => {
    const savedGames = storageService.getGamesStats();
    if (savedGames) {
      const mergedGames = INITIAL_GAMES.map(initialGame => {
        const found = savedGames.find((g: GameStats) => g.id === initialGame.id);
        return found ? { ...initialGame, plays: found.plays, highScore: found.highScore } : initialGame;
      });
      setGames(mergedGames);
    }

    const savedAchievements = storageService.getAchievements();
    if (savedAchievements) {
      const mergedAchievements = INITIAL_ACHIEVEMENTS.map(initialAch => {
        const found = savedAchievements.find((a: Achievement) => a.id === initialAch.id);
        return found ? { ...initialAch, unlocked: found.unlocked, unlockedAt: found.unlockedAt } : initialAch;
      });
      setAchievements(mergedAchievements);
    }

    const savedMissions = storageService.getDailyMissions();
    const today = getTodayDateString();
    let currentMissions: DailyMission[] = [];

    if (savedMissions) {
      if (savedMissions.length === 0 || savedMissions[0].date !== today) {
        currentMissions = generateDailyMissions(INITIAL_GAMES);
      } else {
        currentMissions = savedMissions;
      }
    } else {
      currentMissions = generateDailyMissions(INITIAL_GAMES);
    }

    setDailyMissions(currentMissions);
    storageService.saveDailyMissions(currentMissions);

    const savedRecentlyPlayed = storageService.getRecentlyPlayed();
    if (savedRecentlyPlayed) {
      setRecentlyPlayed(savedRecentlyPlayed);
    }
  }, []);

  const updateRecentlyPlayed = (gameId: string, finalScore?: number, sessionDuration?: number) => {
    setRecentlyPlayed(prev => {
      const now = Date.now();
      const existingIndex = prev.findIndex(r => r.gameId === gameId);
      let newEntry: RecentlyPlayedEntry;
      
      const gameInfo = games.find(g => g.id === gameId) || INITIAL_GAMES.find(g => g.id === gameId);
      const currentHighScore = gameInfo?.highScore || 0;
      
      if (existingIndex >= 0) {
        newEntry = {
          ...prev[existingIndex],
          lastPlayedAt: now,
          lastScore: finalScore !== undefined ? finalScore : prev[existingIndex].lastScore,
          highScore: currentHighScore,
          sessionDuration: sessionDuration !== undefined ? sessionDuration : prev[existingIndex].sessionDuration
        };
      } else {
        newEntry = {
          gameId,
          lastPlayedAt: now,
          lastScore: finalScore,
          highScore: currentHighScore,
          sessionDuration
        };
      }
      
      let updatedList = [newEntry, ...prev.filter(r => r.gameId !== gameId)];
      if (updatedList.length > 20) {
        updatedList = updatedList.slice(0, 20);
      }
      
      storageService.saveRecentlyPlayed(updatedList);
      return updatedList;
    });
  };

  const handleSelectGame = (gameId: string) => {
    audio.playCoin();

    // Increment play count
    const updatedGames = games.map(g => {
      if (g.id === gameId) {
        return { ...g, plays: g.plays + 1 };
      }
      return g;
    });
    setGames(updatedGames);
    storageService.saveGamesStats(updatedGames);
    // checkMissions('play', gameId, 1);
    
    // Add to recently played (without score initially)
    updateRecentlyPlayed(gameId);

    navigate(`/game/${gameId}`);
  };

  const handleScoreUpdate = (gameId: string, currentScore: number) => {
    // Real-time achievement checking
    checkAchievements(gameId, currentScore);
  };

  const handleGameOver = async (gameId: string, finalScore: number, sessionId?: string, sessionDuration?: number) => {
    // Validate score with server only if the user is authenticated with Firebase
    const activeUser = localStorage.getItem('zigame_active_user');
    const isOfflineProfile = activeUser && activeUser !== auth?.currentUser?.uid && activeUser !== auth?.currentUser?.email;

    if (!isFirebaseReady() || !auth?.currentUser || isOfflineProfile) {
      console.log('Offline/Local profile detected. Score saved locally, not submitted to public cloud leaderboard.');
    } else {
      const result = await scoreService.submitScore({
        gameId,
        score: finalScore,
        playerName: profile.name,
        playerAvatar: profile.avatar,
        sessionId
      });

      if (!result.success) {
        console.warn('Score rejected by server:', result.message);
        showToast('Skor Ditolak', result.message || 'Gagal memvalidasi sesi', 'error');
        return; // Don't save if server rejects
      }
    }

    let isHighScore = false;
    // Update game highscore
    const updatedGames = games.map(g => {
      if (g.id === gameId && finalScore > g.highScore) {
        isHighScore = true;
        return { ...g, highScore: finalScore };
      }
      return g;
    });

    // Update streak logic
    const todayStr = getTodayDateString();
    let newStreak = profile.streak || 0;
    
    if (profile.lastPlayDate) {
      const lastDate = new Date(profile.lastPlayDate);
      const todayDate = new Date(todayStr);
      const diffTime = Math.abs(todayDate.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = Math.max(0, newStreak - 1);
      }
    } else {
      newStreak = 1;
    }
    const xpResult = processGameSession(gameId, finalScore, sessionDuration || 0);



    setGames(updatedGames);
    storageService.saveGamesStats(updatedGames);

    updateRecentlyPlayed(gameId, finalScore, sessionDuration);
    
    // We expect the server to give us coinsEarned and newBalance in result if we updated scoreService to return it.
    // Wait, let's just use the server result if available, or sync it.
    // Sync balance after playing a game
    import('../services/economyService').then(({ economyService }) => {
      economyService.syncBalance(profile.name).then(serverCoins => {
         if (serverCoins !== null) {
            onUpdateProfile(prev => ({
              ...prev,
              streak: newStreak,
              lastPlayDate: todayStr,
              coins: serverCoins
            }));
         }
      });
    });

    // Optimistic update if economy sync is slow
    onUpdateProfile(prev => ({
      ...prev,
      streak: newStreak,
      lastPlayDate: todayStr
    }));
    
    checkMissions('score', gameId, finalScore, isHighScore);
    checkAchievements(gameId, finalScore);
  };

  
  const checkMissions = (eventType: 'play' | 'score', gameId: string, value: number, isHighScore: boolean = false) => {
    const today = getTodayDateString();
    let updated = false;
    
    // Find game genre
    const game = games.find(g => g.id === gameId);
    const genre = game ? game.genre : 'Unknown';

    const updatedMissions = dailyMissions.map(m => {
      if (m.date !== today || m.completed) return m;
      
      let newProgress = m.progress;
      let shouldComplete = false;
      let newMetadata = m.metadata ? { ...m.metadata } : undefined;
      
      if (eventType === 'play') {
        if (m.type === 'play_count') {
          // Play count increment handled in score event (session completion) or here
          // We'll require minimal time, so maybe let's handle play_count in 'score' event to ensure valid sessions
        }
      } else if (eventType === 'score') {
        if (m.type === 'play_count') {
           newProgress += 1;
        } else if (m.type === 'score_target' && m.gameId === gameId) {
          if (value >= m.target) {
            newProgress = m.target;
          }
        } else if (m.type === 'beat_pb' && isHighScore) {
          newProgress = 1;
        } else if (m.type === 'total_score') {
          newProgress += value;
        } else if (m.type === 'play_genre_count') {
          if (!newMetadata) newMetadata = { genresPlayed: [] };
          if (!newMetadata.genresPlayed) newMetadata.genresPlayed = [];
          if (!newMetadata.genresPlayed.includes(genre)) {
            newMetadata.genresPlayed.push(genre);
            newProgress = newMetadata.genresPlayed.length;
          }
        }
      }
      
      if (newProgress >= m.target && !m.completed) {
        newProgress = m.target;
        shouldComplete = true;
        showToast('Misi Harian Selesai', `${m.description} (+${m.rewardCoins} Coins)`, 'success', '🎯');
      }
      
      if (newProgress !== m.progress || shouldComplete) {
        updated = true;
        return { ...m, progress: newProgress, completed: shouldComplete, metadata: newMetadata };
      }
      return m;
    });

    if (updated) {
      setDailyMissions(updatedMissions);
      storageService.saveDailyMissions(updatedMissions);
      
      const newlyCompletedMissions = updatedMissions.filter(m => m.completed && dailyMissions.find(om => om.id === m.id && !om.completed));
      if (newlyCompletedMissions.length > 0) {
        import('../services/economyService').then(({ economyService }) => {
          newlyCompletedMissions.forEach(m => {
            economyService.claimReward(m.id, 'daily_mission', profile.name).then(res => {
              if (res.success && res.newBalance !== undefined) {
                onUpdateProfile(prev => ({
                  ...prev,
                  coins: res.newBalance
                }));
              }
            });
          });
        });
      }
    }
  };

  const checkAchievements = (gameId: string, currentScore: number) => {
    let newlyUnlocked = false;
    const unlockedIds: string[] = [];
    const updatedAchievements = achievements.map((ach) => {
      if (!ach.unlocked && ach.gameId === gameId) {
        if (ach.target && currentScore >= ach.target) {
          newlyUnlocked = true;
          unlockedIds.push(ach.id);
          showToast('Achievement Unlocked', `${ach.title} (+${ach.rewardCoins} Coins)`, 'success', ach.icon);
          return {
            ...ach,
            unlocked: true,
            unlockedAt: new Date().toLocaleDateString('id-ID'),
          };
        }
      }
      return ach;
    });

    if (newlyUnlocked) {
      audio.playLevelUp();
      setAchievements(updatedAchievements);
      storageService.saveAchievements(updatedAchievements);

      import('../services/economyService').then(({ economyService }) => {
        unlockedIds.forEach(achId => {
          economyService.claimReward(achId, 'achievement', profile.name).then(res => {
            if (res.success && res.newBalance !== undefined) {
              onUpdateProfile(prev => ({
                ...prev,
                coins: res.newBalance
              }));
            }
          });
        });
      });
    }
  };

  const handleResetStats = () => {
    setGames(INITIAL_GAMES);
    setAchievements(INITIAL_ACHIEVEMENTS);
    
    onUpdateProfile(prev => ({
      ...prev,
      coins: 0
    }));

    storageService.saveGamesStats(INITIAL_GAMES);
    storageService.saveAchievements(INITIAL_ACHIEVEMENTS);
  };

  const clearRecentlyPlayed = () => {
    setRecentlyPlayed([]);
    storageService.saveRecentlyPlayed([]);
  };

  return {
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
  };
};

export default useGameProgress;
