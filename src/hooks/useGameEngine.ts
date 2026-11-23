import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GameLifecycleState, PerformanceSettings } from '../types';
import { createGameRuntimeContext } from '../sdk/runtimeContext';
import { GameRuntimeContext } from '../types/gameSdk';
import { ThreeStageController } from '../utils/threeStage';
import { gamepadController } from '../sdk/gamepadController';
import { gameFx } from '../utils/gameFx';

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

    if (ctx.lifecycle.getState() === 'destroyed') {
      ctx.lifecycle.setState('ready');
    } else {
      const current = ctx.lifecycle.getState() as GameEngineState;
      gameStateRef.current = current;
      setGameStateInternal(current);
    }

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

  // Score handlers with automatic 3D Stage Juiciness (FOV kick, shockwave ring & particle burst)
  const trigger3DScoreJuice = useCallback((prevScore: number, nextScore: number) => {
    const delta = nextScore - prevScore;
    if (delta <= 0) return;
    const stage = ThreeStageController.getActiveStage();
    if (!stage) return;

    stage.kickFov(Math.min(3.2, 0.7 + delta * 0.03));
    const crossedHundred = Math.floor(nextScore / 100) > Math.floor(prevScore / 100);
    if (delta >= 25 || crossedHundred) {
      stage.triggerShockwave(0, 0.08, 0, undefined, crossedHundred ? 7.2 : 5.0, 0.55);
      stage.triggerTrauma(crossedHundred ? 0.22 : 0.12);
      gamepadController.triggerHapticPulse('light');
      if (crossedHundred) {
        gameFx.triggerImpact('milestone');
      } else if (delta >= 50) {
        gameFx.triggerImpact('combo');
      }
    }
  }, []);

  const updateScore = useCallback((newScore: number) => {
    const prev = scoreRef.current;
    ctx.score.set(newScore);
    trigger3DScoreJuice(prev, newScore);
  }, [ctx, trigger3DScoreJuice]);

  const addScore = useCallback((points: number) => {
    const prev = scoreRef.current;
    ctx.score.add(points);
    trigger3DScoreJuice(prev, prev + points);
  }, [ctx, trigger3DScoreJuice]);

  const setScore = useCallback((newScore: number) => {
    const prev = scoreRef.current;
    ctx.score.set(newScore);
    trigger3DScoreJuice(prev, newScore);
  }, [ctx, trigger3DScoreJuice]);

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
    const stage = ThreeStageController.getActiveStage();
    if (stage) {
      stage.triggerSlowMo(0.28, 0.42);
      stage.triggerTrauma(0.48);
      stage.triggerShockwave(0, 0.1, 0, 0xf43f5e, 7.5, 0.65);
    }
    gameFx.triggerImpact('damage');
    gamepadController.triggerHapticPulse('heavy');
    ctx.lifecycle.triggerGameOver(finalScore);
  }, [ctx]);

  // Auto-pause when tab is inactive / hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        const state = (gameStateRef.current as string)?.toLowerCase();
        if (state === 'playing') {
          pauseGame();
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [pauseGame]);

  const triggerRestart = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setScore(0);
    scoreRef.current = 0;
    ctx.lifecycle.triggerRestart();
  }, [ctx, setScore]);

  const setGameState = useCallback((state: GameEngineState) => {
    ctx.lifecycle.setState(state as any);
  }, [ctx]);

  const startWithCountdown = useCallback((onCountdownEnd?: () => void) => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setScore(0);
    scoreRef.current = 0;
    setCountdown(3);
    ctx.lifecycle.startWithCountdown(onCountdownEnd, (count) => {
      setCountdown(count);
    });
  }, [ctx, setScore]);

  // Viewport / canvas helper with DPR capping & deterministic transformation
  const setupCanvasContext = useCallback((canvas: HTMLCanvasElement | null, width?: number, height?: number) => {
    if (!canvas) return null;
    const w = width ?? (canvas.clientWidth || 800);
    const h = height ?? (canvas.clientHeight || 600);
    return ctx.viewport.setupCanvas(canvas, w, h, maxDpr);
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
    startsWithCountdown: startWithCountdown,
    startLoop,
    stopLoop,
    scoreRef,
    gameLoopRef: animFrameRef,
    setupCanvasContext,
    perfSettings,
    ctx
  };
}
