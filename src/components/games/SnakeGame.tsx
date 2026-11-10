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
import { Zap, Sparkles } from 'lucide-react';

const GRID_HALF = 7; // -7 to +7 (15x15 3D arena)

interface GridCoord {
  x: number;
  z: number;
}

export default function SnakeGame({
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
    gameId: 'snake',
    onGameOver,
    onScoreUpdate
  });

  const [snakeLen, setSnakeLen] = useState(3);
  const [turboActive, setTurboActive] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const snakeStateRef = useRef({
    segments: [
      { x: 0, z: 0 },
      { x: 0, z: 1 },
      { x: 0, z: 2 }
    ] as GridCoord[],
    dir: { x: 0, z: -1 },
    nextDir: { x: 0, z: -1 },
    apple: { x: 3, z: -3 },
    goldenOrb: null as GridCoord | null,
    stepTimer: 0,
    stepInterval: 0.145,
    turboTimer: 0
  });

  const resetSnakeRef = useRef<() => void>(() => {});

  const handleStart = useCallback(() => {
    resetSnakeRef.current();
    setSnakeLen(3);
    setTurboActive(false);
    startWithCountdown();
  }, [startWithCountdown]);

  const setDirection = useCallback((dx: number, dz: number) => {
    const cur = snakeStateRef.current.dir;
    if (cur.x === -dx && cur.z === -dz) return; // Prevent 180 self-reverse
    snakeStateRef.current.nextDir = { x: dx, z: dz };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowup' || k === 'w') setDirection(0, -1);
      else if (k === 'arrowdown' || k === 's') setDirection(0, 1);
      else if (k === 'arrowleft' || k === 'a') setDirection(-1, 0);
      else if (k === 'arrowright' || k === 'd') setDirection(1, 0);
    };
    window.addEventListener('keydown', onKeyDown);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'UP') setDirection(0, -1);
        if (action === 'DOWN') setDirection(0, 1);
        if (action === 'LEFT') setDirection(-1, 0);
        if (action === 'RIGHT') setDirection(1, 0);
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsub();
    };
  }, [setDirection]);

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
        backgroundColor: 0x050e0a,
        fogColor: 0x050e0a,
        fogDensity: 0.015,
        initialPreset: 'isometric',
        gridPrimaryColor: '#22c55e',
        gridSecondaryColor: '#07150f',
        cameraPresets: {
          isometric: { position: [10.5, 13.8, 10.5], lookAt: [0, 0.3, 0], fov: 46 },
          chase: { position: [0, 9.5, 13.5], lookAt: [0, 0.3, -1], fov: 52 },
          diorama: { position: [0, 18.8, 1.5], lookAt: [0, 0, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 3D Perimeter Arena Fence (4 glowing walls)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.7
    });
    const span = (GRID_HALF + 0.8) * 2;
    const wallH = new THREE.Mesh(new THREE.BoxGeometry(span, 0.45, 0.22), wallMat);
    wallH.position.set(0, 0.225, -(GRID_HALF + 0.8));
    const wallS = wallH.clone();
    wallS.position.z = GRID_HALF + 0.8;
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, span), wallMat);
    wallW.position.set(-(GRID_HALF + 0.8), 0.225, 0);
    const wallE = wallW.clone();
    wallE.position.x = GRID_HALF + 0.8;
    stage.scene.add(wallH, wallS, wallW, wallE);

    // Multi-part 3D Snake Head Group (Head + 2 Glowing Eyes + Crest)
    const headGroup = new THREE.Group();
    const headMat = new THREE.MeshPhysicalMaterial({
      color: 0x22c55e,
      metalness: 0.4,
      roughness: 0.2,
      clearcoat: 0.85
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.95
    });
    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.68, 0.88), headMat);
    headBox.position.y = 0.34;
    headBox.castShadow = true;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
    eyeL.position.set(-0.24, 0.52, -0.36);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.24;
    headGroup.add(headBox, eyeL, eyeR);
    stage.scene.add(headGroup);

    // Instanced Body Segments
    const maxSegments = 225;
    const segGeo = new THREE.BoxGeometry(0.76, 0.56, 0.76);
    const segMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x15803d,
      emissiveIntensity: 0.35,
      roughness: 0.28,
      metalness: 0.5
    });
    const bodyInstanced = new THREE.InstancedMesh(segGeo, segMat, maxSegments);
    bodyInstanced.frustumCulled = false;
    stage.scene.add(bodyInstanced);

    // 3D Neon Apple Group (Core + Stem + Leaf)
    const appleGroup = new THREE.Group();
    const appleCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.44, 1),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.75,
        roughness: 0.18
      })
    );
    appleCore.position.y = 0.48;
    const appleRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.04, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xfca5a5 })
    );
    appleRing.rotation.x = Math.PI / 2;
    appleRing.position.y = 0.48;
    appleGroup.add(appleCore, appleRing);
    stage.scene.add(appleGroup);

    const dummyMat = new THREE.Matrix4();

    const pickFreeCoord = (segments: GridCoord[]): GridCoord => {
      for (let tries = 0; tries < 80; tries++) {
        const cx = Math.floor(Math.random() * (GRID_HALF * 2 + 1)) - GRID_HALF;
        const cz = Math.floor(Math.random() * (GRID_HALF * 2 + 1)) - GRID_HALF;
        if (!segments.some((s) => s.x === cx && s.z === cz)) {
          return { x: cx, z: cz };
        }
      }
      return { x: 0, z: -4 };
    };

    const syncMeshes = () => {
      const st = snakeStateRef.current;
      const head = st.segments[0];
      headGroup.position.set(head.x, 0, head.z);
      headGroup.rotation.y = Math.atan2(-st.dir.x, -st.dir.z);

      for (let i = 0; i < maxSegments; i++) {
        if (i > 0 && i < st.segments.length) {
          const seg = st.segments[i];
          const s = Math.max(0.55, 1 - i * 0.012);
          dummyMat.makeScale(s, s, s);
          dummyMat.setPosition(seg.x, 0.28 * s, seg.z);
          bodyInstanced.setMatrixAt(i, dummyMat);
        } else {
          dummyMat.makeScale(0, 0, 0);
          dummyMat.setPosition(0, -999, 0);
          bodyInstanced.setMatrixAt(i, dummyMat);
        }
      }
      bodyInstanced.instanceMatrix.needsUpdate = true;

      appleGroup.position.set(st.apple.x, 0, st.apple.z);
    };

    resetSnakeRef.current = () => {
      snakeStateRef.current = {
        segments: [
          { x: 0, z: 0 },
          { x: 0, z: 1 },
          { x: 0, z: 2 }
        ],
        dir: { x: 0, z: -1 },
        nextDir: { x: 0, z: -1 },
        apple: { x: 3, z: -3 },
        goldenOrb: null,
        stepTimer: 0,
        stepInterval: 0.145,
        turboTimer: 0
      };
      syncMeshes();
    };
    resetSnakeRef.current();

    stage.startLoop((dt, elapsed) => {
      appleGroup.rotation.y = elapsed * 3;
      appleCore.position.y = 0.48 + Math.sin(elapsed * 5) * 0.1;

      if (gameStateRef.current !== 'playing') return;

      const st = snakeStateRef.current;
      if (st.turboTimer > 0) {
        st.turboTimer -= dt;
        if (st.turboTimer <= 0) setTurboActive(false);
      }

      const interval = st.turboTimer > 0 ? st.stepInterval * 0.72 : st.stepInterval;
      st.stepTimer += dt;
      if (st.stepTimer < interval) return;
      st.stepTimer -= interval;

      st.dir = st.nextDir;
      const newHead: GridCoord = {
        x: st.segments[0].x + st.dir.x,
        z: st.segments[0].z + st.dir.z
      };

      // Wall or self collision check
      const hitWall = Math.abs(newHead.x) > GRID_HALF || Math.abs(newHead.z) > GRID_HALF;
      const hitSelf = st.segments.some((s) => s.x === newHead.x && s.z === newHead.z);
      if (hitWall || hitSelf) {
        stage.particles.burst(st.segments[0].x, 0.5, st.segments[0].z, 36, 0xef4444, 9);
        stage.triggerTrauma(0.75);
        audio.playExplosion?.();
        triggerGameOver(scoreRef.current);
        return;
      }

      st.segments.unshift(newHead);

      if (newHead.x === st.apple.x && newHead.z === st.apple.z) {
        addScore(st.turboTimer > 0 ? 30 : 15);
        setSnakeLen(st.segments.length);
        st.stepInterval = Math.max(0.085, st.stepInterval * 0.985);
        stage.particles.burst(newHead.x, 0.6, newHead.z, 22, 0x22c55e, 7);
        stage.triggerTrauma(0.2);
        audio.playCoin?.();
        if (st.segments.length % 5 === 0) {
          st.turboTimer = 5.0;
          setTurboActive(true);
          stage.kickFov(4);
        }
        st.apple = pickFreeCoord(st.segments);
      } else {
        st.segments.pop();
      }

      stage.setFollowTarget(newHead.x, 0, newHead.z, 0.25);
      syncMeshes();
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-emerald-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="font-semibold text-emerald-400">PANJANG: {snakeLen}</span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        {turboActive && (
          <div className="flex items-center gap-1 rounded-xl border border-amber-500/30 bg-slate-950/85 px-3 py-2 text-xs font-semibold text-amber-400">
            <Sparkles className="w-3.5 h-3.5" /> TURBO 2X SKOR
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
            <Zap className="w-3 h-3 text-emerald-400" /> WASD / Panah: Kemudikan Ular Siber 3D
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
        title="Pixel Snake 3D"
        description="Arahkan ular mekanik 3D di atas papan sirkuit neon, santap apel energi 3D, dan aktifkan mode Turbo!"
        themeColor="emerald"
      />
    </div>
  );
}
