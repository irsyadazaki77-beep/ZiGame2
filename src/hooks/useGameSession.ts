import { useState, useEffect, useRef, useCallback } from 'react';
import { GameStats, PlayerProfile, ShareResultData } from '../types';
import { audio } from '../utils/audio';
import { scoreService } from '../services/scoreService';
import { saveStateService } from '../services/saveStateService';
import { competitiveService } from '../services/competitiveService';
import { telemetryService } from '../services/telemetryService';
import { inputManager } from '../services/inputService';

import { screenShake } from '../utils/screenShake';
import { haptics } from '../utils/haptics';

export function useGameSession(
  activeGame: GameStats | undefined,
  profile: PlayerProfile,
  onScoreUpdate: (gameId: string, score: number) => void,
  onGameOver: (gameId: string, score: number, sessionId?: string, durationMs?: number) => void
) {
  const [key, setKey] = useState(0);
  const [isRankedMode, setIsRankedMode] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [shareResultData, setShareResultData] = useState<ShareResultData | null>(null);
  const [hasExistingSave, setHasExistingSave] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  const currentSessionIdRef = useRef<string | undefined>(undefined);
  const sessionStartTimeRef = useRef<number>(Date.now());

  // Initialize recently played
  const [recentlyPlayed, setRecentlyPlayed] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('zigame_recently_played');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track game start and session creation
  useEffect(() => {
    if (activeGame) {
      telemetryService.recordGameStart(activeGame.id, inputManager.getActiveSource());
      let isMounted = true;
      setIsStartingSession(true);
      setSessionError(null);
      
      if (isRankedMode) {
        competitiveService.startRankedSession(activeGame.id).then((res) => {
          if (!isMounted) return;
          if (res && res.sessionId) {
            currentSessionIdRef.current = res.sessionId;
            sessionStartTimeRef.current = res.startTime || Date.now();
            setIsStartingSession(false);
          } else {
            setSessionError('Gagal memulai sesi Ranked. Silakan coba lagi.');
            setIsRankedMode(false);
            setIsStartingSession(false);
          }
        }).catch(err => {
          if (!isMounted) return;
          setSessionError(err.message || 'Gagal memulai sesi Ranked. Tiket mungkin tidak mencukupi.');
          setIsRankedMode(false);
          setIsStartingSession(false);
        });
      } else {
        scoreService.startSession(activeGame.id).then((res) => {
          if (!isMounted) return;
          if (res && res.sessionId) {
             currentSessionIdRef.current = res.sessionId;
             sessionStartTimeRef.current = res.startTime || Date.now();
          }
          setIsStartingSession(false);
        }).catch(err => {
          if (!isMounted) return;
          setSessionError('Gagal memulai sesi.');
          setIsStartingSession(false);
        });
      }
      return () => { isMounted = false; };
    }
  }, [activeGame, key, profile.name, isRankedMode]);

  // Check save-state and tutorial status on gameId change
  useEffect(() => {
    if (!activeGame?.id) return;
    const gameId = activeGame.id;

    setRecentlyPlayed((prev) => {
      const filtered = prev.filter((id) => id !== gameId);
      const updated = [gameId, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('zigame_recently_played', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    setHasExistingSave(saveStateService.hasSaveState(gameId));
    setIsTutorialOpen(false);
  }, [activeGame?.id]);

  const handleRestart = useCallback(() => {
    audio.playCoin();
    setKey((prev) => prev + 1);
    setShareResultData(null);
  }, []);

  const handleScoreUpdate = useCallback((score: number) => {
    if (activeGame) {
      onScoreUpdate(activeGame.id, score);
    }
  }, [activeGame, onScoreUpdate]);

  const handleWrappedGameOver = useCallback(async (score: number) => {
    if (!activeGame) return;
    audio.playGameOver();
    screenShake.trigger('medium');
    haptics.trigger('error');
    telemetryService.recordGameOver(activeGame.id, score, undefined, inputManager.getActiveSource());
    
    let competitiveRatingChange = 0;
    let competitiveTier = undefined;
    const sessionDuration = sessionStartTimeRef.current ? Math.max(0, Date.now() - sessionStartTimeRef.current) : undefined;

    if (isRankedMode && currentSessionIdRef.current) {
      const res = await competitiveService.submitRankedScore({
        gameId: activeGame.id,
        score,
        sessionId: currentSessionIdRef.current,
        playerName: profile.name,
        playerAvatar: profile.avatar,
        durationMs: sessionDuration,
        masteryLevel: profile.mastery?.[activeGame.id]?.level || 1,
        idempotencyKey: 'rank_' + currentSessionIdRef.current
      });

      if (res) {
        competitiveRatingChange = res.ratingChange;
        competitiveTier = res.newTier;
      }
    } else {
      onGameOver(activeGame.id, score, currentSessionIdRef.current, sessionDuration);
    }

    const isPb = score > (activeGame.highScore || 0);
    const masteryData = profile.mastery?.[activeGame.id] || { level: 1, xp: 0 };
    setShareResultData({
      gameId: activeGame.id,
      gameTitle: activeGame.title,
      gameIcon: activeGame.icon,
      score,
      highScore: Math.max(activeGame.highScore || 0, score),
      isPersonalBest: isPb,
      masteryLevel: masteryData.level,
      masteryXpGained: Math.max(10, Math.floor(score * 0.1)),
      competitiveRatingChange,
      competitiveTier: (competitiveTier as any),
      timestamp: Date.now()
    });
  }, [activeGame, onGameOver, profile, isRankedMode]);

  return {
    key,
    isRankedMode,
    setIsRankedMode,
    isStartingSession,
    sessionError,
    shareResultData,
    setShareResultData,
    hasExistingSave,
    setHasExistingSave,
    isTutorialOpen,
    setIsTutorialOpen,
    recentlyPlayed,
    handleRestart,
    handleScoreUpdate,
    handleWrappedGameOver
  };
}
