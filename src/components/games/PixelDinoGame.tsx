import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController, ObjectPool } from '../../sdk';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Zap, Sun, ArrowDown } from 'lucide-react';

interface DinoObstacle3D {
  mesh: THREE.Group;
  x: number;
  type: 'cactus' | 'ptero';
  y: number;
  active: boolean;
}

function buildVoxelDino3D(): {
  group: THREE.Group;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  headGroup: THREE.Group;
} {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x22c55e,
    metalness: 0.35,
    roughness: 0.32,
    clearcoat: 0.65
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0x86efac,
    roughness: 0.5
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.9
  });

  const legGeo = new THREE.BoxGeometry(0.24, 0.45, 0.24);
  const legL = new THREE.Mesh(legGeo, bodyMat);
  legL.position.set(0, 0.22, 0.18);
  legL.castShadow = true;
  const legR = legL.clone();
  legR.position.z = -0.18;
  group.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.52), bodyMat);
  torso.position.set(0, 0.68, 0);
  torso.castShadow = true;
  group.add(torso);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.52, 0.54), bellyMat);
  belly.position.set(0.18, 0.66, 0);
  group.add(belly);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.28, 0.32), bodyMat);
  tail.position.set(-0.58, 0.68, 0);
  tail.rotation.z = 0.22;
  group.add(tail);

  const headGroup = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.48), bodyMat);
  skull.position.set(0.32, 1.18, 0);
  skull.castShadow = true;
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.52), eyeMat);
  eye.position.set(0.38, 1.26, 0);
  headGroup.add(skull, eye);
  group.add(headGroup);

  return { group, legL, legR, headGroup };
}

function buildDinoHazard3D(type: 'cactus' | 'ptero'): THREE.Group {
  const g = new THREE.Group();
  if (type === 'cactus') {
    const cactusMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.45,
      metalness: 0.25
    });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.35, 8), cactusMat);
    trunk.position.y = 0.68;
    trunk.castShadow = true;
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.55, 8), cactusMat);
    armL.position.set(-0.28, 0.85, 0);
    armL.rotation.z = 0.6;
    const armR = armL.clone();
    armR.position.set(0.28, 0.72, 0);
    armR.rotation.z = -0.6;
    g.add(trunk, armL, armR);
  } else {
    const pteroMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      roughness: 0.3
    });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.95, 6), pteroMat);
    body.rotation.z = Math.PI / 2;
    const wings = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 1.45), pteroMat);
    g.add(body, wings);
  }
  return g;
}

export default function PixelDinoGame({
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
    gameId: 'pixel-dino',
    onGameOver,
    onScoreUpdate
  });

  const [speedMultiplier, setSpeedMultiplier] = useState('1.0x');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const dinoStateRef = useRef({
    y: 0,
    vy: 0,
    jumping: false,
    ducking: false,
    speed: 13,
    spawnTimer: 0,
    distAcc: 0
  });

  const lastMultRef = useRef('1.0x');
  const duckActiveRef = useRef(false);
  const touchDuckHoldRef = useRef(false);
  const swipeStartYRef = useRef<number | null>(null);
  const hazardsRef = useRef<DinoObstacle3D[]>([]);
  const releasePoolsRef = useRef<() => void>(() => {});

  const handleStart = useCallback(() => {
    releasePoolsRef.current();
    hazardsRef.current = [];
    duckActiveRef.current = false;
    touchDuckHoldRef.current = false;
    lastMultRef.current = '1.0x';
    dinoStateRef.current = {
      y: 0,
      vy: 0,
      jumping: false,
      ducking: false,
      speed: 13,
      spawnTimer: 0.7,
      distAcc: 0
    };
    setSpeedMultiplier('1.0x');
    startWithCountdown();
  }, [startWithCountdown]);

  const jump = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const d = dinoStateRef.current;
    if (!d.jumping) {
      d.jumping = true;
      d.vy = 12.2;
      audioController.playJump();
    }
  }, []);

  useEffect(() => {
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'UP' || action === 'ACTION_PRIMARY' || action === 'PRIMARY') {
          jump();
        }
        if (action === 'DOWN') {
          duckActiveRef.current = true;
        }
      },
      onActionUp: (action) => {
        if (action === 'DOWN') {
          duckActiveRef.current = false;
        }
      }
    });

    return () => {
      unsub();
    };
  }, [jump]);

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
    const container = mountRef.current;
    if (!container) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x0b0f19,
        fogColor: 0x0b0f19,
        fogDensity: 0.018,
        initialPreset: 'chase',
        gridPrimaryColor: '#eab308',
        gridSecondaryColor: '#0e1320',
        cameraPresets: {
          chase: { position: [-2.5, 3.6, 10.5], lookAt: [1.5, 1.1, 0], fov: 50 },
          isometric: { position: [-8.5, 6.2, 8.5], lookAt: [1.5, 0.9, 0], fov: 46 },
          diorama: { position: [0, 2.4, 13.5], lookAt: [0, 1.2, 0], fov: 44 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const dino = buildVoxelDino3D();
    dino.group.position.set(-4.2, 0, 0);
    stage.scene.add(dino.group);

    const createHazardPool = (type: 'cactus' | 'ptero', max: number) =>
      new ObjectPool<DinoObstacle3D>(
        () => {
          const mesh = buildDinoHazard3D(type);
          mesh.visible = false;
          stage.scene.add(mesh);
          return { mesh, x: 16, type, y: type === 'ptero' ? 1.42 : 0, active: false };
        },
        (item) => {
          item.active = false;
          item.mesh.visible = false;
          item.mesh.position.set(16, -99, 0);
        },
        max
      );

    const cactusPool = createHazardPool('cactus', 8);
    const pteroPool = createHazardPool('ptero', 5);

    releasePoolsRef.current = () => {
      cactusPool.releaseAll();
      pteroPool.releaseAll();
    };

    stage.startLoop((dt, elapsed) => {
      if (gameStateRef.current !== 'playing') return;

      const d = dinoStateRef.current;
      d.speed = Math.min(26, d.speed + dt * 0.35);
      d.distAcc += d.speed * dt;
      if (d.distAcc >= 2.2) {
        const pts = Math.floor(d.distAcc / 2.2);
        d.distAcc -= pts * 2.2;
        addScore(pts);
        const multStr = `${(d.speed / 13).toFixed(1)}x`;
        if (multStr !== lastMultRef.current) {
          lastMultRef.current = multStr;
          setSpeedMultiplier(multStr);
        }
      }

      d.ducking = duckActiveRef.current || touchDuckHoldRef.current;

      if (d.jumping) {
        d.y += d.vy * dt;
        d.vy -= (d.ducking ? 48 : 28) * dt;
        if (d.y <= 0) {
          d.y = 0;
          d.vy = 0;
          d.jumping = false;
        }
      }

      dino.group.position.set(-4.2, d.y, 0);
      dino.group.scale.y = d.ducking && !d.jumping ? 0.58 : 1.0;

      const stride = Math.sin(elapsed * d.speed * 1.4) * 0.5;
      dino.legL.rotation.z = d.jumping ? 0.3 : stride;
      dino.legR.rotation.z = d.jumping ? -0.3 : -stride;

      d.spawnTimer -= dt;
      if (d.spawnTimer <= 0) {
        d.spawnTimer = Math.max(0.45, 1.25 - (d.speed - 13) * 0.04) + Math.random() * 0.35;
        const type: 'cactus' | 'ptero' = d.speed > 15 && Math.random() < 0.32 ? 'ptero' : 'cactus';
        const hazard = type === 'cactus' ? cactusPool.acquire() : pteroPool.acquire();
        const hy = type === 'ptero' ? 1.42 : 0;
        hazard.x = 16;
        hazard.y = hy;
        hazard.active = true;
        hazard.mesh.position.set(16, hy, 0);
        hazard.mesh.visible = true;
        hazardsRef.current.push(hazard);
      }

      for (let i = hazardsRef.current.length - 1; i >= 0; i--) {
        const h = hazardsRef.current[i];
        h.x -= d.speed * dt;
        h.mesh.position.x = h.x;

        if (Math.abs(h.x - -4.2) < 0.72) {
          const hitCactus = h.type === 'cactus' && d.y < 1.05;
          const hitPtero = h.type === 'ptero' && !d.ducking && d.y < 1.6;
          if (hitCactus || hitPtero) {
            if (h.type === 'cactus') cactusPool.releaseItem(h);
            else pteroPool.releaseItem(h);
            hazardsRef.current.splice(i, 1);
            stage.particles.burst(-4.2, d.y + 0.8, 0, 34, 0xef4444, 10);
            stage.triggerTrauma(0.75);
            audioController.playExplosion();
            audioController.playGameOver();
            triggerGameOver(scoreRef.current);
            return;
          }
        }

        if (h.x < -14) {
          if (h.type === 'cactus') cactusPool.releaseItem(h);
          else pteroPool.releaseItem(h);
          hazardsRef.current.splice(i, 1);
        }
      }
    });

    return () => {
      releasePoolsRef.current();
      releasePoolsRef.current = () => {};
      hazardsRef.current = [];
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-amber-500/20 touch-none select-none">
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-pointer touch-none"
        onPointerDown={(e) => {
          swipeStartYRef.current = e.clientY;
          jump();
        }}
        onPointerMove={(e) => {
          if (swipeStartYRef.current !== null && e.clientY - swipeStartYRef.current > 24) {
            touchDuckHoldRef.current = true;
          }
        }}
        onPointerUp={() => {
          swipeStartYRef.current = null;
          touchDuckHoldRef.current = false;
        }}
        onPointerCancel={() => {
          swipeStartYRef.current = null;
          touchDuckHoldRef.current = false;
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-amber-400">
            <Sun className="w-3.5 h-3.5" /> KECEPATAN {speedMultiplier}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        {gameState === 'playing' && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              touchDuckHoldRef.current = true;
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              touchDuckHoldRef.current = false;
            }}
            onPointerLeave={() => {
              touchDuckHoldRef.current = false;
            }}
            onPointerCancel={() => {
              touchDuckHoldRef.current = false;
            }}
            className="pointer-events-auto sm:hidden min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-slate-950/90 px-3.5 text-xs font-semibold text-amber-300 active:bg-amber-500 active:text-slate-950 whitespace-nowrap"
          >
            <ArrowDown className="w-3.5 h-3.5" /> Tunduk
          </button>
        )}
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-amber-400" /> Space / W: Lompat · S / Panah Bawah: Menunduk
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
        title="Pixel Dino 3D"
        description="Bantu Voxel T-Rex 3D melompati kaktus gurun dan menunduk menghindari Pterodactyl!"
        themeColor="amber"
      />
    </div>
  );
}
