import { useState, useRef, useEffect, useCallback } from 'react';

export type GameEngineState = 'ready' | 'countdown' | 'playing' | 'paused' | 'gameover';

export interface UseGameEngineOptions {
  onScoreUpdate?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
  maxDpr?: number;
}

export function useGameEngine({ onScoreUpdate, onGameOver, maxDpr = 1.5 }: UseGameEngineOptions = {}) {
  const [gameState, setGameState] = useState<GameEngineState>('ready');
  const [countdown, setCountdown] = useState<number>(3);
  const [score, setScore] = useState<number>(0);

  const gameStateRef = useRef<GameEngineState>(gameState);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);

  // Keep ref updated
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Tab visibility auto-pause
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };

    const handleBlur = () => {
      if (gameStateRef.current === 'playing') {
        setGameState('paused');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

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

  // Game over trigger helper
  const triggerGameOver = useCallback((finalScore?: number) => {
    stopLoop();
    setGameState('gameover');
    const s = finalScore !== undefined ? finalScore : score;
    if (onGameOver) {
      onGameOver(s);
    }
  }, [onGameOver, score, stopLoop]);

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

  // DPR capping canvas initializer
  const setupCanvasContext = useCallback((canvas: HTMLCanvasElement | null, width: number, height: number) => {
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    return ctx;
  }, [maxDpr]);

  return {
    gameState,
    setGameState,
    gameStateRef,
    countdown,
    score,
    setScore,
    updateScore,
    addScore,
    triggerGameOver,
    startWithCountdown,
    startLoop,
    stopLoop,
    setupCanvasContext,
  };
}
