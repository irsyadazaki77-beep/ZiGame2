import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk/audioController';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D
} from '../../utils/threeStage';
import { Grid, Sparkles, Zap } from 'lucide-react';

const VALUE_COLORS: Record<number, { bg: string; hex: number }> = {
  2: { bg: '#1e293b', hex: 0x38bdf8 },
  4: { bg: '#0f172a', hex: 0x06b6d4 },
  8: { bg: '#3b0764', hex: 0xa855f7 },
  16: { bg: '#500724', hex: 0xec4899 },
  32: { bg: '#451a03', hex: 0xf59e0b },
  64: { bg: '#450a0a', hex: 0xef4444 },
  128: { bg: '#064e3b', hex: 0x10b981 },
  256: { bg: '#1e1b4b', hex: 0x6366f1 },
  512: { bg: '#422006', hex: 0xfacc15 },
  1024: { bg: '#14532d', hex: 0x22c55e },
  2048: { bg: '#701a75', hex: 0xf43f5e }
};

function createTileLabelTexture(renderer: THREE.WebGLRenderer, value: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const style = VALUE_COLORS[value] || { bg: '#311042', hex: 0xfacc15 };
  if (ctx) {
    ctx.fillStyle = style.bg;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = `#${style.hex.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 236, 236);

    ctx.fillStyle = '#ffffff';
    ctx.font = value >= 1000 ? 'bold 74px sans-serif' : value >= 100 ? 'bold 88px sans-serif' : 'bold 104px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), 128, 132);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export default function Neon2048Game({
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
    gameId: 'neon-2048',
    onGameOver,
    onScoreUpdate
  });

  const [maxTile, setMaxTile] = useState(2);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const gridRef = useRef<number[][]>([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]);
  const syncBoard3DRef = useRef<() => void>(() => {});

  const addRandomTile = useCallback((board: number[][]) => {
    const empty: [number, number][] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === 0) empty.push([r, c]);
      }
    }
    if (empty.length > 0) {
      const [r, c] = empty[Math.floor(Math.random() * empty.length)];
      board[r][c] = Math.random() < 0.85 ? 2 : 4;
    }
  }, []);

  const canMove = useCallback((board: number[][]) => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === 0) return true;
        if (c < 3 && board[r][c] === board[r][c + 1]) return true;
        if (r < 3 && board[r][c] === board[r + 1][c]) return true;
      }
    }
    return false;
  }, []);

  const slideBoard = useCallback(
    (dir: 'left' | 'right' | 'up' | 'down') => {
      if (gameStateRef.current !== 'playing') return;
      const b = gridRef.current.map((row) => [...row]);
      let moved = false;
      let gained = 0;

      const processLine = (line: number[]) => {
        const filtered = line.filter((v) => v !== 0);
        const merged: number[] = [];
        for (let i = 0; i < filtered.length; i++) {
          if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
            const val = filtered[i] * 2;
            merged.push(val);
            gained += val;
            i++;
          } else {
            merged.push(filtered[i]);
          }
        }
        while (merged.length < 4) merged.push(0);
        return merged;
      };

      for (let i = 0; i < 4; i++) {
        let line: number[] = [];
        if (dir === 'left') line = b[i];
        else if (dir === 'right') line = [...b[i]].reverse();
        else if (dir === 'up') line = [b[0][i], b[1][i], b[2][i], b[3][i]];
        else line = [b[3][i], b[2][i], b[1][i], b[0][i]];

        const res = processLine(line);
        if (dir === 'right' || dir === 'down') res.reverse();

        for (let j = 0; j < 4; j++) {
          const r = dir === 'left' || dir === 'right' ? i : j;
          const c = dir === 'left' || dir === 'right' ? j : i;
          if (b[r][c] !== res[j]) moved = true;
          b[r][c] = res[j];
        }
      }

      if (moved) {
        addRandomTile(b);
        gridRef.current = b;
        syncBoard3DRef.current();
        if (gained > 0) {
          addScore(gained);
          audioController.playScore();
          stageRef.current?.particles.burst(0, 0.8, 0, 20, 0xf43f5e, 6.5);
          stageRef.current?.triggerTrauma(0.2);
        } else {
          audioController.playClick();
        }

        const highest = Math.max(...b.flat());
        setMaxTile(highest);

        if (!canMove(b)) {
          stageRef.current?.triggerTrauma(0.7);
          audioController.playExplosion();
          audioController.playGameOver();
          triggerGameOver(scoreRef.current + gained);
        }
      }
    },
    [addRandomTile, addScore, canMove, scoreRef, triggerGameOver]
  );

  const handleStart = useCallback(() => {
    const fresh = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
    addRandomTile(fresh);
    addRandomTile(fresh);
    gridRef.current = fresh;
    setMaxTile(2);
    syncBoard3DRef.current();
    startWithCountdown();
  }, [addRandomTile, startWithCountdown]);

  useEffect(() => {
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') slideBoard('left');
        if (action === 'RIGHT') slideBoard('right');
        if (action === 'UP') slideBoard('up');
        if (action === 'DOWN') slideBoard('down');
      }
    });

    return () => {
      unsub();
    };
  }, [slideBoard]);

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
        backgroundColor: 0x0c050a,
        fogColor: 0x0c050a,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#f43f5e',
        gridSecondaryColor: '#170812',
        cameraPresets: {
          isometric: { position: [6.8, 9.5, 6.8], lookAt: [0, 0.3, 0], fov: 45 },
          chase: { position: [0, 7.2, 8.8], lookAt: [0, 0.3, 0], fov: 48 },
          diorama: { position: [0, 12.2, 1.2], lookAt: [0, 0, 0], fov: 45 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 4x4 3D Tabletop Base & 16 Tile Cube Meshes
    const step = 1.48;
    const baseTray = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 0.32, 6.5),
      new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        metalness: 0.8,
        roughness: 0.25,
        clearcoat: 0.85
      })
    );
    baseTray.position.y = 0.16;
    baseTray.receiveShadow = true;
    stage.scene.add(baseTray);

    const texCache = new Map<number, THREE.CanvasTexture>();
    const getTex = (val: number) => {
      let t = texCache.get(val);
      if (!t) {
        t = createTileLabelTexture(stage.renderer, val);
        texCache.set(val, t);
      }
      return t;
    };

    const cubeMeshes: THREE.Mesh[][] = [];
    const cubeGeo = new THREE.BoxGeometry(1.28, 0.65, 1.28);

    for (let r = 0; r < 4; r++) {
      const rowMeshes: THREE.Mesh[] = [];
      for (let c = 0; c < 4; c++) {
        const mat = new THREE.MeshStandardMaterial({
          roughness: 0.2,
          metalness: 0.3
        });
        const m = new THREE.Mesh(cubeGeo, mat);
        m.position.set((c - 1.5) * step, 0.65, (r - 1.5) * step);
        m.castShadow = true;
        m.visible = false;
        stage.scene.add(m);
        rowMeshes.push(m);
      }
      cubeMeshes.push(rowMeshes);
    }

    syncBoard3DRef.current = () => {
      const b = gridRef.current;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const val = b[r][c];
          const mesh = cubeMeshes[r][c];
          if (val === 0) {
            mesh.visible = false;
          } else {
            mesh.visible = true;
            const mat = mesh.material as THREE.MeshStandardMaterial;
            mat.map = getTex(val);
            mat.needsUpdate = true;
            const heightScale = 1 + Math.min(1.2, Math.log2(val) * 0.08);
            mesh.scale.set(1, heightScale, 1);
            mesh.position.y = 0.32 + 0.325 * heightScale;
          }
        }
      }
    };
    syncBoard3DRef.current();

    const swipeStart = { x: 0, y: 0, active: false };
    const onPointerDown = (e: PointerEvent) => {
      swipeStart.x = e.clientX;
      swipeStart.y = e.clientY;
      swipeStart.active = true;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!swipeStart.active) return;
      swipeStart.active = false;
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        slideBoard(dx > 0 ? 'right' : 'left');
      } else {
        slideBoard(dy > 0 ? 'down' : 'up');
      }
    };
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);

    stage.startLoop(() => {});

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerup', onPointerUp);
      texCache.forEach((t) => t.dispose());
      stage.dispose();
      stageRef.current = null;
    };
  }, [slideBoard]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-rose-500/20 select-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-rose-400">
            <Grid className="w-3.5 h-3.5" /> KUBUS TERTINGGI: {maxTile}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2 text-xs text-amber-400 font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> TARGET: 2048
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-rose-400" /> WASD / Panah: Geser & Gabungkan Kubus Angka 3D
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
        title="Neon 2048 Fusion 3D"
        description="Geser dan gabungkan kubus energi 3D bernilai sama di atas papan diorama untuk mencapai kubus 2048!"
        themeColor="rose"
      />
    </div>
  );
}
