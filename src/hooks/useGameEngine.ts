import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GameLifecycleState, PerformanceSettings } from '../types';
import { createGameRuntimeContext } from '../sdk/runtimeContext';
import { GameRuntimeContext } from '../types/gameSdk';

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
  gameId = 'arcade-game',
  onScoreUpdate,
  onGameOver,
  onPause,
  onResume,
  onRestart,
  maxDpr
}: UseGameEngineOptions = {}) {
  // Stable refs for event callbacks
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

  // Create authoritative runtime context
  const ctx = useMemo<GameRuntimeContext>(() => {
    return createGameRuntimeContext({
      gameId,
      onScoreUpdate: (s) => onScoreUpdateRef.current?.(s),
      onGameOver: (s) => onGameOverRef.current?.(s),
      onPause: () => onPauseRef.current?.(),
      onResume: () => onResumeRef.current?.(),
      onRestart: () => onRestartRef.current?.()
    });
  }, [gameId]);

  // React State Mirrors
  const [gameState, setGameStateInternal] = useState<GameEngineState>(() => ctx.lifecycle.getState() as GameEngineState);
  const [countdown, setCountdown] = useState<number>(3);
  const [score, setScoreInternal] = useState<number>(() => ctx.score.get());
  const [perfSettings, setPerfSettings] = useState<PerformanceSettings>(() => ctx.performance.getSettings());

  const gameStateRef = useRef<GameEngineState>(gameState);
  const scoreRef = useRef<number>(score);
  const animFrameRef = useRef<number | null>(null);

  // Sync state subscriptions
  useEffect(() => {
    const unsubLifecycle = ctx.lifecycle.subscribe((state) => {
      const mapped = state as GameEngineState;
      gameStateRef.current = mapped;
      setGameStateInternal(mapped);
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
    };
  }, [ctx]);

  // Loop control
  const stopLoop = useCallback(() => {
    ctx.loop.stop();
  }, [ctx]);

  const startLoop = useCallback((callback: (timestamp: number, deltaTime: number) => void) => {
    ctx.loop.start(callback);
  }, [ctx]);

  // Score handlers
  const updateScore = useCallback((newScore: number) => {
    ctx.score.set(newScore);
  }, [ctx]);

  const addScore = useCallback((points: number) => {
    ctx.score.add(points);
  }, [ctx]);

  const setScore = useCallback((newScore: number) => {
    ctx.score.set(newScore);
  }, [ctx]);

  // Lifecycle transitions
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

  const setGameState = useCallback((state: GameEngineState) => {
    ctx.lifecycle.setState(state as any);
  }, [ctx]);

  const startWithCountdown = useCallback((onCountdownEnd?: () => void) => {
    setCountdown(3);
    ctx.lifecycle.startWithCountdown(onCountdownEnd);
  }, [ctx]);

  // Viewport / canvas helper with DPR capping
  const setupCanvasContext = useCallback((canvas: HTMLCanvasElement | null, width: number, height: number) => {
    return ctx.viewport.setupCanvas(canvas, width, height, maxDpr);
  }, [ctx, maxDpr]);

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
    perfSettings,
    ctx
  };
}
