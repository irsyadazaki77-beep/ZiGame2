import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController, ObjectPool } from '../../sdk';
import { inputManager } from '../../services/inputService';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Sword, Flame, AlertTriangle } from 'lucide-react';

interface SlashTarget3D {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rotSpeed: THREE.Vector3;
  isBomb: boolean;
  sliced: boolean;
  color: number;
  points: number;
}

function buildSlashTargetMesh(isBomb: boolean, color: number): THREE.Group {
  const g = new THREE.Group();
  if (isBomb) {
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.25
    });
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.9
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 14), coreMat);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 20), spikeMat);
    const ring2 = ring1.clone();
    ring2.rotation.x = Math.PI / 2;
    g.add(core, ring1, ring2);
  } else {
    const gemMat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      metalness: 0.2,
      roughness: 0.15,
      clearcoat: 0.9
    });
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 0), gemMat);
    const shell = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), shellMat);
    g.add(core, shell);
  }
  return g;
}

export default function CyberSlasherGame({
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
    gameId: 'cyber-slasher',
    onGameOver,
    onScoreUpdate
  });

  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const stateRef = useRef({
    lives: 3,
    combo: 0,
    comboTimer: 0,
    spawnTimer: 0.4,
    pointerWorldX: 0,
    pointerWorldY: 2.5,
    isSlashing: false
  });

  const resetTargetsFnRef = useRef<(() => void) | null>(null);

  const handleStart = useCallback(() => {
    resetTargetsFnRef.current?.();
    stateRef.current = {
      lives: 3,
      combo: 0,
      comboTimer: 0,
      spawnTimer: 0.4,
      pointerWorldX: 0,
      pointerWorldY: 2.5,
      isSlashing: false
    };
    setLives(3);
    setCombo(0);
    startWithCountdown(() => {
      audioController.playClick();
    });
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
    const container = mountRef.current;
    if (!container) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x050c12,
        fogColor: 0x050c12,
        fogDensity: 0.016,
        initialPreset: 'chase',
        gridPrimaryColor: '#10b981',
        gridSecondaryColor: '#07141e',
        cameraPresets: {
          chase: { position: [0, 3.2, 11.5], lookAt: [0, 2.8, 0], fov: 50 },
          isometric: { position: [5.5, 5.5, 11.5], lookAt: [0, 2.6, 0], fov: 48 },
          diorama: { position: [0, 4.5, 13.5], lookAt: [0, 2.5, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build Katana Plasma Cursor Orb
    const bladeTip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x34d399,
        emissiveIntensity: 1.0
      })
    );
    bladeTip.position.set(0, 2.5, 0.5);
    stage.scene.add(bladeTip);

    const orbColors = [0x10b981, 0x06b6d4, 0xf59e0b, 0xec4899, 0xa855f7];

    const createTargetPool = (isBomb: boolean, color: number, initialSize: number) =>
      new ObjectPool<SlashTarget3D>(
        () => {
          const mesh = buildSlashTargetMesh(isBomb, color);
          mesh.visible = false;
          stage.scene.add(mesh);
          return {
            mesh,
            x: 0,
            y: -5,
            z: 0,
            vx: 0,
            vy: 0,
            rotSpeed: new THREE.Vector3(),
            isBomb,
            sliced: false,
            color,
            points: 15
          };
        },
        (item) => {
          item.sliced = false;
          item.mesh.visible = false;
        },
        initialSize
      );

    const bombPool = createTargetPool(true, 0xef4444, 4);
    const gemPools = orbColors.map((col) => createTargetPool(false, col, 3));
    const allPools = [bombPool, ...gemPools];

    resetTargetsFnRef.current = () => {
      allPools.forEach((p) => p.releaseAll());
    };

    const slashAt = (wx: number, wy: number) => {
      if (gameStateRef.current !== 'playing') return;
      const st = stateRef.current;
      st.pointerWorldX = wx;
      st.pointerWorldY = wy;
      bladeTip.position.set(wx, wy, 0.5);

      for (const pool of allPools) {
        const items = pool.getActiveItems();
        for (let i = items.length - 1; i >= 0; i--) {
          const t = items[i];
          if (t.sliced) continue;
          if (Math.hypot(t.x - wx, t.y - wy) < 1.15) {
            t.sliced = true;
            pool.release(i);

            if (t.isBomb) {
              stage.particles.burst(t.x, t.y, 0, 42, 0xef4444, 11);
              stage.triggerTrauma(0.85);
              audioController.playExplosion();
              audioController.playGameOver();
              triggerGameOver(scoreRef.current);
              return;
            } else {
              st.combo += 1;
              st.comboTimer = 1.6;
              setCombo(st.combo);
              const mult = Math.min(4, 1 + Math.floor(st.combo / 4));
              addScore(t.points * mult);
              stage.particles.burst(t.x, t.y, 0, 22, t.color, 8.5);
              stage.triggerTrauma(0.2);
              if (st.combo % 5 === 0) {
                stage.triggerSlowMo(0.45, 0.22);
                stage.kickFov(3.5);
                audioController.playCombo(st.combo);
              } else {
                audioController.playScore();
              }
            }
          }
        }
      }
    };

    const slashNearestGem = () => {
      let best: SlashTarget3D | null = null;
      for (const pool of gemPools) {
        for (const t of pool.getActiveItems()) {
          if (!t.sliced && t.y > 0.5 && (!best || t.y > best.y)) {
            best = t;
          }
        }
      }
      if (best) {
        slashAt(best.x, best.y);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      const wx = nx * 6.2;
      const wy = 2.8 + ny * 3.4;
      slashAt(wx, wy);
    };

    const unsubInput = inputManager.subscribe({
      onActionDown: (action) => {
        if (gameStateRef.current !== 'playing') return;
        if (
          action === 'PRIMARY' ||
          action === 'ACTION_PRIMARY' ||
          action === 'UP' ||
          action === 'DOWN' ||
          action === 'LEFT' ||
          action === 'RIGHT'
        ) {
          slashNearestGem();
        }
      }
    });

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerdown', onPointerMove);

    stage.startLoop((dt) => {
      bladeTip.rotation.y += dt * 8;
      bladeTip.rotation.x += dt * 5;

      if (gameStateRef.current !== 'playing') return;

      const st = stateRef.current;
      if (st.comboTimer > 0) {
        st.comboTimer -= dt;
        if (st.comboTimer <= 0 && st.combo !== 0) {
          st.combo = 0;
          setCombo(0);
        }
      }

      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = 0.65 + Math.random() * 0.45;
        const batch = 1 + Math.floor(Math.random() * 2);
        for (let b = 0; b < batch; b++) {
          const isBomb = Math.random() < 0.18;
          const colorIdx = Math.floor(Math.random() * orbColors.length);
          const pool = isBomb ? bombPool : gemPools[colorIdx];
          const t = pool.acquire();
          const startX = (Math.random() - 0.5) * 8.5;
          t.x = startX;
          t.y = -0.5;
          t.z = 0;
          t.vx = -startX * (0.35 + Math.random() * 0.35);
          t.vy = 9.8 + Math.random() * 2.6;
          t.rotSpeed.set(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
          );
          t.sliced = false;
          t.mesh.position.set(startX, -0.5, 0);
          t.mesh.visible = true;
        }
      }

      for (const pool of allPools) {
        const items = pool.getActiveItems();
        for (let i = items.length - 1; i >= 0; i--) {
          const t = items[i];
          t.x += t.vx * dt;
          t.y += t.vy * dt;
          t.vy -= 12.5 * dt;
          t.mesh.position.set(t.x, t.y, t.z);
          t.mesh.rotation.x += t.rotSpeed.x * dt;
          t.mesh.rotation.y += t.rotSpeed.y * dt;

          if (t.y < -1.5) {
            const missedGem = !t.isBomb && !t.sliced;
            pool.release(i);
            if (missedGem) {
              st.lives -= 1;
              setLives(st.lives);
              audioController.playHit();
              stage.triggerTrauma(0.35);
              if (st.lives <= 0) {
                audioController.playGameOver();
                triggerGameOver(scoreRef.current);
                return;
              }
            }
          }
        }
      }
    });

    return () => {
      unsubInput();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerMove);
      allPools.forEach((p) => p.releaseAll());
      resetTargetsFnRef.current = null;
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-emerald-500/20 touch-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-crosshair touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            <Sword className="w-3.5 h-3.5" /> SKOR: {score}
          </span>
          {combo > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-semibold">{combo}x SLASH COMBO</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-rose-400 font-semibold tabular-nums">
          <Flame className="w-3.5 h-3.5" /> NYAWA: {lives}
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <AlertTriangle className="w-3 h-3 text-emerald-400" /> Geser Kursor / Tap untuk Menebas Kristal 3D (Hindari Ranjau Merah)
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
        title="Cyber Slasher 3D"
        description="Tebas kristal data 3D yang melayang di udara dengan katana plasma dan hindari ranjau EMP merah!"
        themeColor="emerald"
      />
    </div>
  );
}
