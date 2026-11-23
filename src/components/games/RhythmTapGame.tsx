import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk/audioController';
import { ObjectPool } from '../../sdk/objectPool';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D,
  createHoloLabelSprite3D,
  updateHoloLabelSprite3D,
  dampValue
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
    spawnTimer: 0.35,
    padScales: [1, 1, 1, 1],
    beamAlpha: [0, 0, 0, 0],
    judgmentTimer: 0
  });

  const notePoolRef = useRef<ObjectPool<RhythmNote3D> | null>(null);
  const showJudgment3DRef = useRef<(label: string, colorHex: string) => void>(() => {});

  const tapLane = useCallback(
    (laneIdx: number) => {
      if (gameStateRef.current !== 'playing') return;
      const stage = stageRef.current;
      const st = rhythmRef.current;
      st.padScales[laneIdx] = 1.32;
      const activeNotes = notePoolRef.current?.getActiveItems() ?? [];

      // Find closest note in this lane near HIT_Z
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let idx = 0; idx < activeNotes.length; idx++) {
        const n = activeNotes[idx];
        if (n.lane === laneIdx && !n.hit) {
          const d = Math.abs(n.z - HIT_Z);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = idx;
          }
        }
      }

      if (bestIdx !== -1 && bestDist < 1.35) {
        notePoolRef.current?.release(bestIdx);

        const isPerfect = bestDist < 0.55;
        st.combo += 1;
        st.beamAlpha[laneIdx] = isPerfect ? 1.0 : 0.72;
        setCombo(st.combo);
        const judgeText = isPerfect ? `PERFECT x${st.combo}!` : 'GREAT!';
        setJudgment(isPerfect ? 'PERFECT!' : 'GREAT!');
        showJudgment3DRef.current(judgeText, isPerfect ? '#facc15' : '#38bdf8');
        const mult = Math.min(4, 1 + Math.floor(st.combo / 6));
        addScore((isPerfect ? 30 : 15) * mult);
        if (st.combo > 1) {
          audioController.playCombo(st.combo);
        } else {
          audioController.playScore();
        }
        stage?.particles.burst(
          LANE_X[laneIdx],
          0.45,
          HIT_Z,
          isPerfect ? 24 : 14,
          LANE_COLORS[laneIdx],
          7.5
        );
        if (isPerfect) {
          stage?.triggerShockwave(LANE_X[laneIdx], 0.08, HIT_Z, LANE_COLORS[laneIdx], 2.5, 0.34);
          stage?.triggerTrauma(0.18);
        }
      } else {
        st.beamAlpha[laneIdx] = 0.25;
        stage?.particles.burst(LANE_X[laneIdx], 0.3, HIT_Z, 6, 0x64748b, 3.5);
        audioController.playClick();
      }
    },
    [addScore]
  );

  const handleStart = useCallback(() => {
    notePoolRef.current?.releaseAll();
    rhythmRef.current = {
      combo: 0,
      missesLeft: 5,
      speed: 11.5,
      spawnTimer: 0.35,
      padScales: [1, 1, 1, 1],
      beamAlpha: [0, 0, 0, 0],
      judgmentTimer: 0
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

    // Build 4-Lane Synthwave Note Highway Deck, Divider Rails & Strike Line
    const highwayDeck = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 0.08, 22),
      new THREE.MeshPhysicalMaterial({
        color: 0x0f0722,
        metalness: 0.85,
        roughness: 0.22,
        clearcoat: 0.9
      })
    );
    highwayDeck.position.set(0, 0.04, -5.0);
    highwayDeck.receiveShadow = true;
    stage.scene.add(highwayDeck);

    const railGeo = new THREE.BoxGeometry(0.08, 0.16, 22);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 0.75
    });
    for (let r = 0; r < 5; r++) {
      const rx = -3.6 + r * 1.8;
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(rx, 0.1, -5.0);
      stage.scene.add(rail);
    }

    const strikeLine = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.06, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    strikeLine.position.set(0, 0.1, HIT_Z);
    stage.scene.add(strikeLine);

    const padGeo = new THREE.CylinderGeometry(0.68, 0.78, 0.24, 20);
    const ringGeo = new THREE.TorusGeometry(0.76, 0.055, 10, 24);
    ringGeo.rotateX(Math.PI / 2);
    const beamGeo = new THREE.CylinderGeometry(0.52, 0.68, 4.2, 16, 1, true);

    const pads: THREE.Mesh[] = [];
    const hitBeams: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];

    for (let i = 0; i < 4; i++) {
      const padMat = new THREE.MeshStandardMaterial({
        color: LANE_COLORS[i],
        emissive: LANE_COLORS[i],
        emissiveIntensity: 0.75,
        roughness: 0.2
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(LANE_X[i], 0.14, HIT_Z);
      const outerRing = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: LANE_COLORS[i] })
      );
      outerRing.position.y = 0.08;
      pad.add(outerRing);
      stage.scene.add(pad);
      pads.push(pad);

      const bMat = new THREE.MeshBasicMaterial({
        color: LANE_COLORS[i],
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const bMesh = new THREE.Mesh(beamGeo, bMat);
      bMesh.position.set(LANE_X[i], 2.2, HIT_Z);
      bMesh.visible = false;
      stage.scene.add(bMesh);
      hitBeams.push({ mesh: bMesh, mat: bMat });
    }

    const judgeSprite = createHoloLabelSprite3D('PERFECT!', {
      borderColor: '#a855f7',
      textColor: '#facc15',
      scaleX: 2.4,
      scaleY: 0.65
    });
    judgeSprite.position.set(0, 2.35, HIT_Z - 1.2);
    judgeSprite.visible = false;
    stage.scene.add(judgeSprite);

    showJudgment3DRef.current = (label: string, colorHex: string) => {
      updateHoloLabelSprite3D(judgeSprite, label, {
        borderColor: colorHex,
        textColor: colorHex
      });
      judgeSprite.visible = true;
      rhythmRef.current.judgmentTimer = 0.55;
    };

    const noteGeo = new THREE.BoxGeometry(1.3, 0.38, 0.68);
    const notePool = new ObjectPool<RhythmNote3D>(
      () => {
        const mat = new THREE.MeshPhysicalMaterial({
          color: LANE_COLORS[0],
          emissive: LANE_COLORS[0],
          emissiveIntensity: 0.85,
          roughness: 0.15,
          clearcoat: 0.9
        });
        const mesh = new THREE.Mesh(noteGeo, mat);
        mesh.castShadow = true;
        mesh.visible = false;
        stage.scene.add(mesh);
        return { mesh, lane: 0, z: -15, hit: false };
      },
      (n) => {
        n.hit = false;
        n.mesh.visible = false;
      },
      16
    );
    notePoolRef.current = notePool;

    stage.startLoop((dt) => {
      const st = rhythmRef.current;

      for (let i = 0; i < 4; i++) {
        st.padScales[i] = dampValue(st.padScales[i], 1.0, 16, dt);
        pads[i].scale.setScalar(st.padScales[i]);

        if (st.beamAlpha[i] > 0.01) {
          st.beamAlpha[i] = Math.max(0, st.beamAlpha[i] - dt * 4.5);
          hitBeams[i].mesh.visible = true;
          hitBeams[i].mat.opacity = st.beamAlpha[i] * 0.55;
        } else {
          hitBeams[i].mesh.visible = false;
        }
      }

      if (st.judgmentTimer > 0) {
        st.judgmentTimer -= dt;
        judgeSprite.position.y = 2.25 + (0.55 - st.judgmentTimer) * 0.65;
        if (st.judgmentTimer <= 0) {
          judgeSprite.visible = false;
        }
      }

      if (gameStateRef.current !== 'playing') return;

      st.speed = Math.min(20, st.speed + dt * 0.18);

      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = Math.max(0.24, 0.55 - (st.speed - 11.5) * 0.02);
        const lane = Math.floor(Math.random() * 4);
        const n = notePool.acquire();
        n.lane = lane;
        n.z = -15;
        n.hit = false;
        const mat = n.mesh.material as THREE.MeshPhysicalMaterial;
        mat.color.setHex(LANE_COLORS[lane]);
        mat.emissive.setHex(LANE_COLORS[lane]);
        n.mesh.position.set(LANE_X[lane], 0.3, -15);
        n.mesh.visible = true;
      }

      const activeNotes = notePool.getActiveItems();
      for (let i = activeNotes.length - 1; i >= 0; i--) {
        const n = activeNotes[i];
        n.z += st.speed * dt;
        n.mesh.position.z = n.z;

        if (n.z > HIT_Z + 1.45) {
          notePool.release(i);
          st.combo = 0;
          setCombo(0);
          setJudgment('MISS');
          showJudgment3DRef.current('MISS', '#f43f5e');
          st.missesLeft -= 1;
          setMissesLeft(st.missesLeft);
          stage.triggerTrauma(0.35);
          if (st.missesLeft <= 0) {
            audioController.playGameOver();
            triggerGameOver(scoreRef.current);
            return;
          }
          audioController.playHit();
        }
      }
    });

    return () => {
      notePool.releaseAll();
      notePoolRef.current = null;
      stage.dispose();
      stageRef.current = null;
    };
  }, [scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[260px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-purple-500/20 touch-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3.5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-2.5 sm:px-3.5 py-2 text-[11px] sm:text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-purple-400">
            <Music className="w-3.5 h-3.5" /> {judgment}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
          {combo > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-semibold">{combo}x</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/85 px-2.5 sm:px-3.5 py-2 text-[11px] sm:text-xs font-semibold text-rose-400 tabular-nums">
          <Flame className="w-3.5 h-3.5" /> NYAWA: {missesLeft}
        </div>
      </div>

      {/* Interactive Touch / Click 4-Lane Buttons above Dock */}
      {gameState === 'playing' && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-20 sm:bottom-16 z-10 px-2.5 sm:px-4">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 max-w-md mx-auto">
            {[
              { key: 'D', lane: '1' },
              { key: 'F', lane: '2' },
              { key: 'J', lane: '3' },
              { key: 'K', lane: '4' }
            ].map((pad, idx) => (
              <button
                key={pad.key}
                type="button"
                onPointerDown={() => tapLane(idx)}
                className="min-h-[48px] rounded-xl border border-white/15 bg-slate-900/90 px-2 py-2.5 text-xs font-semibold text-white shadow-lg active:scale-95 transition-transform whitespace-nowrap"
              >
                {pad.key}
                <span className="hidden sm:inline text-slate-400"> (Lane {pad.lane})</span>
              </button>
            ))}
          </div>
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
