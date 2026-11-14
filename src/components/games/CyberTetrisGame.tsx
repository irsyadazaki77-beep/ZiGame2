import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Layers, Zap, RotateCw, ArrowDownToLine } from 'lucide-react';

const COLS = 10;
const ROWS = 16;

const TETROMINOES = [
  { shape: [[1, 1, 1, 1]], color: 0x06b6d4 }, // I
  {
    shape: [
      [1, 1],
      [1, 1]
    ],
    color: 0xfacc15
  }, // O
  {
    shape: [
      [0, 1, 0],
      [1, 1, 1]
    ],
    color: 0xa855f7
  }, // T
  {
    shape: [
      [1, 0, 0],
      [1, 1, 1]
    ],
    color: 0x3b82f6
  }, // J
  {
    shape: [
      [0, 0, 1],
      [1, 1, 1]
    ],
    color: 0xf97316
  }, // L
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0]
    ],
    color: 0x22c55e
  }, // S
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1]
    ],
    color: 0xef4444
  } // Z
];

export default function CyberTetrisGame({
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
    gameId: 'cyber-tetris',
    onGameOver,
    onScoreUpdate
  });

  const [linesCleared, setLinesCleared] = useState(0);
  const [level, setLevel] = useState(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const tetrisRef = useRef({
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)) as number[][],
    piece: TETROMINOES[0].shape,
    color: TETROMINOES[0].color,
    px: 3,
    py: 0,
    dropTimer: 0,
    lines: 0,
    level: 1
  });

  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const collides = useCallback((board: number[][], shape: number[][], nx: number, ny: number) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const bx = nx + c;
        const by = ny + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx] !== 0) return true;
      }
    }
    return false;
  }, []);

  const spawnNextPiece = useCallback(() => {
    const t = tetrisRef.current;
    const pick = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
    t.piece = pick.shape.map((row) => [...row]);
    t.color = pick.color;
    t.px = Math.floor((COLS - t.piece[0].length) / 2);
    t.py = 0;
    if (collides(t.board, t.piece, t.px, t.py)) {
      stageRef.current?.triggerTrauma(0.75);
      audioController.playExplosion();
      audioController.playGameOver();
      triggerGameOver(scoreRef.current);
    }
  }, [collides, scoreRef, triggerGameOver]);

  const lockPiece = useCallback(() => {
    const t = tetrisRef.current;
    const stage = stageRef.current;
    for (let r = 0; r < t.piece.length; r++) {
      for (let c = 0; c < t.piece[r].length; c++) {
        if (t.piece[r][c]) {
          const by = t.py + r;
          const bx = t.px + c;
          if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
            t.board[by][bx] = t.color;
          }
        }
      }
    }

    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (t.board[r].every((cell) => cell !== 0)) {
        t.board.splice(r, 1);
        t.board.unshift(Array(COLS).fill(0));
        cleared += 1;
        r += 1;
      }
    }

    if (cleared > 0) {
      t.lines += cleared;
      t.level = 1 + Math.floor(t.lines / 5);
      setLinesCleared(t.lines);
      setLevel(t.level);
      const pts = [0, 100, 250, 500, 800][Math.min(4, cleared)] * t.level;
      addScore(pts);
      stage?.particles.burst(0, 4, 0, 28 * cleared, 0x22d3ee, 8.5);
      stage?.triggerTrauma(0.32);
      if (cleared >= 2) stage?.kickFov(4);
      audioController.playCombo(cleared + 1);
    } else {
      addScore(10);
      audioController.playClick();
    }

    spawnNextPiece();
  }, [addScore, spawnNextPiece]);

  const movePiece = useCallback(
    (dx: number, dy: number) => {
      if (gameStateRef.current !== 'playing') return;
      const t = tetrisRef.current;
      if (!collides(t.board, t.piece, t.px + dx, t.py + dy)) {
        t.px += dx;
        t.py += dy;
        return true;
      } else if (dy > 0) {
        lockPiece();
      }
      return false;
    },
    [collides, lockPiece]
  );

  const rotatePiece = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const t = tetrisRef.current;
    const rotated = t.piece[0].map((_, idx) => t.piece.map((row) => row[idx]).reverse());
    if (!collides(t.board, rotated, t.px, t.py)) {
      t.piece = rotated;
      audioController.playClick();
    }
  }, [collides]);

  const hardDrop = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const t = tetrisRef.current;
    while (!collides(t.board, t.piece, t.px, t.py + 1)) {
      t.py += 1;
    }
    stageRef.current?.triggerTrauma(0.2);
    lockPiece();
  }, [collides, lockPiece]);

  const handleStart = useCallback(() => {
    const pick = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
    tetrisRef.current = {
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      piece: pick.shape.map((row) => [...row]),
      color: pick.color,
      px: 3,
      py: 0,
      dropTimer: 0,
      lines: 0,
      level: 1
    };
    setLinesCleared(0);
    setLevel(1);
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') movePiece(-1, 0);
        else if (action === 'RIGHT') movePiece(1, 0);
        else if (action === 'DOWN') movePiece(0, 1);
        else if (action === 'UP') rotatePiece();
        else if (action === 'PRIMARY' || action === 'ACTION_PRIMARY') hardDrop();
      }
    });

    return () => {
      unsub();
    };
  }, [hardDrop, movePiece, rotatePiece]);

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
        backgroundColor: 0x040914,
        fogColor: 0x040914,
        fogDensity: 0.014,
        initialPreset: 'chase',
        gridPrimaryColor: '#06b6d4',
        gridSecondaryColor: '#071122',
        cameraPresets: {
          chase: { position: [0, 5.2, 13.8], lookAt: [0, 4.8, 0], fov: 50 },
          isometric: { position: [7.5, 7.8, 12.5], lookAt: [0, 4.8, 0], fov: 46 },
          diorama: { position: [0, 5.8, 15.2], lookAt: [0, 4.8, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const cellStep = 0.62;
    const towerW = COLS * cellStep;
    const towerH = ROWS * cellStep;

    // 3D Matrix Frame Pillars
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.55,
      metalness: 0.8,
      roughness: 0.2
    });
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.18, towerH + 0.4, 0.7), frameMat);
    pillarL.position.set(-towerW / 2 - 0.15, towerH / 2, 0);
    const pillarR = pillarL.clone();
    pillarR.position.x = towerW / 2 + 0.15;
    stage.scene.add(pillarL, pillarR);

    // Instanced 3D Crystal Cubes for Board + Active Piece
    const totalCells = COLS * ROWS;
    const cubeGeo = new THREE.BoxGeometry(0.56, 0.56, 0.56);
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.35,
      roughness: 0.18,
      clearcoat: 0.9
    });
    const instanced = new THREE.InstancedMesh(cubeGeo, cubeMat, totalCells);
    instanced.frustumCulled = false;
    stage.scene.add(instanced);

    const dummyMat = new THREE.Matrix4();
    const dummyCol = new THREE.Color();

    stage.startLoop((dt) => {
      const t = tetrisRef.current;

      if (gameStateRef.current === 'playing') {
        const dropInterval = Math.max(0.14, 0.68 - (t.level - 1) * 0.055);
        t.dropTimer += dt;
        if (t.dropTimer >= dropInterval) {
          t.dropTimer = 0;
          movePiece(0, 1);
        }
      }

      // Render Board + Active Piece into InstancedMesh
      let idx = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          let cellColor = t.board[r][c];
          const pr = r - t.py;
          const pc = c - t.px;
          if (
            pr >= 0 &&
            pr < t.piece.length &&
            pc >= 0 &&
            pc < t.piece[pr].length &&
            t.piece[pr][pc]
          ) {
            cellColor = t.color;
          }

          if (cellColor !== 0) {
            const wx = (c - (COLS - 1) / 2) * cellStep;
            const wy = (ROWS - 1 - r) * cellStep + 0.32;
            dummyMat.makeScale(1, 1, 1);
            dummyMat.setPosition(wx, wy, 0);
            instanced.setMatrixAt(idx, dummyMat);
            dummyCol.setHex(cellColor);
            instanced.setColorAt(idx, dummyCol);
          } else {
            dummyMat.makeScale(0, 0, 0);
            dummyMat.setPosition(0, -999, 0);
            instanced.setMatrixAt(idx, dummyMat);
          }
          idx++;
        }
      }
      instanced.instanceMatrix.needsUpdate = true;
      if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [movePiece]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-cyan-500/20 touch-none select-none">
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full touch-none"
        onPointerDown={(e) => {
          swipeStartRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if (!swipeStartRef.current) return;
          const dx = e.clientX - swipeStartRef.current.x;
          const dy = e.clientY - swipeStartRef.current.y;
          swipeStartRef.current = null;
          if (Math.abs(dx) < 16 && Math.abs(dy) < 16) {
            rotatePiece();
          } else if (Math.abs(dx) > Math.abs(dy)) {
            if (dx < -22) movePiece(-1, 0);
            else if (dx > 22) movePiece(1, 0);
          } else if (dy > 48) {
            hardDrop();
          } else if (dy > 20) {
            movePiece(0, 1);
          }
        }}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-cyan-400">
            <Layers className="w-3.5 h-3.5" /> LEVEL {level} · BARIS: {linesCleared}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>
      </div>

      {gameState === 'playing' && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-24 z-10 flex items-center justify-between gap-1.5 sm:hidden pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              movePiece(-1, 0);
            }}
            className="min-h-[44px] flex-1 rounded-xl border border-cyan-500/35 bg-slate-950/90 text-xs font-bold text-white active:bg-cyan-500 active:text-slate-950"
            aria-label="Geser Kiri"
          >
            ◀
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              rotatePiece();
            }}
            className="min-h-[44px] flex-1 rounded-xl border border-cyan-500/35 bg-slate-950/90 text-xs font-bold text-cyan-300 flex items-center justify-center active:bg-cyan-500 active:text-slate-950"
            aria-label="Putar Balok"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              movePiece(0, 1);
            }}
            className="min-h-[44px] flex-1 rounded-xl border border-cyan-500/35 bg-slate-950/90 text-xs font-bold text-white active:bg-cyan-500 active:text-slate-950"
            aria-label="Turun"
          >
            ▼
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              movePiece(1, 0);
            }}
            className="min-h-[44px] flex-1 rounded-xl border border-cyan-500/35 bg-slate-950/90 text-xs font-bold text-white active:bg-cyan-500 active:text-slate-950"
            aria-label="Geser Kanan"
          >
            ▶
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              hardDrop();
            }}
            className="min-h-[44px] px-3.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold flex items-center gap-1 active:bg-cyan-400 whitespace-nowrap"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" /> Drop
          </button>
        </div>
      )}

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-cyan-400" /> A/D: Geser · W/Up: Putar · Space: Hard Drop 3D
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
        title="Cyber Tetris Pulse 3D"
        description="Susun balok kristal Tetrimino 3D di menara matriks kaca dan ledakkan baris penuh!"
        themeColor="cyan"
      />
    </div>
  );
}
