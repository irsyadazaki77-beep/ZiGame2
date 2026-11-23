import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type * as THREE from 'three';
import { GameLifecycleState, PerformanceSettings } from '../types';
import { createGameRuntimeContext } from '../sdk/runtimeContext';
import { GameRuntimeContext } from '../types/gameSdk';
import {
  ThreeStageController,
  triggerMeshHitFlash,
  FloatingTextOptions3D
} from '../utils/threeStage';
import { gamepadController } from '../sdk/gamepadController';
import { audioController } from '../sdk/audioController';
import { gameFx } from '../utils/gameFx';
import { haptics } from '../utils/haptics';

export interface ScoreFxOptions {
  x?: number;
  y?: number;
  z?: number;
  text?: string;
  color?: string | number;
  scale?: number;
}

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
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [perfSettings, setPerfSettings] = useState<PerformanceSettings>(() => ctx.performance.getSettings());

  const gameStateRef = useRef<GameEngineState>(gameState);
  const scoreRef = useRef<number>(score);
  const comboRef = useRef<number>(0);
  const maxComboRef = useRef<number>(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const comboMultiplier = useMemo(() => {
    if (combo >= 20) return 5;
    if (combo >= 10) return 3;
    if (combo >= 5) return 2;
    if (combo >= 3) return 1.5;
    return 1;
  }, [combo]);

  const clearComboTimer = useCallback(() => {
    if (comboTimerRef.current !== null) {
      clearTimeout(comboTimerRef.current);
      comboTimerRef.current = null;
    }
  }, []);

  const breakCombo = useCallback(() => {
    clearComboTimer();
    comboRef.current = 0;
    setCombo(0);
  }, [clearComboTimer]);

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
      clearComboTimer();
      unsubLifecycle();
      unsubScore();
      unsubPerf();
      ctx.lifecycle.destroy();
    };
  }, [ctx, clearComboTimer]);

  // Loop control
  const stopLoop = useCallback(() => {
    ctx.loop.stop();
  }, [ctx]);

  const startLoop = useCallback((callback: (timestamp: number, deltaTime: number) => void) => {
    ctx.loop.start(callback);
  }, [ctx]);

  // Direct 3D Stage Juice Helpers
  const spawnFloatingText = useCallback(
    (
      text: string,
      x = 0,
      y = 1.25,
      z = 0,
      color: number | string = '#38bdf8',
      options?: FloatingTextOptions3D
    ) => {
      const stage = ThreeStageController.getActiveStage();
      if (!stage) return;
      stage.spawnFloatingText(text, x, y, z, color, options);
    },
    []
  );

  const triggerHitFlash = useCallback(
    (object3d: THREE.Object3D | null | undefined, durationSec = 0.09, flashColorHex = 0xffffff) => {
      triggerMeshHitFlash(object3d, durationSec, flashColorHex);
    },
    []
  );

  // Score handlers with automatic 3D Stage Juiciness (FOV kick, shockwave ring & milestone popup)
  const trigger3DScoreJuice = useCallback((prevScore: number, nextScore: number, fx?: ScoreFxOptions) => {
    const delta = nextScore - prevScore;
    if (delta <= 0) return;
    const stage = ThreeStageController.getActiveStage();
    if (!stage) return;

    stage.kickFov(Math.min(3.2, 0.7 + delta * 0.03));

    if (fx) {
      stage.spawnFloatingText(
        fx.text ?? `+${delta}`,
        fx.x ?? 0,
        fx.y ?? 1.25,
        fx.z ?? 0,
        fx.color ?? '#38bdf8',
        { scale: fx.scale ?? 1.0 }
      );
    }

    const crossedHundred = Math.floor(nextScore / 100) > Math.floor(prevScore / 100);
    if (delta >= 25 || crossedHundred) {
      stage.triggerShockwave(fx?.x ?? 0, 0.08, fx?.z ?? 0, undefined, crossedHundred ? 7.2 : 5.0, 0.55);
      stage.triggerTrauma(crossedHundred ? 0.22 : 0.12);
      gamepadController.triggerHapticPulse('light');
      haptics.trigger(crossedHundred ? 'success' : 'light');
      if (crossedHundred) {
        gameFx.triggerImpact('milestone');
        const milestoneVal = Math.floor(nextScore / 100) * 100;
        stage.spawnFloatingText(`${milestoneVal} PTS!`, fx?.x ?? 0, (fx?.y ?? 1.3) + 0.55, fx?.z ?? 0, '#facc15', {
          scale: 1.25
        });
      } else if (delta >= 50) {
        gameFx.triggerImpact('combo');
      }
    }
  }, []);

  const updateScore = useCallback((newScore: number, fx?: ScoreFxOptions) => {
    const prev = scoreRef.current;
    ctx.score.set(newScore);
    trigger3DScoreJuice(prev, newScore, fx);
  }, [ctx, trigger3DScoreJuice]);

  const addScore = useCallback((points: number, fx?: ScoreFxOptions) => {
    const prev = scoreRef.current;
    ctx.score.add(points);
    trigger3DScoreJuice(prev, prev + points, fx);
  }, [ctx, trigger3DScoreJuice]);

  const incrementCombo = useCallback((basePoints: number, fx?: ScoreFxOptions) => {
    const nextCombo = comboRef.current + 1;
    comboRef.current = nextCombo;
    setCombo(nextCombo);

    if (nextCombo > maxComboRef.current) {
      maxComboRef.current = nextCombo;
      setMaxCombo(nextCombo);
    }

    const mult = nextCombo >= 20 ? 5 : nextCombo >= 10 ? 3 : nextCombo >= 5 ? 2 : nextCombo >= 3 ? 1.5 : 1;
    const finalPoints = Math.max(1, Math.floor(basePoints * mult));
    const prev = scoreRef.current;
    ctx.score.add(finalPoints);

    audioController.playCombo(nextCombo);
    haptics.trigger(nextCombo >= 5 ? 'medium' : 'light');

    const label =
      fx?.text ??
      (nextCombo >= 3 ? `+${finalPoints} x${mult} COMBO!` : nextCombo === 2 ? `+${finalPoints} COMBO!` : `+${finalPoints}`);
    const color = fx?.color ?? (nextCombo >= 10 ? '#f472b6' : nextCombo >= 3 ? '#facc15' : '#38bdf8');
    const scale = fx?.scale ?? (nextCombo >= 5 ? 1.25 : nextCombo >= 2 ? 1.1 : 0.95);

    trigger3DScoreJuice(prev, prev + finalPoints, {
      ...fx,
      text: label,
      color,
      scale
    });

    if (nextCombo >= 3) {
      gameFx.triggerImpact('combo');
    }

    clearComboTimer();
    comboTimerRef.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
      comboTimerRef.current = null;
    }, 2800);

    return { combo: nextCombo, multiplier: mult, pointsAdded: finalPoints };
  }, [ctx, trigger3DScoreJuice, clearComboTimer]);

  const setScore = useCallback((newScore: number, fx?: ScoreFxOptions) => {
    const prev = scoreRef.current;
    ctx.score.set(newScore);
    trigger3DScoreJuice(prev, newScore, fx);
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
    clearComboTimer();
    const stage = ThreeStageController.getActiveStage();
    if (stage) {
      stage.triggerSlowMo(0.28, 0.42);
      stage.triggerTrauma(0.48);
      stage.triggerShockwave(0, 0.1, 0, 0xf43f5e, 7.5, 0.65);
    }
    gameFx.triggerImpact('damage');
    gamepadController.triggerHapticPulse('heavy');
    haptics.trigger('error');
    ctx.lifecycle.triggerGameOver(finalScore);
  }, [ctx, clearComboTimer]);

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
    clearComboTimer();
    comboRef.current = 0;
    maxComboRef.current = 0;
    setCombo(0);
    setMaxCombo(0);
    setScore(0);
    scoreRef.current = 0;
    ctx.lifecycle.triggerRestart();
  }, [ctx, setScore, clearComboTimer]);

  const setGameState = useCallback((state: GameEngineState) => {
    ctx.lifecycle.setState(state as any);
  }, [ctx]);

  const startWithCountdown = useCallback((onCountdownEnd?: () => void) => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    clearComboTimer();
    comboRef.current = 0;
    maxComboRef.current = 0;
    setCombo(0);
    setMaxCombo(0);
    setScore(0);
    scoreRef.current = 0;
    setCountdown(3);
    ctx.lifecycle.startWithCountdown(onCountdownEnd, (count) => {
      setCountdown(count);
    });
  }, [ctx, setScore, clearComboTimer]);

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
    combo,
    maxCombo,
    comboMultiplier,
    comboRef,
    maxComboRef,
    incrementCombo,
    breakCombo,
    spawnFloatingText,
    triggerHitFlash,
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
