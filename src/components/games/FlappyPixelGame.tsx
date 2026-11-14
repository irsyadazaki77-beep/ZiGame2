import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk/audioController';
import { ObjectPool } from '../../sdk/objectPool';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Zap, Sparkles } from 'lucide-react';

interface PipeGate3D {
  group: THREE.Group;
  botPipe: THREE.Mesh;
  topPipe: THREE.Mesh;
  x: number;
  gapY: number;
  passed: boolean;
  coinMesh: THREE.Mesh;
  coinCollected: boolean;
}

function buildCyberBird3D(): {
  group: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
} {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    metalness: 0.45,
    roughness: 0.22,
    clearcoat: 0.85
  });
  const beakMat = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    roughness: 0.3
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.9
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), bodyMat);
  body.scale.set(1.25, 0.95, 0.9);
  body.castShadow = true;
  group.add(body);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 6), beakMat);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.52, 0, 0);
  group.add(beak);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
  eye.position.set(0.28, 0.14, 0.28);
  const eye2 = eye.clone();
  eye2.position.z = -0.28;
  group.add(eye, eye2);

  const wingGeo = new THREE.BoxGeometry(0.38, 0.08, 0.55);
  const wingL = new THREE.Mesh(wingGeo, bodyMat);
  wingL.position.set(0, 0.05, 0.42);
  const wingR = wingL.clone();
  wingR.position.z = -0.42;
  group.add(wingL, wingR);

  return { group, wingL, wingR };
}

export default function FlappyPixelGame({
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
    gameId: 'flappy-pixel',
    onGameOver,
    onScoreUpdate
  });

  const [gatesPassed, setGatesPassed] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const birdStateRef = useRef({
    y: 4.0,
    vy: 0,
    gates: 0,
    spawnTimer: 0.4
  });

  const pipePoolRef = useRef<ObjectPool<PipeGate3D> | null>(null);

  const flap = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    birdStateRef.current.vy = 8.4;
    audioController.playJump();
  }, []);

  const handleStart = useCallback(() => {
    pipePoolRef.current?.releaseAll();
    birdStateRef.current = {
      y: 4.0,
      vy: 4.5,
      gates: 0,
      spawnTimer: 0.4
    };
    setGatesPassed(0);
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        flap();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'PRIMARY' || action === 'ACTION_PRIMARY' || action === 'UP') flap();
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsub();
    };
  }, [flap]);

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
        backgroundColor: 0x060a17,
        fogColor: 0x060a17,
        fogDensity: 0.018,
        initialPreset: 'chase',
        gridPrimaryColor: '#eab308',
        gridSecondaryColor: '#090f22',
        cameraPresets: {
          chase: { position: [-1.5, 4.2, 11.2], lookAt: [1.0, 4.0, 0], fov: 50 },
          isometric: { position: [-6.5, 6.2, 9.5], lookAt: [1.0, 4.0, 0], fov: 48 },
          diorama: { position: [0, 4.2, 13.5], lookAt: [0, 4.0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const bird = buildCyberBird3D();
    bird.group.position.set(-2.5, 4.0, 0);
    stage.scene.add(bird.group);

    const pipeMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.35,
      metalness: 0.65,
      roughness: 0.25,
      clearcoat: 0.8
    });
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.85
    });

    const unitPipeGeo = new THREE.CylinderGeometry(0.55, 0.55, 1, 14);
    const coinGeo = new THREE.OctahedronGeometry(0.35, 0);
    const GAP_HALF = 1.65;

    const pipePool = new ObjectPool<PipeGate3D>(
      () => {
        const g = new THREE.Group();
        const botPipe = new THREE.Mesh(unitPipeGeo, pipeMat);
        botPipe.castShadow = true;
        const topPipe = new THREE.Mesh(unitPipeGeo, pipeMat);
        topPipe.castShadow = true;
        const coinMesh = new THREE.Mesh(coinGeo, coinMat);
        g.add(botPipe, topPipe, coinMesh);
        g.visible = false;
        stage.scene.add(g);
        return {
          group: g,
          botPipe,
          topPipe,
          x: 10,
          gapY: 4,
          passed: false,
          coinMesh,
          coinCollected: false
        };
      },
      (p) => {
        p.group.visible = false;
      },
      10
    );
    pipePoolRef.current = pipePool;

    stage.startLoop((dt, elapsed) => {
      const wingAngle = Math.sin(elapsed * 18) * 0.55;
      bird.wingL.rotation.x = wingAngle;
      bird.wingR.rotation.x = -wingAngle;

      if (gameStateRef.current !== 'playing') return;

      const b = birdStateRef.current;
      b.vy -= 21.5 * dt;
      b.y += b.vy * dt;

      bird.group.position.set(-2.5, b.y, 0);
      bird.group.rotation.z = THREE.MathUtils.clamp(b.vy * 0.06, -0.65, 0.55);

      if (b.y < 0.35 || b.y > 8.2) {
        stage.particles.burst(-2.5, Math.max(0.5, b.y), 0, 32, 0xef4444, 9);
        stage.triggerTrauma(0.75);
        audioController.playGameOver();
        triggerGameOver(scoreRef.current);
        return;
      }

      // Spawn 3D Pipe Gates
      b.spawnTimer -= dt;
      if (b.spawnTimer <= 0) {
        b.spawnTimer = 1.55;
        const gapY = 2.4 + Math.random() * 3.2;
        const botH = Math.max(0.5, gapY - GAP_HALF);
        const topYStart = gapY + GAP_HALF;
        const topH = Math.max(0.5, 9.0 - topYStart);

        const p = pipePool.acquire();
        p.x = 10;
        p.gapY = gapY;
        p.passed = false;
        p.coinCollected = false;

        p.botPipe.scale.set(1, botH, 1);
        p.botPipe.position.y = botH / 2;
        p.topPipe.scale.set(1, topH, 1);
        p.topPipe.position.y = topYStart + topH / 2;
        p.coinMesh.position.y = gapY;
        p.coinMesh.visible = true;
        p.group.position.set(10, 0, 0);
        p.group.visible = true;
      }

      const activePipes = pipePool.getActiveItems();
      for (let i = activePipes.length - 1; i >= 0; i--) {
        const p = activePipes[i];
        p.x -= 5.4 * dt;
        p.group.position.x = p.x;
        p.coinMesh.rotation.y += dt * 4;

        // Check collision at bird x = -2.5
        if (Math.abs(p.x - -2.5) < 0.78) {
          if (!p.coinCollected && Math.abs(b.y - p.gapY) < 0.95) {
            p.coinCollected = true;
            p.coinMesh.visible = false;
            addScore(15);
            audioController.playScore();
            stage.particles.burst(-2.5, p.gapY, 0, 14, 0xfacc15, 6);
          }

          if (Math.abs(b.y - p.gapY) > GAP_HALF - 0.3) {
            stage.particles.burst(-2.5, b.y, 0, 34, 0xef4444, 10);
            stage.triggerTrauma(0.75);
            audioController.playGameOver();
            triggerGameOver(scoreRef.current);
            return;
          }
        }

        if (!p.passed && p.x < -2.5) {
          p.passed = true;
          b.gates += 1;
          setGatesPassed(b.gates);
          addScore(10);
          audioController.playClick();
        }

        if (p.x < -10) {
          pipePool.release(i);
        }
      }
    });

    return () => {
      pipePool.releaseAll();
      pipePoolRef.current = null;
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div
      className="relative w-full h-full min-h-[260px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-amber-500/20 touch-none"
      onPointerDown={flap}
    >
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-amber-400">
            <Sparkles className="w-3.5 h-3.5" /> GERBANG: {gatesPassed}
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
            <Zap className="w-3 h-3 text-amber-400" /> Space / Klik: Kepakkan Sayap 3D
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
        title="Flappy Pixel 3D"
        description="Kepakkan sayap burung mekanik 3D melewati gerbang turbin neon dan kumpulkan kristal emas!"
        themeColor="amber"
      />
    </div>
  );
}
