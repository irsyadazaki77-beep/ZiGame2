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
import { Brain, Timer, Zap } from 'lucide-react';

interface HoloCard3D {
  index: number;
  symbolId: number; // 0..7
  flipped: boolean;
  matched: boolean;
  rotZ: number;
  group: THREE.Group;
  collider: THREE.Mesh;
}

const SYMBOL_COLORS = [
  0xec4899,
  0x06b6d4,
  0xfacc15,
  0x22c55e,
  0xa855f7,
  0xf97316,
  0x3b82f6,
  0xef4444
];

export default function MemoryGridGame({
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
    gameId: 'memory-grid',
    onGameOver,
    onScoreUpdate
  });

  const [pairsFound, setPairsFound] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const memStateRef = useRef({
    timeLeft: 60,
    firstPick: null as HoloCard3D | null,
    secondPick: null as HoloCard3D | null,
    lockTimer: 0,
    matchedCount: 0
  });

  const shuffleDeckFnRef = useRef<() => void>(() => {});

  const handleStart = useCallback(() => {
    memStateRef.current = {
      timeLeft: 60,
      firstPick: null,
      secondPick: null,
      lockTimer: 0,
      matchedCount: 0
    };
    setPairsFound(0);
    setTimeLeft(60);
    shuffleDeckFnRef.current();
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
    const container = mountRef.current;
    if (!container) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x090514,
        fogColor: 0x090514,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#a855f7',
        gridSecondaryColor: '#120822',
        cameraPresets: {
          isometric: { position: [6.8, 10.2, 6.8], lookAt: [0, 0.2, 0], fov: 45 },
          chase: { position: [0, 7.8, 8.8], lookAt: [0, 0.2, 0], fov: 48 },
          diorama: { position: [0, 12.8, 1.2], lookAt: [0, 0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const emblemGeos = [
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.TorusGeometry(0.26, 0.08, 8, 20),
      new THREE.DodecahedronGeometry(0.3, 0),
      new THREE.ConeGeometry(0.3, 0.5, 6),
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.CylinderGeometry(0.24, 0.24, 0.42, 8),
      new THREE.IcosahedronGeometry(0.32, 0)
    ];

    const step = 1.45;
    const cardGeo = new THREE.BoxGeometry(1.18, 0.16, 1.18);
    const backMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.82,
      roughness: 0.24,
      clearcoat: 0.85
    });

    const cards: HoloCard3D[] = [];
    const colliders: THREE.Mesh[] = [];

    for (let i = 0; i < 16; i++) {
      const r = Math.floor(i / 4);
      const c = i % 4;
      const wx = (c - 1.5) * step;
      const wz = (r - 1.5) * step;

      const group = new THREE.Group();
      group.position.set(wx, 0.35, wz);

      const slab = new THREE.Mesh(cardGeo, backMat);
      slab.castShadow = true;
      group.add(slab);

      // Emblem placed on underside (-Y) so when card flips 180° (rotZ = PI), emblem sits on top!
      const emblemMat = new THREE.MeshStandardMaterial({
        color: SYMBOL_COLORS[i % 8],
        emissive: SYMBOL_COLORS[i % 8],
        emissiveIntensity: 0.85
      });
      const emblem = new THREE.Mesh(emblemGeos[i % 8], emblemMat);
      emblem.position.y = -0.26;
      group.add(emblem);

      stage.scene.add(group);

      const collider = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.8, 1.25),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      collider.position.set(wx, 0.4, wz);
      stage.scene.add(collider);

      const card: HoloCard3D = {
        index: i,
        symbolId: Math.floor(i / 2),
        flipped: false,
        matched: false,
        rotZ: 0,
        group,
        collider
      };
      collider.userData.card = card;
      cards.push(card);
      colliders.push(collider);
    }

    shuffleDeckFnRef.current = () => {
      const ids = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7];
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      cards.forEach((card, idx) => {
        const sym = ids[idx];
        card.symbolId = sym;
        card.flipped = false;
        card.matched = false;
        const emblem = card.group.children[1] as THREE.Mesh;
        emblem.geometry = emblemGeos[sym];
        const mat = emblem.material as THREE.MeshStandardMaterial;
        mat.color.setHex(SYMBOL_COLORS[sym]);
        mat.emissive.setHex(SYMBOL_COLORS[sym]);
      });
    };
    shuffleDeckFnRef.current();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const st = memStateRef.current;
      if (st.lockTimer > 0) return;

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const hits = raycaster.intersectObjects(colliders, false);
      if (hits.length > 0) {
        const card = hits[0].object.userData.card as HoloCard3D | undefined;
        if (!card || card.flipped || card.matched) return;

        card.flipped = true;
        audio.playClick?.();

        if (!st.firstPick) {
          st.firstPick = card;
        } else {
          st.secondPick = card;
          if (st.firstPick.symbolId === st.secondPick.symbolId) {
            st.firstPick.matched = true;
            st.secondPick.matched = true;
            stage.particles.burst(
              card.group.position.x,
              0.7,
              card.group.position.z,
              22,
              SYMBOL_COLORS[card.symbolId],
              7
            );
            stage.triggerTrauma(0.2);
            st.firstPick = null;
            st.secondPick = null;
            st.matchedCount += 1;
            setPairsFound(st.matchedCount);
            addScore(50);
            audio.playCoin?.();

            if (st.matchedCount >= 8) {
              addScore(200);
              stage.kickFov(5);
              st.matchedCount = 0;
              st.timeLeft = Math.min(60, st.timeLeft + 20);
              setPairsFound(0);
              shuffleDeckFnRef.current();
            }
          } else {
            st.lockTimer = 0.7;
          }
        }
      }
    };

    container.addEventListener('pointerdown', onPointerDown);

    stage.startLoop((dt) => {
      if (gameStateRef.current === 'playing') {
        const st = memStateRef.current;
        st.timeLeft -= dt;
        setTimeLeft(Math.max(0, Math.ceil(st.timeLeft)));
        if (st.timeLeft <= 0) {
          triggerGameOver(scoreRef.current);
          return;
        }

        if (st.lockTimer > 0) {
          st.lockTimer -= dt;
          if (st.lockTimer <= 0) {
            if (st.firstPick) st.firstPick.flipped = false;
            if (st.secondPick) st.secondPick.flipped = false;
            st.firstPick = null;
            st.secondPick = null;
          }
        }
      }

      for (const c of cards) {
        const targetRot = c.flipped || c.matched ? Math.PI : 0;
        c.rotZ = THREE.MathUtils.damp(c.rotZ, targetRot, 12, dt);
        c.group.rotation.z = c.rotZ;
      }
    });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-purple-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-purple-400">
            <Brain className="w-3.5 h-3.5" /> PASANGAN: {pairsFound} / 8
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs font-semibold text-cyan-400 tabular-nums">
          <Timer className="w-3.5 h-3.5" /> {timeLeft}s
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-purple-400" /> Klik Tablet 3D untuk Membalik & Mencocokkan Simbol Geometri
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
        title="Memory Grid 3D"
        description="Balikkan kartu tablet holografik 3D dan cocokkan pasangan emblem geometri sebelum waktu habis!"
        themeColor="purple"
      />
    </div>
  );
}
