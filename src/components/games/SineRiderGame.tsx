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
  buildStarfighter3D
} from '../../utils/threeStage';
import { Waves, Zap } from 'lucide-react';

interface SineGate3D {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  isHazard: boolean;
  passed: boolean;
}

export default function SineRiderGame({
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
    gameId: 'sine-rider',
    onGameOver,
    onScoreUpdate
  });

  const [freqLabel, setFreqLabel] = useState('1.0 Hz');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const riderRef = useRef({
    phase: 0,
    freq: 2.8,
    amp: 2.3,
    y: 3.0,
    boosting: false,
    speed: 9.5,
    spawnTimer: 0.4
  });

  const gatesRef = useRef<SineGate3D[]>([]);

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      gatesRef.current.forEach((g) => stage.scene.remove(g.mesh));
    }
    gatesRef.current = [];
    riderRef.current = {
      phase: 0,
      freq: 2.8,
      amp: 2.3,
      y: 3.0,
      boosting: false,
      speed: 9.5,
      spawnTimer: 0.4
    };
    setFreqLabel('1.0 Hz');
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        riderRef.current.boosting = true;
        setFreqLabel('2.2 Hz');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        riderRef.current.boosting = false;
        setFreqLabel('1.0 Hz');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'ACTION_PRIMARY' || action === 'UP') {
          riderRef.current.boosting = true;
          setFreqLabel('2.2 Hz');
        }
      },
      onActionUp: (action) => {
        if (action === 'ACTION_PRIMARY' || action === 'UP') {
          riderRef.current.boosting = false;
          setFreqLabel('1.0 Hz');
        }
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      unsub();
    };
  }, []);

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
        backgroundColor: 0x040b14,
        fogColor: 0x040b14,
        fogDensity: 0.018,
        initialPreset: 'chase',
        gridPrimaryColor: '#06b6d4',
        gridSecondaryColor: '#071322',
        cameraPresets: {
          chase: { position: [-1.5, 3.8, 11.2], lookAt: [1.5, 3.0, 0], fov: 50 },
          isometric: { position: [-6.5, 6.2, 9.8], lookAt: [1.5, 3.0, 0], fov: 46 },
          diorama: { position: [0, 3.5, 13.5], lookAt: [0, 3.0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const glider = buildStarfighter3D(0x06b6d4, 0x22d3ee, stage.isSoftwareGl);
    glider.group.rotation.y = Math.PI / 2; // Face +X
    glider.group.position.set(-3.2, 3.0, 0);
    stage.scene.add(glider.group);

    // 3D Sine Wave Trail Ribbon Spheres
    const trailCount = 28;
    const trailGeo = new THREE.SphereGeometry(0.11, 8, 8);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const trailInstanced = new THREE.InstancedMesh(trailGeo, trailMat, trailCount);
    trailInstanced.frustumCulled = false;
    stage.scene.add(trailInstanced);
    const trailHistory: number[] = Array(trailCount).fill(3.0);
    const dummyMat = new THREE.Matrix4();

    const ringGeo = new THREE.TorusGeometry(0.78, 0.09, 10, 24);
    ringGeo.rotateY(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.85
    });

    const hazardGeo = new THREE.OctahedronGeometry(0.62, 0);
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.85
    });

    stage.startLoop((dt) => {
      if (gameStateRef.current !== 'playing') return;

      const r = riderRef.current;
      const activeFreq = r.boosting ? 5.6 : 2.6;
      r.phase += activeFreq * dt;
      const prevY = r.y;
      r.y = 3.2 + Math.sin(r.phase) * r.amp;
      const dy = (r.y - prevY) / Math.max(0.001, dt);

      glider.group.position.set(-3.2, r.y, 0);
      glider.group.rotation.x = THREE.MathUtils.clamp(-dy * 0.06, -0.6, 0.6);

      // Update 3D wave trail
      trailHistory.pop();
      trailHistory.unshift(r.y);
      for (let i = 0; i < trailCount; i++) {
        const s = 1 - i / trailCount;
        dummyMat.makeScale(s, s, s);
        dummyMat.setPosition(-3.2 - i * 0.28, trailHistory[i], 0);
        trailInstanced.setMatrixAt(i, dummyMat);
      }
      trailInstanced.instanceMatrix.needsUpdate = true;

      r.spawnTimer -= dt;
      if (r.spawnTimer <= 0) {
        r.spawnTimer = 0.78;
        const isHazard = Math.random() < 0.42;
        const mesh = new THREE.Mesh(isHazard ? hazardGeo : ringGeo, isHazard ? hazardMat : ringMat);
        const gy = 3.2 + (Math.random() - 0.5) * 4.2;
        mesh.position.set(11, gy, 0);
        stage.scene.add(mesh);
        gatesRef.current.push({ mesh, x: 11, y: gy, isHazard, passed: false });
      }

      for (let i = gatesRef.current.length - 1; i >= 0; i--) {
        const g = gatesRef.current[i];
        g.x -= r.speed * dt;
        g.mesh.position.x = g.x;
        if (g.isHazard) g.mesh.rotation.y += dt * 4;

        if (!g.passed && Math.abs(g.x - -3.2) < 0.72) {
          const distY = Math.abs(g.y - r.y);
          if (g.isHazard && distY < 0.78) {
            stage.particles.burst(-3.2, r.y, 0, 34, 0xef4444, 9.5);
            stage.triggerTrauma(0.75);
            audio.playExplosion?.();
            triggerGameOver(scoreRef.current);
            return;
          } else if (!g.isHazard && distY < 0.95) {
            g.passed = true;
            stage.scene.remove(g.mesh);
            gatesRef.current.splice(i, 1);
            addScore(25);
            audio.playCoin?.();
            stage.particles.burst(-3.2, r.y, 0, 18, 0x22d3ee, 7);
            continue;
          }
        }

        if (g.x < -10) {
          stage.scene.remove(g.mesh);
          gatesRef.current.splice(i, 1);
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
      className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-cyan-500/20"
      onPointerDown={() => {
        riderRef.current.boosting = true;
        setFreqLabel('2.2 Hz');
      }}
      onPointerUp={() => {
        riderRef.current.boosting = false;
        setFreqLabel('1.0 Hz');
      }}
    >
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-cyan-400">
            <Waves className="w-3.5 h-3.5" /> FREKUENSI: {freqLabel}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-cyan-400" /> Tahan Space / Klik untuk Mempercepat Gelombang Sinus 3D
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
        title="Sine Rider 3D"
        description="Kendalikan frekuensi gelombang sinus pesawat 3D untuk menembus cincin neon dan menghindari ranjau merah!"
        themeColor="cyan"
      />
    </div>
  );
}
