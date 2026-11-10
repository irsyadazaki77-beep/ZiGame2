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
  QualityLevel3D,
  buildCyberActionHero3D
} from '../../utils/threeStage';
import { Zap, ShieldAlert, Flame } from 'lucide-react';

interface LaserHazard3D {
  isRow: boolean; // true = along X (row z), false = along Z (col x)
  index: number; // -1, 0, 1
  phase: 'warn' | 'fire';
  timer: number;
  mesh: THREE.Mesh;
}

const TILE_STEP = 2.4;

export default function LaserGridGame({
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
    gameId: 'laser-grid',
    onGameOver,
    onScoreUpdate
  });

  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const gridStateRef = useRef({
    gx: 0, // -1, 0, 1
    gz: 0, // -1, 0, 1
    x: 0,
    z: 0,
    lives: 3,
    wave: 1,
    survived: 0,
    spawnTimer: 0.8,
    orbX: 1,
    orbZ: -1,
    invuln: 0
  });

  const lasersRef = useRef<LaserHazard3D[]>([]);

  const moveGrid = useCallback((dx: number, dz: number) => {
    if (gameStateRef.current !== 'playing') return;
    const st = gridStateRef.current;
    st.gx = Math.max(-1, Math.min(1, st.gx + dx));
    st.gz = Math.max(-1, Math.min(1, st.gz + dz));
    audio.playClick?.();
  }, []);

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      lasersRef.current.forEach((l) => stage.scene.remove(l.mesh));
    }
    lasersRef.current = [];
    gridStateRef.current = {
      gx: 0,
      gz: 0,
      x: 0,
      z: 0,
      lives: 3,
      wave: 1,
      survived: 0,
      spawnTimer: 0.7,
      orbX: 1,
      orbZ: -1,
      invuln: 0
    };
    setLives(3);
    setWave(1);
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') moveGrid(-1, 0);
      else if (k === 'arrowright' || k === 'd') moveGrid(1, 0);
      else if (k === 'arrowup' || k === 'w') moveGrid(0, -1);
      else if (k === 'arrowdown' || k === 's') moveGrid(0, 1);
    };
    window.addEventListener('keydown', onKeyDown);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') moveGrid(-1, 0);
        if (action === 'RIGHT') moveGrid(1, 0);
        if (action === 'UP') moveGrid(0, -1);
        if (action === 'DOWN') moveGrid(0, 1);
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsub();
    };
  }, [moveGrid]);

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
        backgroundColor: 0x0b0509,
        fogColor: 0x0b0509,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#ef4444',
        gridSecondaryColor: '#16080e',
        cameraPresets: {
          isometric: { position: [8.2, 11.2, 8.2], lookAt: [0, 0.4, 0], fov: 45 },
          chase: { position: [0, 7.5, 10.8], lookAt: [0, 0.4, 0], fov: 50 },
          diorama: { position: [0, 14.5, 1.5], lookAt: [0, 0, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 3x3 Elevated Glass-Steel Platform Pads
    const padGeo = new THREE.BoxGeometry(2.1, 0.35, 2.1);
    for (let rx = -1; rx <= 1; rx++) {
      for (let rz = -1; rz <= 1; rz++) {
        const padMat = new THREE.MeshPhysicalMaterial({
          color: 0x1e293b,
          metalness: 0.75,
          roughness: 0.25,
          clearcoat: 0.85
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(rx * TILE_STEP, 0.175, rz * TILE_STEP);
        pad.receiveShadow = true;
        stage.scene.add(pad);
      }
    }

    const hero = buildCyberActionHero3D(0x38bdf8, 0xef4444);
    hero.group.position.set(0, 0.35, 0);
    stage.scene.add(hero.group);

    const orbMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.9
      })
    );
    orbMesh.position.set(TILE_STEP, 0.9, -TILE_STEP);
    stage.scene.add(orbMesh);

    stage.startLoop((dt, elapsed) => {
      orbMesh.rotation.y = elapsed * 3.5;
      if (gameStateRef.current !== 'playing') return;

      const st = gridStateRef.current;
      if (st.invuln > 0) st.invuln -= dt;

      st.x = THREE.MathUtils.damp(st.x, st.gx * TILE_STEP, 14, dt);
      st.z = THREE.MathUtils.damp(st.z, st.gz * TILE_STEP, 14, dt);
      hero.group.position.set(st.x, 0.35, st.z);
      orbMesh.position.set(st.orbX * TILE_STEP, 0.9 + Math.sin(elapsed * 5) * 0.1, st.orbZ * TILE_STEP);

      // Collect data orb on grid
      if (st.gx === st.orbX && st.gz === st.orbZ) {
        addScore(35);
        audio.playCoin?.();
        stage.particles.burst(st.x, 0.9, st.z, 20, 0xfacc15, 6.5);
        let nx = st.orbX;
        let nz = st.orbZ;
        while (nx === st.gx && nz === st.gz) {
          nx = Math.floor(Math.random() * 3) - 1;
          nz = Math.floor(Math.random() * 3) - 1;
        }
        st.orbX = nx;
        st.orbZ = nz;
      }

      // Spawn Laser Warnings
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = Math.max(0.45, 1.15 - st.wave * 0.06);
        const isRow = Math.random() > 0.5;
        const idx = Math.floor(Math.random() * 3) - 1;
        const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 9.5, 10);
        if (isRow) beamGeo.rotateZ(Math.PI / 2);
        else beamGeo.rotateX(Math.PI / 2);

        const beamMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.65,
          transparent: true,
          opacity: 0.55
        });
        const mesh = new THREE.Mesh(beamGeo, beamMat);
        mesh.position.set(isRow ? 0 : idx * TILE_STEP, 0.95, isRow ? idx * TILE_STEP : 0);
        stage.scene.add(mesh);

        lasersRef.current.push({
          isRow,
          index: idx,
          phase: 'warn',
          timer: Math.max(0.45, 0.85 - st.wave * 0.04),
          mesh
        });
      }

      // Update Lasers
      for (let i = lasersRef.current.length - 1; i >= 0; i--) {
        const l = lasersRef.current[i];
        l.timer -= dt;
        if (l.phase === 'warn' && l.timer <= 0) {
          l.phase = 'fire';
          l.timer = 0.32;
          const mat = l.mesh.material as THREE.MeshStandardMaterial;
          mat.color.setHex(0xef4444);
          mat.emissive.setHex(0xef4444);
          mat.emissiveIntensity = 1.2;
          mat.opacity = 1.0;
          l.mesh.scale.set(2.2, 2.2, 1);
          audio.playLaser?.();

          // Check hit on player tile
          const hit = l.isRow ? st.gz === l.index : st.gx === l.index;
          if (hit && st.invuln <= 0) {
            st.lives -= 1;
            setLives(st.lives);
            st.invuln = 1.2;
            stage.particles.burst(st.x, 0.9, st.z, 32, 0xef4444, 9);
            stage.triggerTrauma(0.7);
            audio.playExplosion?.();
            if (st.lives <= 0) {
              triggerGameOver(scoreRef.current);
              return;
            }
          }
        } else if (l.phase === 'fire' && l.timer <= 0) {
          stage.scene.remove(l.mesh);
          lasersRef.current.splice(i, 1);
          st.survived += 1;
          addScore(10);
          if (st.survived % 8 === 0) {
            st.wave += 1;
            setWave(st.wave);
            stage.kickFov(3.5);
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
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-rose-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-rose-400">
            <ShieldAlert className="w-3.5 h-3.5" /> WAVE {wave}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
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
            <Zap className="w-3 h-3 text-rose-400" /> WASD / Panah: Lompat Antar Petak 3x3 & Hindari Sinar Laser
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
        title="Laser Grid 3D"
        description="Melompat di atas platform 3x3 3D, kumpulkan kristal emas, dan hindari tembakan meriam laser merah!"
        themeColor="rose"
      />
    </div>
  );
}
