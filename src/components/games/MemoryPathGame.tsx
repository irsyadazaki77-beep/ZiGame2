import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk/audioController';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Footprints, Eye, Zap } from 'lucide-react';

const BRIDGE_ROWS = 5;
const BRIDGE_COLS = 4;

interface BridgeTile3D {
  r: number;
  c: number;
  mesh: THREE.Mesh;
}

export default function MemoryPathGame({
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
    gameId: 'memory-path',
    onGameOver,
    onScoreUpdate
  });

  const [phaseLabel, setPhaseLabel] = useState('HAFALKAN JALUR');
  const [round, setRound] = useState(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const lastPhaseRef = useRef('HAFALKAN JALUR');
  const setPhaseLabelSafe = useCallback((label: string) => {
    if (lastPhaseRef.current !== label) {
      lastPhaseRef.current = label;
      setPhaseLabel(label);
    }
  }, []);

  const pathStateRef = useRef({
    safeCols: [1, 2, 1, 2, 1] as number[],
    currentRow: 0,
    previewTimer: 2.2,
    round: 1
  });

  const generateBridgeRef = useRef<() => void>(() => {});

  const handleStart = useCallback(() => {
    pathStateRef.current.round = 1;
    setRound(1);
    generateBridgeRef.current();
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
        backgroundColor: 0x040916,
        fogColor: 0x040916,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#3b82f6',
        gridSecondaryColor: '#071024',
        cameraPresets: {
          isometric: { position: [7.5, 10.5, 7.5], lookAt: [0, 0.3, 0], fov: 45 },
          chase: { position: [0, 7.5, 9.5], lookAt: [0, 0.3, 0], fov: 48 },
          diorama: { position: [0, 13.5, 1.4], lookAt: [0, 0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const step = 1.45;
    const tileGeo = new THREE.BoxGeometry(1.22, 0.25, 1.22);
    const tiles: BridgeTile3D[][] = [];
    const allMeshes: THREE.Mesh[] = [];

    for (let r = 0; r < BRIDGE_ROWS; r++) {
      const row: BridgeTile3D[] = [];
      for (let c = 0; c < BRIDGE_COLS; c++) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0x1e293b,
          emissive: 0x0f172a,
          emissiveIntensity: 0.3,
          metalness: 0.65,
          roughness: 0.2,
          clearcoat: 0.9
        });
        const wx = (c - (BRIDGE_COLS - 1) / 2) * step;
        const wz = (BRIDGE_ROWS - 1 - r - (BRIDGE_ROWS - 1) / 2) * step;
        const mesh = new THREE.Mesh(tileGeo, mat);
        mesh.position.set(wx, 0.35, wz);
        mesh.castShadow = true;
        stage.scene.add(mesh);

        const tile: BridgeTile3D = { r, c, mesh };
        mesh.userData.tile = tile;
        row.push(tile);
        allMeshes.push(mesh);
      }
      tiles.push(row);
    }

    const syncBridgeVisuals = (showPreview: boolean) => {
      const st = pathStateRef.current;
      for (let r = 0; r < BRIDGE_ROWS; r++) {
        for (let c = 0; c < BRIDGE_COLS; c++) {
          const mat = tiles[r][c].mesh.material as THREE.MeshPhysicalMaterial;
          const isSafe = st.safeCols[r] === c;
          const isStepped = r < st.currentRow && isSafe;
          if ((showPreview && isSafe) || isStepped) {
            mat.color.setHex(0x38bdf8);
            mat.emissive.setHex(0x06b6d4);
            mat.emissiveIntensity = 0.9;
          } else {
            mat.color.setHex(0x1e293b);
            mat.emissive.setHex(0x0f172a);
            mat.emissiveIntensity = 0.25;
          }
        }
      }
    };

    generateBridgeRef.current = () => {
      const safe: number[] = [];
      let col = Math.floor(Math.random() * BRIDGE_COLS);
      for (let r = 0; r < BRIDGE_ROWS; r++) {
        safe.push(col);
        const shift = Math.floor(Math.random() * 3) - 1;
        col = Math.max(0, Math.min(BRIDGE_COLS - 1, col + shift));
      }
      pathStateRef.current.safeCols = safe;
      pathStateRef.current.currentRow = 0;
      pathStateRef.current.previewTimer = Math.max(1.1, 2.2 - pathStateRef.current.round * 0.15);
      setPhaseLabelSafe('HAFALKAN JALUR 3D');
      syncBridgeVisuals(true);
    };
    generateBridgeRef.current();

    const stepOnTile = (tile: BridgeTile3D) => {
      if (gameStateRef.current !== 'playing') return;
      const st = pathStateRef.current;
      if (st.previewTimer > 0) return; // Wait for memorization phase to finish
      if (tile.r !== st.currentRow) return;

      if (st.safeCols[tile.r] === tile.c) {
        st.currentRow += 1;
        addScore(30 * st.round);
        audioController.playScore();
        stage.particles.burst(
          tile.mesh.position.x,
          0.55,
          tile.mesh.position.z,
          18,
          0x38bdf8,
          6.5
        );
        syncBridgeVisuals(false);

        if (st.currentRow >= BRIDGE_ROWS) {
          addScore(100);
          st.round += 1;
          setRound(st.round);
          audioController.playLevelUp();
          stage.kickFov(4.5);
          generateBridgeRef.current();
        }
      } else {
        const mat = tile.mesh.material as THREE.MeshPhysicalMaterial;
        mat.color.setHex(0xef4444);
        mat.emissive.setHex(0xef4444);
        stage.particles.burst(
          tile.mesh.position.x,
          0.55,
          tile.mesh.position.z,
          36,
          0xef4444,
          9.5
        );
        stage.triggerTrauma(0.75);
        audioController.playExplosion();
        audioController.playGameOver();
        triggerGameOver(scoreRef.current);
      }
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const hits = raycaster.intersectObjects(allMeshes, false);
      if (hits.length > 0) {
        const hitTile = hits[0].object.userData.tile as BridgeTile3D | undefined;
        if (hitTile) stepOnTile(hitTile);
      }
    };

    container.addEventListener('pointerdown', onPointerDown);

    stage.startLoop((dt) => {
      if (gameStateRef.current !== 'playing') return;
      const st = pathStateRef.current;
      if (st.previewTimer > 0) {
        st.previewTimer -= dt;
        if (st.previewTimer <= 0) {
          setPhaseLabelSafe(`LANGKAH BARIS ${st.currentRow + 1} / ${BRIDGE_ROWS}`);
          syncBridgeVisuals(false);
        }
      } else {
        setPhaseLabelSafe(`LANGKAH BARIS ${st.currentRow + 1} / ${BRIDGE_ROWS}`);
      }
    });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, setPhaseLabelSafe, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-blue-500/20 select-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-blue-400">
            <Footprints className="w-3.5 h-3.5" /> RONDE {round}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs font-semibold text-cyan-400">
          <Eye className="w-3.5 h-3.5" /> {phaseLabel}
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-blue-400" /> Hafalkan Petak Biru yang Menyala Lalu Klik Berurutan dari Bawah ke Atas
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
        title="Matrix Memory Path 3D"
        description="Hafalkan jalur petak jembatan kaca 3D yang aman dan seberangi jurang siber tanpa menginjak jebakan!"
        themeColor="blue"
      />
    </div>
  );
}
