import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Gem, Timer, Zap } from 'lucide-react';

const GRID_N = 6;
const GEM_COLORS = [0xec4899, 0x06b6d4, 0xfacc15, 0x22c55e, 0xa855f7];

interface GemCell3D {
  r: number;
  c: number;
  type: number;
  mesh: THREE.Mesh;
}

export default function BlockMatchGame({
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
    gameId: 'block-match',
    onGameOver,
    onScoreUpdate
  });

  const [movesLeft, setMovesLeft] = useState(20);
  const [combo, setCombo] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const matchStateRef = useRef({
    moves: 20,
    combo: 0,
    selected: null as { r: number; c: number } | null
  });

  const cellsRef = useRef<GemCell3D[][]>([]);
  const syncCellAppearanceRef = useRef<() => void>(() => {});

  const handleStart = useCallback(() => {
    matchStateRef.current = { moves: 20, combo: 0, selected: null };
    setMovesLeft(20);
    setCombo(0);
    for (let r = 0; r < GRID_N; r++) {
      for (let c = 0; c < GRID_N; c++) {
        if (cellsRef.current[r]?.[c]) {
          cellsRef.current[r][c].type = Math.floor(Math.random() * GEM_COLORS.length);
        }
      }
    }
    syncCellAppearanceRef.current();
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
        backgroundColor: 0x0c0512,
        fogColor: 0x0c0512,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#ec4899',
        gridSecondaryColor: '#160820',
        cameraPresets: {
          isometric: { position: [7.5, 10.5, 7.5], lookAt: [0, 0.3, 0], fov: 45 },
          chase: { position: [0, 7.8, 9.5], lookAt: [0, 0.3, 0], fov: 48 },
          diorama: { position: [0, 13.5, 1.4], lookAt: [0, 0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const step = 1.15;
    const gemGeos = [
      new THREE.OctahedronGeometry(0.46, 0),
      new THREE.DodecahedronGeometry(0.44, 0),
      new THREE.IcosahedronGeometry(0.45, 0),
      new THREE.BoxGeometry(0.66, 0.66, 0.66),
      new THREE.ConeGeometry(0.45, 0.78, 6)
    ];

    const grid: GemCell3D[][] = [];
    const allMeshes: THREE.Mesh[] = [];

    for (let r = 0; r < GRID_N; r++) {
      const row: GemCell3D[] = [];
      for (let c = 0; c < GRID_N; c++) {
        const t = Math.floor(Math.random() * GEM_COLORS.length);
        const mat = new THREE.MeshPhysicalMaterial({
          color: GEM_COLORS[t],
          emissive: GEM_COLORS[t],
          emissiveIntensity: 0.4,
          roughness: 0.15,
          metalness: 0.25,
          clearcoat: 0.95
        });
        const mesh = new THREE.Mesh(gemGeos[t], mat);
        mesh.position.set((c - (GRID_N - 1) / 2) * step, 0.55, (r - (GRID_N - 1) / 2) * step);
        mesh.castShadow = true;
        stage.scene.add(mesh);

        const cell: GemCell3D = { r, c, type: t, mesh };
        mesh.userData.cell = cell;
        row.push(cell);
        allMeshes.push(mesh);
      }
      grid.push(row);
    }
    cellsRef.current = grid;

    syncCellAppearanceRef.current = () => {
      const sel = matchStateRef.current.selected;
      for (let r = 0; r < GRID_N; r++) {
        for (let c = 0; c < GRID_N; c++) {
          const cell = grid[r][c];
          cell.mesh.geometry = gemGeos[cell.type];
          const mat = cell.mesh.material as THREE.MeshPhysicalMaterial;
          mat.color.setHex(GEM_COLORS[cell.type]);
          mat.emissive.setHex(GEM_COLORS[cell.type]);
          const isSel = sel && sel.r === r && sel.c === c;
          mat.emissiveIntensity = isSel ? 1.1 : 0.4;
          cell.mesh.scale.setScalar(isSel ? 1.28 : 1.0);
        }
      }
    };

    const resolveMatches = (): number => {
      const matched = Array.from({ length: GRID_N }, () => Array(GRID_N).fill(false));
      for (let r = 0; r < GRID_N; r++) {
        for (let c = 0; c < GRID_N - 2; c++) {
          const t = grid[r][c].type;
          if (grid[r][c + 1].type === t && grid[r][c + 2].type === t) {
            matched[r][c] = matched[r][c + 1] = matched[r][c + 2] = true;
          }
        }
      }
      for (let c = 0; c < GRID_N; c++) {
        for (let r = 0; r < GRID_N - 2; r++) {
          const t = grid[r][c].type;
          if (grid[r + 1][c].type === t && grid[r + 2][c].type === t) {
            matched[r][c] = matched[r + 1][c] = matched[r + 2][c] = true;
          }
        }
      }

      let count = 0;
      for (let r = 0; r < GRID_N; r++) {
        for (let c = 0; c < GRID_N; c++) {
          if (matched[r][c]) {
            count++;
            const cell = grid[r][c];
            stage.particles.burst(
              cell.mesh.position.x,
              0.6,
              cell.mesh.position.z,
              10,
              GEM_COLORS[cell.type],
              6.5
            );
            cell.type = Math.floor(Math.random() * GEM_COLORS.length);
          }
        }
      }
      return count;
    };

    const onSelectCell = (cell: GemCell3D) => {
      if (gameStateRef.current !== 'playing') return;
      const st = matchStateRef.current;
      if (!st.selected) {
        st.selected = { r: cell.r, c: cell.c };
        audioController.playClick();
        syncCellAppearanceRef.current();
        return;
      }

      const prev = grid[st.selected.r][st.selected.c];
      const dist = Math.abs(prev.r - cell.r) + Math.abs(prev.c - cell.c);
      if (dist === 1) {
        const tmp = prev.type;
        prev.type = cell.type;
        cell.type = tmp;
        st.selected = null;

        let totalCleared = resolveMatches();
        if (totalCleared === 0) {
          totalCleared = 3;
          stage.particles.burst(
            cell.mesh.position.x,
            0.6,
            cell.mesh.position.z,
            18,
            GEM_COLORS[cell.type],
            7
          );
          cell.type = Math.floor(Math.random() * GEM_COLORS.length);
          prev.type = Math.floor(Math.random() * GEM_COLORS.length);
        }

        st.moves -= 1;
        st.combo += 1;
        setMovesLeft(st.moves);
        setCombo(st.combo);
        addScore(totalCleared * 20);
        audioController.playCombo(st.combo);
        stage.triggerTrauma(0.22);
        syncCellAppearanceRef.current();

        if (st.moves <= 0) {
          audioController.playGameOver();
          triggerGameOver(scoreRef.current + totalCleared * 20);
        }
      } else {
        st.selected = { r: cell.r, c: cell.c };
        audioController.playClick();
        syncCellAppearanceRef.current();
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
        const hitCell = hits[0].object.userData.cell as GemCell3D | undefined;
        if (hitCell) onSelectCell(hitCell);
      }
    };

    container.addEventListener('pointerdown', onPointerDown);

    stage.startLoop((dt, elapsed) => {
      for (const m of allMeshes) {
        m.rotation.y += dt * 1.6;
        m.position.y = 0.55 + Math.sin(elapsed * 3 + m.position.x) * 0.06;
      }
    });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-pink-500/20 touch-none select-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-pink-400">
            <Gem className="w-3.5 h-3.5" /> SKOR: {score}
          </span>
          {combo > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-semibold">{combo}x CHAIN</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-cyan-400 tabular-nums">
          <Timer className="w-3.5 h-3.5" /> LANGKAH: {movesLeft}
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-pink-400" /> Ketuk 2 Kristal Geometri 3D Berdampingan untuk Menukar
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
        title="Neon Block Match-3 3D"
        description="Tukar dan cocokkan permata kristal polihedral 3D untuk memicu ledakan berantai!"
        themeColor="pink"
      />
    </div>
  );
}
