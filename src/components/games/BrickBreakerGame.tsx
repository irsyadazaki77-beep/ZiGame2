import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import { GameErrorBoundary } from '../gameplay/GameErrorBoundary';
import { BrickBreakerEngine } from './brick-breaker/BrickBreakerEngine';
import { CameraPreset3D, QualityLevel3D } from '../../utils/threeStage';
import { Flame, Sparkles, Zap } from 'lucide-react';

function BrickBreakerView({
  onGameOver,
  onScoreUpdate,
  highScore
}: GameComponentProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BrickBreakerEngine | null>(null);

  const {
    gameState,
    score,
    addScore,
    startWithCountdown,
    countdown,
    triggerGameOver,
    scoreRef,
    ctx
  } = useGameEngine({
    gameId: 'brick-breaker',
    onGameOver,
    onScoreUpdate
  });

  const [lives, setLives] = useState(3);
  const [stageNum, setStageNum] = useState(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const handleStart = useCallback(() => {
    engineRef.current?.resetGame();
    startWithCountdown();
  }, [startWithCountdown]);

  const handleSelectPreset = useCallback((preset: CameraPreset3D) => {
    setCameraPreset(preset);
    engineRef.current?.setCameraPreset(preset);
  }, []);

  const handleCycleQuality = useCallback(() => {
    setQuality((prev) => {
      const next: QualityLevel3D =
        prev === 'ultra' ? 'balanced' : prev === 'balanced' ? 'performance' : 'ultra';
      engineRef.current?.setQualityLevel(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      engineRef.current?.setKey(e.key, true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      engineRef.current?.setKey(e.key, false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') engineRef.current?.setKey('arrowleft', true);
        if (action === 'RIGHT') engineRef.current?.setKey('arrowright', true);
      },
      onActionUp: (action) => {
        if (action === 'LEFT') engineRef.current?.setKey('arrowleft', false);
        if (action === 'RIGHT') engineRef.current?.setKey('arrowright', false);
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      unsub();
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new BrickBreakerEngine({
      isPlaying: () => gameStateRef.current === 'playing',
      onScoreUpdate: (newScore) => {
        onScoreUpdate?.(newScore);
      },
      onScoreAdd: (pts) => addScore(pts),
      onLivesUpdate: (nextLives) => setLives(nextLives),
      onLivesChange: (nextLives) => setLives(nextLives),
      onStageChange: (nextStage) => setStageNum(nextStage),
      onGameOver: (_won) => triggerGameOver(scoreRef.current),
      onTrajectoryPoint: (x, z, action) => {
        ctx.replay.recordPoint(x, z, action, scoreRef.current);
      }
    });

    engineRef.current = engine;
    const initialQuality = engine.mount(container);
    setQuality(initialQuality);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [addScore, ctx.replay, onScoreUpdate, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-pink-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-pink-400">
            <Sparkles className="w-3.5 h-3.5" /> STAGE {stageNum}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-rose-400 font-semibold tabular-nums">
          <Flame className="w-3.5 h-3.5" /> BOLA: {lives}
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-pink-400" /> Geser Mouse / Panah Kiri-Kanan untuk Memantulkan Bola 3D
          </span>
        }
      />

      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        countdown={countdown}
        onStart={handleStart}
        onRestart={handleStart}
        title="Brick Neon 3D"
        description="Hancurkan formasi balok kristal 3D dengan pantulan bola plasma berkecepatan tinggi!"
        themeColor="pink"
      />
    </div>
  );
}

export default function BrickBreakerGame(props: GameComponentProps) {
  return (
    <GameErrorBoundary gameTitle="Brick Neon 3D">
      <BrickBreakerView {...props} />
    </GameErrorBoundary>
  );
}
