import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GameRuntimeContext, GameRuntimeState } from '../types/gameSdk';
import { createGameRuntimeContext } from './runtimeContext';
import { PerformanceSettings } from '../types';

export interface UseGameSDKOptions {
  gameId: string;
  initialScore?: number;
  onScoreUpdate?: (score: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  maxDpr?: number;
}

export function useGameSDK({
  gameId,
  initialScore = 0,
  onScoreUpdate,
  onGameOver,
  onPause,
  onResume,
  onRestart,
  maxDpr
}: UseGameSDKOptions) {
  // Stable refs for callbacks
  const onScoreUpdateRef = useRef(onScoreUpdate);
  const onGameOverRef = useRef(onGameOver);
  const onPauseRef = useRef(onPause);
  const onResumeRef = useRef(onResume);
  const onRestartRef = useRef(onRestart);

  useEffect(() => {
    onScoreUpdateRef.current = onScoreUpdate;
    onGameOverRef.current = onGameOver;
    onPauseRef.current = onPause;
    onResumeRef.current = onResume;
    onRestartRef.current = onRestart;
  });

  // Create runtime context once per mount
  const ctx = useMemo<GameRuntimeContext>(() => {
    return createGameRuntimeContext({
      gameId,
      initialScore,
      onScoreUpdate: (s) => onScoreUpdateRef.current?.(s),
      onGameOver: (s) => onGameOverRef.current?.(s),
      onPause: () => onPauseRef.current?.(),
      onResume: () => onResumeRef.current?.(),
      onRestart: () => onRestartRef.current?.()
    });
  }, [gameId, initialScore]);

  // React State Mirrors for UI rendering
  const [gameState, setGameStateInternal] = useState<GameRuntimeState>(() => ctx.lifecycle.getState());
  const [score, setScoreInternal] = useState<number>(() => ctx.score.get());
  const [countdown, setCountdown] = useState<number>(3);
  const [perfSettings, setPerfSettings] = useState<PerformanceSettings>(() => ctx.performance.getSettings());

  const gameStateRef = useRef<GameRuntimeState>(gameState);
  const scoreRef = useRef<number>(score);

  // Subscribe to SDK state changes
  useEffect(() => {
    const unsubLifecycle = ctx.lifecycle.subscribe((state) => {
      gameStateRef.current = state;
      setGameStateInternal(state);
    });

    const unsubScore = ctx.score.subscribe((s) => {
      scoreRef.current = s;
      setScoreInternal(s);
    });

    const unsubPerf = ctx.performance.subscribe((p) => {
      setPerfSettings(p);
    });

    return () => {
      unsubLifecycle();
      unsubScore();
      unsubPerf();
      ctx.lifecycle.destroy();
      ctx.input.vibrate(0, 0);
    };
  }, [ctx]);

  // Actions wrapped in useCallback
  const startWithCountdown = useCallback((onComplete?: () => void) => {
    setCountdown(3);
    ctx.lifecycle.startWithCountdown(onComplete);
  }, [ctx]);

  const pauseGame = useCallback(() => {
    ctx.lifecycle.pauseGame();
  }, [ctx]);

  const resumeGame = useCallback(() => {
    ctx.lifecycle.resumeGame();
  }, [ctx]);

  const togglePause = useCallback(() => {
    ctx.lifecycle.togglePause();
  }, [ctx]);

  const triggerGameOver = useCallback((finalScore?: number) => {
    ctx.lifecycle.triggerGameOver(finalScore);
  }, [ctx]);

  const triggerRestart = useCallback(() => {
    ctx.lifecycle.triggerRestart();
  }, [ctx]);

  const addScore = useCallback((points: number) => {
    return ctx.score.add(points);
  }, [ctx]);

  const updateScore = useCallback((newScore: number) => {
    ctx.score.set(newScore);
  }, [ctx]);

  const setScore = useCallback((newScore: number) => {
    ctx.score.set(newScore);
  }, [ctx]);

  const setGameState = useCallback((state: any) => {
    ctx.lifecycle.setState(state);
  }, [ctx]);

  const startLoop = useCallback((stepFn: (timestamp: number, deltaTime: number) => void) => {
    ctx.loop.start(stepFn);
  }, [ctx]);

  const stopLoop = useCallback(() => {
    ctx.loop.stop();
  }, [ctx]);

  const setupCanvasContext = useCallback((canvas: HTMLCanvasElement | null, width: number, height: number) => {
    return ctx.viewport.setupCanvas(canvas, width, height, maxDpr);
  }, [ctx, maxDpr]);

  return {
    ctx,
    gameState,
    setGameState,
    gameStateRef,
    score,
    setScore,
    updateScore,
    addScore,
    scoreRef,
    countdown,
    perfSettings,
    startWithCountdown,
    pauseGame,
    resumeGame,
    togglePause,
    triggerGameOver,
    triggerRestart,
    startLoop,
    stopLoop,
    setupCanvasContext
  };
}
