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
import { Brain, Sparkles, Zap } from 'lucide-react';

const PAD_COLORS = [0x06b6d4, 0xec4899, 0xfacc15, 0x22c55e];
const PAD_POSITIONS: [number, number][] = [
  [-1.65, -1.65],
  [1.65, -1.65],
  [-1.65, 1.65],
  [1.65, 1.65]
];

export default function CyberSimonGame({
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
    gameId: 'cyber-simon',
    onGameOver,
    onScoreUpdate
  });

  const [seqLength, setSeqLength] = useState(1);
  const [statusText, setStatusText] = useState('PERHATIKAN URUTAN');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const simonRef = useRef({
    sequence: [0] as number[],
    playerStep: 0,
    showingSeq: true,
    showIdx: 0,
    showTimer: 0.65,
    litPad: -1,
    litTimer: 0
  });

  const handlePadInput = useCallback(
    (padIdx: number) => {
      if (gameStateRef.current !== 'playing') return;
      const st = simonRef.current;
      if (st.showingSeq) return;

      st.litPad = padIdx;
      st.litTimer = 0.28;
      audio.playClick?.();

      const stage = stageRef.current;
      const [px, pz] = PAD_POSITIONS[padIdx];
      stage?.particles.burst(px, 0.65, pz, 16, PAD_COLORS[padIdx], 6.5);

      if (st.sequence[st.playerStep] === padIdx) {
        st.playerStep += 1;
        addScore(20);
        if (st.playerStep >= st.sequence.length) {
          addScore(50);
          audio.playCoin?.();
          stage?.kickFov(3.5);
          st.sequence.push(Math.floor(Math.random() * 4));
          setSeqLength(st.sequence.length);
          st.playerStep = 0;
          st.showingSeq = true;
          st.showIdx = 0;
          st.showTimer = 0.75;
          setStatusText('PERHATIKAN URUTAN 3D');
        }
      } else {
        stage?.particles.burst(0, 0.8, 0, 36, 0xef4444, 9.5);
        stage?.triggerTrauma(0.75);
        audio.playExplosion?.();
        triggerGameOver(scoreRef.current);
      }
    },
    [addScore, scoreRef, triggerGameOver]
  );

  const handleStart = useCallback(() => {
    simonRef.current = {
      sequence: [Math.floor(Math.random() * 4)],
      playerStep: 0,
      showingSeq: true,
      showIdx: 0,
      showTimer: 0.75,
      litPad: -1,
      litTimer: 0
    };
    setSeqLength(1);
    setStatusText('PERHATIKAN URUTAN 3D');
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1' || e.key === 'q' || e.key === 'ArrowUp') handlePadInput(0);
      else if (e.key === '2' || e.key === 'w' || e.key === 'ArrowRight') handlePadInput(1);
      else if (e.key === '3' || e.key === 'a' || e.key === 'ArrowLeft') handlePadInput(2);
      else if (e.key === '4' || e.key === 's' || e.key === 'ArrowDown') handlePadInput(3);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePadInput]);

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
        backgroundColor: 0x080514,
        fogColor: 0x080514,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#a855f7',
        gridSecondaryColor: '#110922',
        cameraPresets: {
          isometric: { position: [6.8, 9.5, 6.8], lookAt: [0, 0.3, 0], fov: 45 },
          chase: { position: [0, 7.2, 8.8], lookAt: [0, 0.3, 0], fov: 48 },
          diorama: { position: [0, 11.8, 1.2], lookAt: [0, 0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build Central Synthesizer Base Chassis + 4 Quartz Crystal Pads
    const baseHub = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.1, 0.38, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        metalness: 0.85,
        roughness: 0.22,
        clearcoat: 0.9
      })
    );
    baseHub.position.y = 0.19;
    stage.scene.add(baseHub);

    const padMeshes: THREE.Mesh[] = [];
    const padGeo = new THREE.CylinderGeometry(1.18, 1.28, 0.45, 24);

    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: PAD_COLORS[i],
        emissive: PAD_COLORS[i],
        emissiveIntensity: 0.22,
        roughness: 0.15,
        metalness: 0.3,
        clearcoat: 0.95
      });
      const mesh = new THREE.Mesh(padGeo, mat);
      mesh.position.set(PAD_POSITIONS[i][0], 0.48, PAD_POSITIONS[i][1]);
      mesh.castShadow = true;
      mesh.userData.padIdx = i;
      stage.scene.add(mesh);
      padMeshes.push(mesh);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const hits = raycaster.intersectObjects(padMeshes, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData.padIdx as number | undefined;
        if (typeof idx === 'number') handlePadInput(idx);
      }
    };

    container.addEventListener('pointerdown', onPointerDown);

    stage.startLoop((dt) => {
      const st = simonRef.current;

      if (gameStateRef.current === 'playing') {
        if (st.litTimer > 0) {
          st.litTimer -= dt;
          if (st.litTimer <= 0) st.litPad = -1;
        }

        if (st.showingSeq) {
          st.showTimer -= dt;
          if (st.showTimer <= 0) {
            if (st.showIdx < st.sequence.length) {
              const pIdx = st.sequence[st.showIdx];
              st.litPad = pIdx;
              st.litTimer = 0.38;
              st.showIdx += 1;
              st.showTimer = 0.58;
              audio.playClick?.();
            } else {
              st.showingSeq = false;
              setStatusText('GILIRAN ANDA!');
            }
          }
        }
      }

      for (let i = 0; i < 4; i++) {
        const m = padMeshes[i];
        const mat = m.material as THREE.MeshPhysicalMaterial;
        const isLit = st.litPad === i;
        mat.emissiveIntensity = THREE.MathUtils.damp(
          mat.emissiveIntensity,
          isLit ? 1.35 : 0.22,
          14,
          dt
        );
        m.position.y = THREE.MathUtils.damp(m.position.y, isLit ? 0.62 : 0.45, 14, dt);
      }
    });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      stage.dispose();
      stageRef.current = null;
    };
  }, [handlePadInput]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-purple-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-purple-400">
            <Brain className="w-3.5 h-3.5" /> PANJANG NADA: {seqLength}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs font-semibold text-amber-400">
          <Sparkles className="w-3.5 h-3.5" /> {statusText}
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-purple-400" /> Klik Kristal 3D atau Tekan 1–4 Sesuai Urutan Cahaya
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
        title="Cyber Simon 3D"
        description="Hafalkan dan ulangi urutan pendaran kristal kuarsa 3D di atas konsol sintetis!"
        themeColor="purple"
      />
    </div>
  );
}
