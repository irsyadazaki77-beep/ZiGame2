import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Coins, Sparkles, Zap } from 'lucide-react';

interface PlinkoBall3D {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
}

const MULTIPLIERS = [2, 5, 10, 5, 2];

export default function PlinkoNeoGame({
  onGameOver,
  onScoreUpdate,
  highScore
}: GameComponentProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<ThreeStageController | null>(null);

  const {
    gameState,
    score,
    addScore,
    startWithCountdown,
    countdown,
    triggerGameOver,
    scoreRef
  } = useGameEngine({
    gameId: 'plinko-neo',
    onGameOver,
    onScoreUpdate
  });

  const [ballsLeft, setBallsLeft] = useState(12);
  const [lastMulti, setLastMulti] = useState<number | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const plinkoRef = useRef({
    ballsRemaining: 12,
    dropperX: 0
  });

  const activeBallsRef = useRef<PlinkoBall3D[]>([]);
  const spawnBallFnRef = useRef<(xOffset?: number) => void>(() => {});

  const dropBall = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (plinkoRef.current.ballsRemaining <= 0) return;
    plinkoRef.current.ballsRemaining -= 1;
    setBallsLeft(plinkoRef.current.ballsRemaining);
    spawnBallFnRef.current();
    audio.playClick?.();
  }, []);

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      activeBallsRef.current.forEach((b) => stage.scene.remove(b.mesh));
    }
    activeBallsRef.current = [];
    plinkoRef.current = {
      ballsRemaining: 12,
      dropperX: 0
    };
    setBallsLeft(12);
    setLastMulti(null);
    startWithCountdown();
  }, [startWithCountdown]);

  const handleSelectPreset = useCallback((preset: CameraPreset3D) => {
    setCameraPreset(preset);
    stageRef.current?.setCameraPreset(preset);
  }, []);

  const handleCycleQuality = useCallback(() => {
    setQuality((prev) => {
      const next: QualityLevel3D =
        prev === 'ultra' ? 'balanced' : prev === 'balanced' ? 'performance' : 'ultra';
      stageRef.current?.setQualityLevel(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') dropBall();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dropBall]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x0b0814,
        fogColor: 0x0b0814,
        fogDensity: 0.015,
        initialPreset: 'chase',
        gridPrimaryColor: '#f59e0b',
        gridSecondaryColor: '#140e22',
        cameraPresets: {
          chase: { position: [0, 9.8, 10.5], lookAt: [0, 0.2, 0.5], fov: 48 },
          isometric: { position: [8.5, 11.5, 8.5], lookAt: [0, 0.2, 0], fov: 45 },
          diorama: { position: [0, 15.2, 1.5], lookAt: [0, 0, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 3D PlinkoPeg Matrix on Table
    const pegGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.55, 12);
    const pegMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      metalness: 0.88,
      roughness: 0.18,
      clearcoat: 0.9
    });
    const pegs: { x: number; z: number }[] = [];

    for (let row = 0; row < 6; row++) {
      const cols = row % 2 === 0 ? 5 : 6;
      const z = -4.2 + row * 1.45;
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * 1.45;
        const peg = new THREE.Mesh(pegGeo, pegMat);
        peg.position.set(x, 0.275, z);
        peg.castShadow = true;
        stage.scene.add(peg);
        pegs.push({ x, z });
      }
    }

    // Build 5 Multiplier Pockets at z = 5.2
    const pocketColors = [0x38bdf8, 0xa855f7, 0xf59e0b, 0xa855f7, 0x38bdf8];
    for (let i = 0; i < 5; i++) {
      const px = (i - 2) * 1.65;
      const pocket = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.35, 0.85),
        new THREE.MeshStandardMaterial({
          color: pocketColors[i],
          emissive: pocketColors[i],
          emissiveIntensity: 0.55
        })
      );
      pocket.position.set(px, 0.175, 5.2);
      stage.scene.add(pocket);
    }

    const ballGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const ballMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.55,
      metalness: 0.75,
      roughness: 0.15,
      clearcoat: 1.0
    });

    spawnBallFnRef.current = () => {
      const mesh = new THREE.Mesh(ballGeo, ballMat);
      const startX = (Math.random() - 0.5) * 2.2;
      mesh.position.set(startX, 0.32, -5.8);
      mesh.castShadow = true;
      stage.scene.add(mesh);
      activeBallsRef.current.push({
        mesh,
        x: startX,
        z: -5.8,
        vx: (Math.random() - 0.5) * 1.8,
        vz: 1.5
      });
    };

    stage.startLoop((dt) => {
      if (gameStateRef.current !== 'playing') return;

      for (let i = activeBallsRef.current.length - 1; i >= 0; i--) {
        const b = activeBallsRef.current[i];
        b.vz += 9.8 * dt;
        b.x += b.vx * dt;
        b.z += b.vz * dt;

        // Side rail bounce
        if (b.x < -4.2) {
          b.x = -4.2;
          b.vx = Math.abs(b.vx) * 0.75;
        } else if (b.x > 4.2) {
          b.x = 4.2;
          b.vx = -Math.abs(b.vx) * 0.75;
        }

        // Peg collisions
        for (const p of pegs) {
          const dx = b.x - p.x;
          const dz = b.z - p.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.52 && dist > 0.001) {
            const nx = dx / dist;
            const nz = dz / dist;
            b.x = p.x + nx * 0.53;
            b.z = p.z + nz * 0.53;
            const jitter = (Math.random() - 0.5) * 2.5;
            b.vx = nx * 4.2 + jitter;
            b.vz = Math.max(1.2, Math.abs(b.vz) * 0.55);
            stage.particles.burst(p.x, 0.45, p.z, 6, 0xfacc15, 4);
            audio.playClick?.();
          }
        }

        b.mesh.position.set(b.x, 0.32, b.z);

        // Reached multiplier pockets
        if (b.z >= 5.0) {
          stage.scene.remove(b.mesh);
          activeBallsRef.current.splice(i, 1);

          const slotIdx = Math.max(0, Math.min(4, Math.round(b.x / 1.65 + 2)));
          const mult = MULTIPLIERS[slotIdx];
          setLastMulti(mult);
          const pts = 25 * mult;
          addScore(pts);
          stage.particles.burst(b.x, 0.5, 5.2, 24, pocketColors[slotIdx], 7.5);
          stage.triggerTrauma(mult >= 10 ? 0.45 : 0.2);
          if (mult >= 10) stage.kickFov(4);
          audio.playCoin?.();

          if (plinkoRef.current.ballsRemaining === 0 && activeBallsRef.current.length === 0) {
            triggerGameOver(scoreRef.current);
            return;
          }
        }
      }
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div
      className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-amber-500/20"
      onClick={dropBall}
    >
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-amber-400">
            <Coins className="w-3.5 h-3.5" /> BOLA TERSISA: {ballsLeft}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        {lastMulti !== null && (
          <div className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-slate-950/85 px-3.5 py-2 text-xs font-semibold text-amber-400">
            <Sparkles className="w-3.5 h-3.5" /> JACKPOT {lastMulti}X!
          </div>
        )}
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-amber-400" /> Klik Layar / Tekan Space untuk Menjatuhkan Bola Emas 3D
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
        title="Plinko Neo 3D"
        description="Jatuhkan bola emas 3D melewati matriks pasak logam menuju kantong pengali skor 10x!"
        themeColor="amber"
      />
    </div>
  );
}
