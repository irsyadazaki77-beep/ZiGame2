import { useState, useRef, useEffect, useCallback } from 'react';
import { GameLifecycleState } from '../types';
import { performanceService } from '../services/performanceService';
import { audio } from '../utils/audio';

export type GameEngineState = GameLifecycleState;

export interface UseGameEngineOptions {
  gameId?: string;
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
  const scoreRef = useRef<number>(0);
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
    let frameCounter = 0;
    let fpsTimer = performance.now();

    performanceService.registerRafStart();

    const loop = (timestamp: number) => {
      if (gameStateRef.current !== 'playing') {
        performanceService.registerRafEnd();
        stopLoop();
        return;
      }

      const rawDelta = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;
      
      // Cap delta time to prevent physics explosions after background tab sleep (50ms cap)
      const safeDelta = Math.min(Math.max(rawDelta, 1), 50);

      // Track FPS for performanceService
      frameCounter++;
      if (timestamp - fpsTimer >= 1000) {
        performanceService.recordFramePerformance(frameCounter);
        frameCounter = 0;
        fpsTimer = timestamp;
      }

      callback(timestamp, safeDelta);

      if (gameStateRef.current === 'playing') {
        animFrameRef.current = requestAnimationFrame(loop);
      } else {
        performanceService.registerRafEnd();
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
    scoreRef.current = newScore;
    if (onScoreUpdate) {
      onScoreUpdate(newScore);
    }
  }, [onScoreUpdate]);

  const addScore = useCallback((points: number) => {
    setScore(prev => {
      const next = prev + points;
      scoreRef.current = next;
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
    const s = finalScore !== undefined ? finalScore : scoreRef.current;
    if (onGameOver) {
      onGameOver(s);
    }
  }, [onGameOver, stopLoop]);

  // Restart trigger
  const triggerRestart = useCallback(() => {
    stopLoop();
    setScore(0);
    scoreRef.current = 0;
    setGameState('ready');
    if (onRestart) onRestart();
  }, [onRestart, stopLoop]);

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Start with countdown
  const startWithCountdown = useCallback((onCountdownEnd?: () => void) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setGameState('countdown');
    setCountdown(3);
    setScore(0);
    scoreRef.current = 0;
    audio.playCountdownTick();

    let current = 3;
    countdownTimerRef.current = setInterval(() => {
      current--;
      if (current > 0) {
        setCountdown(current);
        audio.playCountdownTick();
      } else {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        audio.playCountdownGo();
        setGameState('playing');
        if (onCountdownEnd) onCountdownEnd();
      }
    }, 800);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    scoreRef,
    gameLoopRef: animFrameRef,
    setupCanvasContext,
    perfSettings
  };
}
