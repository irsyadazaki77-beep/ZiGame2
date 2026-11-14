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
import { Bomb, Flag, ShieldCheck, Zap } from 'lucide-react';

const GRID_SIZE = 6;
const MINE_COUNT = 6;

interface MineCell3D {
  r: number;
  c: number;
  isMine: boolean;
  revealed: boolean;
  flagged: boolean;
  neighborMines: number;
  tileMesh: THREE.Mesh;
  flagMesh: THREE.Mesh;
}

function createMineNumTexture(renderer: THREE.WebGLRenderer, count: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const colors = ['#0f172a', '#38bdf8', '#22c55e', '#f59e0b', '#ec4899', '#ef4444', '#a855f7'];
  if (ctx) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 120, 120);
    if (count > 0) {
      ctx.fillStyle = colors[count] || '#ffffff';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), 64, 68);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export default function CyberMinesGame({
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
    gameId: 'cyber-mines',
    onGameOver,
    onScoreUpdate
  });

  const [flagMode, setFlagMode] = useState(false);
  const [safeRemaining, setSafeRemaining] = useState(GRID_SIZE * GRID_SIZE - MINE_COUNT);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const flagModeRef = useRef(false);
  useEffect(() => {
    flagModeRef.current = flagMode;
  }, [flagMode]);

  const resetGridFnRef = useRef<() => void>(() => {});

  const handleStart = useCallback(() => {
    resetGridFnRef.current();
    setSafeRemaining(GRID_SIZE * GRID_SIZE - MINE_COUNT);
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
        backgroundColor: 0x0b0804,
        fogColor: 0x0b0804,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#f59e0b',
        gridSecondaryColor: '#161006',
        cameraPresets: {
          isometric: { position: [7.5, 10.8, 7.5], lookAt: [0, 0.2, 0], fov: 45 },
          chase: { position: [0, 8.2, 9.5], lookAt: [0, 0.2, 0], fov: 48 },
          diorama: { position: [0, 13.5, 1.4], lookAt: [0, 0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const step = 1.15;
    const tileGeo = new THREE.BoxGeometry(1.02, 0.36, 1.02);
    const flagGeo = new THREE.ConeGeometry(0.24, 0.65, 6);
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.85
    });

    const numTextures = Array.from({ length: 7 }, (_, i) => createMineNumTexture(stage.renderer, i));

    const grid: MineCell3D[][] = [];
    const tileMeshes: THREE.Mesh[] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      const row: MineCell3D[] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: 0x334155,
          metalness: 0.75,
          roughness: 0.25,
          clearcoat: 0.8
        });
        const wx = (c - (GRID_SIZE - 1) / 2) * step;
        const wz = (r - (GRID_SIZE - 1) / 2) * step;
        const tileMesh = new THREE.Mesh(tileGeo, mat);
        tileMesh.position.set(wx, 0.18, wz);
        tileMesh.castShadow = true;
        stage.scene.add(tileMesh);

        const flagMesh = new THREE.Mesh(flagGeo, flagMat);
        flagMesh.position.set(wx, 0.65, wz);
        flagMesh.visible = false;
        stage.scene.add(flagMesh);

        const cell: MineCell3D = {
          r,
          c,
          isMine: false,
          revealed: false,
          flagged: false,
          neighborMines: 0,
          tileMesh,
          flagMesh
        };
        tileMesh.userData.cell = cell;
        row.push(cell);
        tileMeshes.push(tileMesh);
      }
      grid.push(row);
    }

    resetGridFnRef.current = () => {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = grid[r][c];
          cell.isMine = false;
          cell.revealed = false;
          cell.flagged = false;
          cell.neighborMines = 0;
          cell.flagMesh.visible = false;
          cell.tileMesh.position.y = 0.18;
          const mat = cell.tileMesh.material as THREE.MeshPhysicalMaterial;
          mat.map = null;
          mat.color.setHex(0x334155);
          mat.needsUpdate = true;
        }
      }

      let placed = 0;
      while (placed < MINE_COUNT) {
        const mr = Math.floor(Math.random() * GRID_SIZE);
        const mc = Math.floor(Math.random() * GRID_SIZE);
        if (!grid[mr][mc].isMine) {
          grid[mr][mc].isMine = true;
          placed++;
        }
      }

      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          let count = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && grid[nr][nc].isMine) {
                count++;
              }
            }
          }
          grid[r][c].neighborMines = count;
        }
      }
    };
    resetGridFnRef.current();

    const revealCell = (cell: MineCell3D) => {
      if (cell.revealed || cell.flagged) return;
      cell.revealed = true;
      cell.tileMesh.position.y = 0.06;
      const mat = cell.tileMesh.material as THREE.MeshPhysicalMaterial;

      if (cell.isMine) {
        mat.color.setHex(0xef4444);
        stage.particles.burst(
          cell.tileMesh.position.x,
          0.5,
          cell.tileMesh.position.z,
          38,
          0xef4444,
          10
        );
        stage.triggerTrauma(0.8);
        audioController.playExplosion();
        audioController.playGameOver();
        triggerGameOver(scoreRef.current);
        return;
      }

      mat.color.setHex(0xffffff);
      mat.map = numTextures[Math.min(6, cell.neighborMines)];
      mat.needsUpdate = true;
      addScore(25);
      stage.particles.burst(
        cell.tileMesh.position.x,
        0.35,
        cell.tileMesh.position.z,
        8,
        0x38bdf8,
        4.5
      );

      if (cell.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = cell.r + dr;
            const nc = cell.c + dc;
            if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
              revealCell(grid[nr][nc]);
            }
          }
        }
      }

      const unrevealedSafe = grid
        .flat()
        .filter((c) => !c.isMine && !c.revealed).length;
      setSafeRemaining(unrevealedSafe);

      if (unrevealedSafe === 0) {
        addScore(250);
        audioController.playWin();
        audioController.playLevelUp();
        stage.kickFov(5);
        resetGridFnRef.current();
        setSafeRemaining(GRID_SIZE * GRID_SIZE - MINE_COUNT);
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
      const hits = raycaster.intersectObjects(tileMeshes, false);
      if (hits.length > 0) {
        const cell = hits[0].object.userData.cell as MineCell3D | undefined;
        if (!cell) return;
        if (e.button === 2 || flagModeRef.current) {
          if (!cell.revealed) {
            cell.flagged = !cell.flagged;
            cell.flagMesh.visible = cell.flagged;
            audioController.playClick();
          }
        } else {
          audioController.playScore();
          revealCell(cell);
        }
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('contextmenu', onContextMenu);

    stage.startLoop(() => {});

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('contextmenu', onContextMenu);
      numTextures.forEach((t) => t.dispose());
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-amber-500/20 touch-none select-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-amber-400">
            <ShieldCheck className="w-3.5 h-3.5" /> PETAK AMAN: {safeRemaining}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <button
          type="button"
          onClick={() => setFlagMode((f) => !f)}
          className={`pointer-events-auto min-h-[44px] flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            flagMode
              ? 'bg-amber-500 text-slate-950'
              : 'border border-white/15 bg-slate-900/90 text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Flag className="w-3.5 h-3.5" /> Mode: {flagMode ? 'Pasang Bendera 3D' : 'Buka Petak 3D'}
        </button>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Bomb className="w-3 h-3 text-amber-400" /> Klik Kiri: Buka Petak 3D · Klik Kanan / Mode Bendera: Tandai Ranjau EMP
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
        title="Cyber Minesweeper 3D"
        description="Buka petak brankas taktis 3D secara logis dan pasang suar bendera 3D pada ranjau EMP!"
        themeColor="amber"
      />
    </div>
  );
}
