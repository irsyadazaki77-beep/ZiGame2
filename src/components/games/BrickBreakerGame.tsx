import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Flame, Sparkles, Zap } from 'lucide-react';

interface Brick3D {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  alive: boolean;
  color: number;
  points: number;
}

const ARENA_W = 7.2;
const PADDLE_Z = 5.8;

export default function BrickBreakerGame({
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

  const stateRef = useRef({
    paddleX: 0,
    paddleW: 2.5,
    ballX: 0,
    ballZ: 4.5,
    vx: 6.2,
    vz: -9.5,
    lives: 3,
    stage: 1
  });

  const keysRef = useRef<Record<string, boolean>>({});
  const bricksRef = useRef<Brick3D[]>([]);
  const rebuildBricksRef = useRef<() => void>(() => {});

  const handleStart = useCallback(() => {
    stateRef.current = {
      paddleX: 0,
      paddleW: 2.5,
      ballX: 0,
      ballZ: 4.5,
      vx: 6.2 * (Math.random() > 0.5 ? 1 : -1),
      vz: -9.5,
      lives: 3,
      stage: 1
    };
    setLives(3);
    setStageNum(1);
    rebuildBricksRef.current();
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
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = true;
        if (action === 'RIGHT') keysRef.current['arrowright'] = true;
      },
      onActionUp: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = false;
        if (action === 'RIGHT') keysRef.current['arrowright'] = false;
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

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x0d0614,
        fogColor: 0x0d0614,
        fogDensity: 0.016,
        initialPreset: 'chase',
        gridPrimaryColor: '#ec4899',
        gridSecondaryColor: '#14091e',
        cameraPresets: {
          chase: { position: [0, 8.8, 12.2], lookAt: [0, 0.3, -0.5], fov: 50 },
          isometric: { position: [9.5, 12.5, 9.5], lookAt: [0, 0.3, -0.5], fov: 46 },
          diorama: { position: [0, 16.8, 1.8], lookAt: [0, 0, -0.5], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // 3D Arena Side & Top Bumper Walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xdb2777,
      emissiveIntensity: 0.55,
      roughness: 0.25
    });
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 14), wallMat);
    wallL.position.set(-ARENA_W - 0.2, 0.275, -0.5);
    const wallR = wallL.clone();
    wallR.position.x = ARENA_W + 0.2;
    const wallTop = new THREE.Mesh(new THREE.BoxGeometry(ARENA_W * 2 + 0.6, 0.55, 0.25), wallMat);
    wallTop.position.set(0, 0.275, -7.4);
    stage.scene.add(wallL, wallR, wallTop);

    // Multi-part 3D Magnetic Paddle
    const paddleGroup = new THREE.Group();
    const paddleCore = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.42, 0.52),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.55,
        metalness: 0.7,
        roughness: 0.2,
        clearcoat: 0.9
      })
    );
    paddleCore.position.y = 0.21;
    paddleCore.castShadow = true;
    paddleGroup.add(paddleCore);
    paddleGroup.position.set(0, 0, PADDLE_Z);
    stage.scene.add(paddleGroup);

    // 3D Energy Ball
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xf43f5e,
        emissiveIntensity: 0.95,
        roughness: 0.1
      })
    );
    ballMesh.position.set(0, 0.32, 4.5);
    ballMesh.castShadow = true;
    stage.scene.add(ballMesh);

    const rowColors = [0xf43f5e, 0xf59e0b, 0xec4899, 0xa855f7, 0x06b6d4];
    const brickGeo = new THREE.BoxGeometry(1.55, 0.48, 0.65);

    rebuildBricksRef.current = () => {
      bricksRef.current.forEach((b) => stage.scene.remove(b.mesh));
      bricksRef.current = [];
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
          const bx = -5.95 + c * 1.7;
          const bz = -5.8 + r * 0.88;
          const color = rowColors[r % rowColors.length];
          const mat = new THREE.MeshPhysicalMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.35,
            roughness: 0.2,
            metalness: 0.35,
            clearcoat: 0.85
          });
          const mesh = new THREE.Mesh(brickGeo, mat);
          mesh.position.set(bx, 0.24, bz);
          mesh.castShadow = true;
          stage.scene.add(mesh);
          bricksRef.current.push({
            mesh,
            x: bx,
            z: bz,
            alive: true,
            color,
            points: (5 - r) * 10
          });
        }
      }
    };
    rebuildBricksRef.current();

    const onPointerMove = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      stateRef.current.paddleX = THREE.MathUtils.clamp(
        nx * (ARENA_W - 1.25),
        -(ARENA_W - 1.25),
        ARENA_W - 1.25
      );
    };
    container.addEventListener('pointermove', onPointerMove);

    stage.startLoop((dt) => {
      if (gameStateRef.current !== 'playing') return;

      const st = stateRef.current;
      const keys = keysRef.current;
      if (keys['arrowleft'] || keys['a']) st.paddleX -= 12.5 * dt;
      if (keys['arrowright'] || keys['d']) st.paddleX += 12.5 * dt;
      st.paddleX = THREE.MathUtils.clamp(st.paddleX, -(ARENA_W - 1.25), ARENA_W - 1.25);

      paddleGroup.position.x = st.paddleX;
      stage.setFollowTarget(st.paddleX, 0, 0, 0.25);

      st.ballX += st.vx * dt;
      st.ballZ += st.vz * dt;

      // Wall bounce
      if (st.ballX < -ARENA_W + 0.3) {
        st.ballX = -ARENA_W + 0.3;
        st.vx = Math.abs(st.vx);
        audio.playClick?.();
      } else if (st.ballX > ARENA_W - 0.3) {
        st.ballX = ARENA_W - 0.3;
        st.vx = -Math.abs(st.vx);
        audio.playClick?.();
      }
      if (st.ballZ < -7.0) {
        st.ballZ = -7.0;
        st.vz = Math.abs(st.vz);
        audio.playClick?.();
      }

      // Paddle bounce
      if (
        st.vz > 0 &&
        Math.abs(st.ballZ - PADDLE_Z) < 0.48 &&
        Math.abs(st.ballX - st.paddleX) < st.paddleW * 0.55 + 0.3
      ) {
        const hitOffset = (st.ballX - st.paddleX) / (st.paddleW * 0.5);
        st.vz = -Math.abs(st.vz);
        st.vx = hitOffset * 9.5;
        stage.particles.burst(st.ballX, 0.35, PADDLE_Z, 12, 0x38bdf8, 5);
        audio.playJump?.();
      }

      // Brick collision
      for (const b of bricksRef.current) {
        if (!b.alive) continue;
        if (Math.abs(st.ballX - b.x) < 0.95 && Math.abs(st.ballZ - b.z) < 0.52) {
          b.alive = false;
          b.mesh.visible = false;
          st.vz = -st.vz;
          addScore(b.points);
          stage.particles.burst(b.x, 0.4, b.z, 20, b.color, 7.5);
          stage.triggerTrauma(0.22);
          audio.playCoin?.();
          break;
        }
      }

      // Stage clear check
      if (bricksRef.current.every((b) => !b.alive)) {
        st.stage += 1;
        setStageNum(st.stage);
        addScore(150);
        st.ballX = st.paddleX;
        st.ballZ = 4.2;
        st.vz = -(9.5 + st.stage * 0.8);
        stage.kickFov(5);
        rebuildBricksRef.current();
      }

      // Ball lost bottom
      if (st.ballZ > PADDLE_Z + 1.5) {
        st.lives -= 1;
        setLives(st.lives);
        stage.particles.burst(st.ballX, 0.4, PADDLE_Z, 30, 0xef4444, 9);
        stage.triggerTrauma(0.65);
        audio.playExplosion?.();
        if (st.lives <= 0) {
          triggerGameOver(scoreRef.current);
          return;
        }
        st.ballX = st.paddleX;
        st.ballZ = 4.2;
        st.vx = 5.5 * (Math.random() > 0.5 ? 1 : -1);
        st.vz = -9.5;
      }

      ballMesh.position.set(st.ballX, 0.32, st.ballZ);
    });

    return () => {
      container.removeEventListener('pointermove', onPointerMove);
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

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
