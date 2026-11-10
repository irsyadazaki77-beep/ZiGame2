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
import { Hexagon, Swords, Trophy } from 'lucide-react';

type HexOwner = 'neutral' | 'player' | 'ai';

interface HexTile3D {
  id: number;
  q: number;
  r: number;
  owner: HexOwner;
  power: number;
  x: number;
  z: number;
  baseMesh: THREE.Mesh;
  unitMesh: THREE.Mesh;
}

const OWNER_COLORS: Record<HexOwner, number> = {
  neutral: 0x334155,
  player: 0x6366f1,
  ai: 0xef4444
};

export default function HexDominionGame({
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
    gameId: 'hex-dominion',
    onGameOver,
    onScoreUpdate
  });

  const [turnCount, setTurnCount] = useState(1);
  const [playerHexes, setPlayerHexes] = useState(3);
  const [aiHexes, setAiHexes] = useState(3);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const tilesRef = useRef<HexTile3D[]>([]);
  const resetBoardRef = useRef<() => void>(() => {});

  const syncTileVisuals = useCallback((tile: HexTile3D) => {
    const mat = tile.baseMesh.material as THREE.MeshStandardMaterial;
    mat.color.setHex(OWNER_COLORS[tile.owner]);
    mat.emissive.setHex(tile.owner === 'neutral' ? 0x0f172a : OWNER_COLORS[tile.owner]);
    mat.emissiveIntensity = tile.owner === 'neutral' ? 0.15 : 0.45;

    tile.unitMesh.visible = tile.owner !== 'neutral';
    const uMat = tile.unitMesh.material as THREE.MeshStandardMaterial;
    uMat.color.setHex(tile.owner === 'player' ? 0x38bdf8 : 0xfb7185);
    const scale = 0.65 + Math.min(1.2, tile.power * 0.18);
    tile.unitMesh.scale.set(scale, scale, scale);
  }, []);

  const executeTileCommand = useCallback(
    (targetTile: HexTile3D) => {
      if (gameStateRef.current !== 'playing') return;
      const stage = stageRef.current;
      const tiles = tilesRef.current;

      // Player action: Reinforce owned tile or capture adjacent neutral/enemy tile
      if (targetTile.owner === 'player') {
        targetTile.power += 2;
        addScore(20);
      } else {
        targetTile.owner = 'player';
        targetTile.power = Math.max(2, targetTile.power);
        addScore(45);
      }
      syncTileVisuals(targetTile);
      audio.playCoin?.();
      stage?.particles.burst(targetTile.x, 0.85, targetTile.z, 20, 0x6366f1, 6.5);

      // AI Counter-Move
      const aiCandidates = tiles.filter((t) => t.owner !== 'ai');
      if (aiCandidates.length > 0) {
        const aiPick = aiCandidates[Math.floor(Math.random() * aiCandidates.length)];
        if (aiPick.owner === 'player' && aiPick.power > 2) {
          aiPick.power -= 1;
        } else {
          aiPick.owner = 'ai';
          aiPick.power = 2;
        }
        syncTileVisuals(aiPick);
        stage?.particles.burst(aiPick.x, 0.85, aiPick.z, 14, 0xef4444, 5.5);
      }

      const pCount = tiles.filter((t) => t.owner === 'player').length;
      const aCount = tiles.filter((t) => t.owner === 'ai').length;
      setPlayerHexes(pCount);
      setAiHexes(aCount);
      setTurnCount((c) => c + 1);

      if (pCount === 0 || aCount === 0 || tiles.every((t) => t.owner !== 'neutral')) {
        if (pCount >= aCount) {
          addScore(200);
          stage?.kickFov(5);
          resetBoardRef.current();
        } else {
          triggerGameOver(scoreRef.current);
        }
      }
    },
    [addScore, scoreRef, syncTileVisuals, triggerGameOver]
  );

  const handleStart = useCallback(() => {
    setTurnCount(1);
    resetBoardRef.current();
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
        backgroundColor: 0x060916,
        fogColor: 0x060916,
        fogDensity: 0.015,
        initialPreset: 'isometric',
        gridPrimaryColor: '#6366f1',
        gridSecondaryColor: '#080d1e',
        cameraPresets: {
          isometric: { position: [9.5, 13.5, 9.5], lookAt: [0, 0.3, 0], fov: 45 },
          chase: { position: [0, 9.5, 12.5], lookAt: [0, 0.3, 0], fov: 50 },
          diorama: { position: [0, 17.5, 1.8], lookAt: [0, 0, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 19-Tile 3D Hexagonal Archipelago (Radius 2 axial hex grid)
    const hexRadius = 1.25;
    const hexGeo = new THREE.CylinderGeometry(hexRadius * 0.92, hexRadius * 0.98, 0.55, 6);
    const unitGeo = new THREE.OctahedronGeometry(0.42, 0);
    const createdTiles: HexTile3D[] = [];
    let idCounter = 0;

    for (let q = -2; q <= 2; q++) {
      const r1 = Math.max(-2, -q - 2);
      const r2 = Math.min(2, -q + 2);
      for (let r = r1; r <= r2; r++) {
        const x = hexRadius * 1.75 * (q + r / 2);
        const z = hexRadius * 1.52 * r;
        const baseMat = new THREE.MeshStandardMaterial({
          color: OWNER_COLORS.neutral,
          roughness: 0.35,
          metalness: 0.65
        });
        const baseMesh = new THREE.Mesh(hexGeo, baseMat);
        baseMesh.position.set(x, 0.28, z);
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        stage.scene.add(baseMesh);

        const unitMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.6,
          roughness: 0.2
        });
        const unitMesh = new THREE.Mesh(unitGeo, unitMat);
        unitMesh.position.set(x, 0.95, z);
        stage.scene.add(unitMesh);

        const tile: HexTile3D = {
          id: idCounter++,
          q,
          r,
          owner: 'neutral',
          power: 1,
          x,
          z,
          baseMesh,
          unitMesh
        };
        baseMesh.userData.tile = tile;
        unitMesh.userData.tile = tile;
        createdTiles.push(tile);
      }
    }
    tilesRef.current = createdTiles;

    resetBoardRef.current = () => {
      createdTiles.forEach((t, idx) => {
        if (idx < 3) {
          t.owner = 'player';
          t.power = 2;
        } else if (idx >= createdTiles.length - 3) {
          t.owner = 'ai';
          t.power = 2;
        } else {
          t.owner = 'neutral';
          t.power = 1;
        }
        syncTileVisuals(t);
      });
      setPlayerHexes(3);
      setAiHexes(3);
    };
    resetBoardRef.current();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const meshes = createdTiles.map((t) => t.baseMesh);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const hitTile = hits[0].object.userData.tile as HexTile3D | undefined;
        if (hitTile) {
          executeTileCommand(hitTile);
        }
      }
    };

    container.addEventListener('pointerdown', onPointerDown);

    stage.startLoop((dt, elapsed) => {
      for (const t of createdTiles) {
        if (t.unitMesh.visible) {
          t.unitMesh.rotation.y = elapsed * 2.2 + t.id;
          t.unitMesh.position.y = 0.95 + Math.sin(elapsed * 3.5 + t.id) * 0.1;
        }
      }
    });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      stage.dispose();
      stageRef.current = null;
    };
  }, [executeTileCommand, syncTileVisuals]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-indigo-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-indigo-400">
            <Hexagon className="w-3.5 h-3.5" /> GILIRAN {turnCount}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="text-indigo-400 font-semibold">ANDA: {playerHexes} HEX</span>
          <span aria-hidden="true">·</span>
          <span className="text-rose-400 font-semibold">AI: {aiHexes} HEX</span>
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Swords className="w-3 h-3 text-indigo-400" /> Klik Petak Heksagonal 3D untuk Menguasai Wilayah
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
        title="Hex Dominion 3D"
        description="Kuasai kepulauan heksagonal 3D! Klik petak heksagon untuk mengerahkan unit siber dan mengalahkan komandan AI."
        themeColor="indigo"
      />
    </div>
  );
}
