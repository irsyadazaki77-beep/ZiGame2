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
import { Music, Flame, Zap } from 'lucide-react';

interface RhythmNote3D {
  mesh: THREE.Mesh;
  lane: number; // 0, 1, 2, 3
  z: number;
  hit: boolean;
}

const LANE_X = [-2.7, -0.9, 0.9, 2.7];
const LANE_COLORS = [0xec4899, 0x06b6d4, 0xa855f7, 0xf59e0b];
const HIT_Z = 4.6;

export default function RhythmTapGame({
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
    gameId: 'rhythm-tap',
    onGameOver,
    onScoreUpdate
  });

  const [combo, setCombo] = useState(0);
  const [missesLeft, setMissesLeft] = useState(5);
  const [judgment, setJudgment] = useState<string>('READY');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const rhythmRef = useRef({
    combo: 0,
    missesLeft: 5,
    speed: 11.5,
    spawnTimer: 0.35
  });

  const notesRef = useRef<RhythmNote3D[]>([]);

  const tapLane = useCallback(
    (laneIdx: number) => {
      if (gameStateRef.current !== 'playing') return;
      const stage = stageRef.current;
      const st = rhythmRef.current;

      // Find closest note in this lane near HIT_Z
      let bestIdx = -1;
      let bestDist = Infinity;
      notesRef.current.forEach((n, idx) => {
        if (n.lane === laneIdx && !n.hit) {
          const d = Math.abs(n.z - HIT_Z);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        }
      });

      if (bestIdx !== -1 && bestDist < 1.35) {
        const note = notesRef.current[bestIdx];
        note.hit = true;
        stage?.scene.remove(note.mesh);
        notesRef.current.splice(bestIdx, 1);

        const isPerfect = bestDist < 0.55;
        st.combo += 1;
        setCombo(st.combo);
        setJudgment(isPerfect ? 'PERFECT!' : 'GREAT!');
        const mult = Math.min(4, 1 + Math.floor(st.combo / 6));
        addScore((isPerfect ? 30 : 15) * mult);
        audio.playCoin?.();
        stage?.particles.burst(
          LANE_X[laneIdx],
          0.45,
          HIT_Z,
          isPerfect ? 22 : 12,
          LANE_COLORS[laneIdx],
          7
        );
        if (isPerfect) stage?.triggerTrauma(0.18);
      } else {
        stage?.particles.burst(LANE_X[laneIdx], 0.3, HIT_Z, 6, 0x64748b, 3.5);
        audio.playClick?.();
      }
    },
    [addScore]
  );

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      notesRef.current.forEach((n) => stage.scene.remove(n.mesh));
    }
    notesRef.current = [];
    rhythmRef.current = {
      combo: 0,
      missesLeft: 5,
      speed: 11.5,
      spawnTimer: 0.35
    };
    setCombo(0);
    setMissesLeft(5);
    setJudgment('SYNTH READY');
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'd' || k === 'arrowleft' || k === '1') tapLane(0);
      else if (k === 'f' || k === 'arrowdown' || k === '2') tapLane(1);
      else if (k === 'j' || k === 'arrowup' || k === '3') tapLane(2);
      else if (k === 'k' || k === 'arrowright' || k === '4') tapLane(3);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tapLane]);

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
        fogDensity: 0.018,
        initialPreset: 'chase',
        gridPrimaryColor: '#a855f7',
        gridSecondaryColor: '#120924',
        cameraPresets: {
          chase: { position: [0, 6.2, 10.8], lookAt: [0, 0.2, -2.5], fov: 52 },
          isometric: { position: [7.8, 9.5, 9.5], lookAt: [0, 0.2, -1], fov: 46 },
          diorama: { position: [0, 14.5, 2.0], lookAt: [0, 0, -1], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 4-Lane Synthwave Note Highway & Receptor Pads
    const padGeo = new THREE.CylinderGeometry(0.68, 0.75, 0.22, 16);
    for (let i = 0; i < 4; i++) {
      const padMat = new THREE.MeshStandardMaterial({
        color: LANE_COLORS[i],
        emissive: LANE_COLORS[i],
        emissiveIntensity: 0.65,
        roughness: 0.2
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(LANE_X[i], 0.11, HIT_Z);
      stage.scene.add(pad);
    }

    const noteGeo = new THREE.BoxGeometry(1.25, 0.36, 0.65);

    stage.startLoop((dt) => {
      if (gameStateRef.current !== 'playing') return;

      const st = rhythmRef.current;
      st.speed = Math.min(20, st.speed + dt * 0.18);

      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = Math.max(0.24, 0.55 - (st.speed - 11.5) * 0.02);
        const lane = Math.floor(Math.random() * 4);
        const mat = new THREE.MeshPhysicalMaterial({
          color: LANE_COLORS[lane],
          emissive: LANE_COLORS[lane],
          emissiveIntensity: 0.75,
          roughness: 0.15,
          clearcoat: 0.9
        });
        const mesh = new THREE.Mesh(noteGeo, mat);
        mesh.position.set(LANE_X[lane], 0.28, -15);
        mesh.castShadow = true;
        stage.scene.add(mesh);
        notesRef.current.push({ mesh, lane, z: -15, hit: false });
      }

      for (let i = notesRef.current.length - 1; i >= 0; i--) {
        const n = notesRef.current[i];
        n.z += st.speed * dt;
        n.mesh.position.z = n.z;

        if (n.z > HIT_Z + 1.45) {
          stage.scene.remove(n.mesh);
          notesRef.current.splice(i, 1);
          st.combo = 0;
          setCombo(0);
          setJudgment('MISS');
          st.missesLeft -= 1;
          setMissesLeft(st.missesLeft);
          stage.triggerTrauma(0.35);
          if (st.missesLeft <= 0) {
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
  }, [scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-purple-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-purple-400">
            <Music className="w-3.5 h-3.5" /> {judgment}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
          {combo > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-semibold">{combo}x COMBO</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs font-semibold text-rose-400 tabular-nums">
          <Flame className="w-3.5 h-3.5" /> NYAWA: {missesLeft}
        </div>
      </div>

      {/* Interactive Touch / Click 4-Lane Buttons above Dock */}
      {gameState === 'playing' && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-16 z-10 flex justify-center gap-2 px-4">
          {['D (Lane 1)', 'F (Lane 2)', 'J (Lane 3)', 'K (Lane 4)'].map((lbl, idx) => (
            <button
              key={lbl}
              type="button"
              onPointerDown={() => tapLane(idx)}
              className="rounded-xl border border-white/15 bg-slate-900/90 px-4 py-2.5 text-xs font-semibold text-white shadow-lg active:scale-95 transition-transform whitespace-nowrap shrink-0"
            >
              {lbl}
            </button>
          ))}
        </div>
      )}

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-purple-400" /> Tombol D, F, J, K atau Klik Tombol Jalur Saat Balok Menyentuh Target
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
        title="Cyber Rhythm Beats 3D"
        description="Ketuk irama not balok 3D tepat saat mencapai bantalan frekuensi Synthwave!"
        themeColor="purple"
      />
    </div>
  );
}
