import { useState, useRef, useEffect, useCallback } from 'react';
import { GameLifecycleState } from '../types';
import { performanceService } from '../services/performanceService';

export type GameEngineState = GameLifecycleState;

export interface UseGameEngineOptions {
  onScoreUpdate?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  maxDpr?: number;
}

export function useGameEngine({
  onScoreUpdate,
  onGameOver,
  onPause,
  onResume,
  onRestart,
  maxDpr
}: UseGameEngineOptions = {}) {
  const [gameState, setGameState] = useState<GameEngineState>('ready');
  const [countdown, setCountdown] = useState<number>(3);
  const [score, setScore] = useState<number>(0);
  const [perfSettings, setPerfSettings] = useState(() => performanceService.getSettings());

  const gameStateRef = useRef<GameEngineState>(gameState);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);

  // Sync performance settings
  useEffect(() => {
    return performanceService.subscribe((settings) => {
      setPerfSettings(settings);
    });
  }, []);

  // Keep ref updated
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Tab visibility auto-pause
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
        if (onPause) onPause();
      }
    };

    const handleBlur = () => {
      if (gameStateRef.current === 'playing') {
        setGameState('paused');
        if (onPause) onPause();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onPause]);

  // Safe requestAnimationFrame loop manager
  const stopLoop = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const startLoop = useCallback((callback: (timestamp: number, deltaTime: number) => void) => {
    stopLoop();
    lastTimestampRef.current = performance.now();

    const loop = (timestamp: number) => {
      if (gameStateRef.current !== 'playing') {
        stopLoop();
        return;
      }

      const rawDelta = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;
      
      // Cap delta time to prevent physics explosions after background tab sleep
      const safeDelta = Math.min(rawDelta, 100);

      callback(timestamp, safeDelta);

      if (gameStateRef.current === 'playing') {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [stopLoop]);

  // Clean up animation frames when state changes
  useEffect(() => {
    if (gameState !== 'playing') {
      stopLoop();
    }
  }, [gameState, stopLoop]);

  // Auto clean up on unmount
  useEffect(() => {
    return () => {
      stopLoop();
    };
  }, [stopLoop]);

  // Score management helper
  const updateScore = useCallback((newScore: number) => {
    setScore(newScore);
    if (onScoreUpdate) {
      onScoreUpdate(newScore);
    }
  }, [onScoreUpdate]);

  const addScore = useCallback((points: number) => {
    setScore(prev => {
      const next = prev + points;
      if (onScoreUpdate) onScoreUpdate(next);
      return next;
    });
  }, [onScoreUpdate]);

  const pauseGame = useCallback(() => {
    if (gameStateRef.current === 'playing') {
      setGameState('paused');
      stopLoop();
      if (onPause) onPause();
    }
  }, [onPause, stopLoop]);

  const resumeGame = useCallback(() => {
    if (gameStateRef.current === 'paused') {
      setGameState('playing');
      lastTimestampRef.current = performance.now();
      if (onResume) onResume();
    }
  }, [onResume]);

  const togglePause = useCallback(() => {
    if (gameStateRef.current === 'playing') {
      pauseGame();
    } else if (gameStateRef.current === 'paused') {
      resumeGame();
    }
  }, [pauseGame, resumeGame]);

  // Game over trigger helper
  const triggerGameOver = useCallback((finalScore?: number) => {
    stopLoop();
    setGameState('gameover');
    const s = finalScore !== undefined ? finalScore : score;
    if (onGameOver) {
      onGameOver(s);
    }
  }, [onGameOver, score, stopLoop]);

  // Restart trigger
  const triggerRestart = useCallback(() => {
    stopLoop();
    setScore(0);
    setGameState('ready');
    if (onRestart) onRestart();
  }, [onRestart, stopLoop]);

  // Start with countdown
  const startWithCountdown = useCallback((onCountdownEnd?: () => void) => {
    setGameState('countdown');
    setCountdown(3);
    setScore(0);

    let current = 3;
    const timer = setInterval(() => {
      current--;
      if (current > 0) {
        setCountdown(current);
      } else {
        clearInterval(timer);
        setGameState('playing');
        if (onCountdownEnd) onCountdownEnd();
      }
    }, 1000);
  }, []);

  // DPR capping canvas initializer with adaptive performance profile
  const setupCanvasContext = useCallback((canvas: HTMLCanvasElement | null, width: number, height: number) => {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const targetCap = maxDpr !== undefined ? maxDpr : perfSettings.dprCap;
    const dpr = Math.min(window.devicePixelRatio || 1, targetCap);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.scale(dpr, dpr);

    return ctx;
  }, [maxDpr, perfSettings.dprCap]);

  return {
    gameState,
    setGameState,
    gameStateRef,
    countdown,
    score,
    setScore,
    updateScore,
    addScore,
    pauseGame,
    resumeGame,
    togglePause,
    triggerGameOver,
    triggerRestart,
    startWithCountdown,
    startLoop,
    stopLoop,
    setupCanvasContext,
    perfSettings
  };
}
