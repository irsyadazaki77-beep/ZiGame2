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
  QualityLevel3D,
  buildCyberActionHero3D
} from '../../utils/threeStage';
import { disposeObject3D } from '../../utils/threeCleanup';
import { ShieldAlert, Terminal, KeyRound } from 'lucide-react';

interface Guard3D {
  group: THREE.Group;
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  patrolMinX: number;
  patrolMaxX: number;
  speed: number;
}

interface DataTerminal3D {
  mesh: THREE.Group;
  x: number;
  z: number;
  hacked: boolean;
}

function buildSecurityGuard3D(): THREE.Group {
  const g = new THREE.Group();
  const guardHero = buildCyberActionHero3D(0xef4444, 0xfef08a);
  g.add(guardHero.group);

  // Volumetric 3D Vision Cone projecting forward (+Z in local guard space)
  const coneGeo = new THREE.ConeGeometry(1.65, 4.2, 16, 1, true);
  coneGeo.translate(0, -2.1, 0);
  coneGeo.rotateX(-Math.PI / 2);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const visionCone = new THREE.Mesh(coneGeo, coneMat);
  visionCone.position.set(0, 0.65, 0.2);
  g.add(visionCone);

  return g;
}

function buildTerminalMesh3D(): THREE.Group {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.3
  });
  const holoMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.9,
    roughness: 0.15
  });
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.75), baseMat);
  pedestal.position.y = 0.425;
  pedestal.castShadow = true;
  const holoCube = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), holoMat);
  holoCube.position.y = 1.25;
  g.add(pedestal, holoCube);
  return g;
}

export default function NeonHeistGame({
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
    gameId: 'neon-heist',
    onGameOver,
    onScoreUpdate
  });

  const [floorLevel, setFloorLevel] = useState(1);
  const [hackedCount, setHackedCount] = useState(0);
  const [totalTerminals, setTotalTerminals] = useState(3);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const heistRef = useRef({
    x: 0,
    z: 6.5,
    floor: 1,
    hacked: 0,
    required: 3,
    speed: 6.8
  });

  const dirsRef = useRef({ left: false, right: false, up: false, down: false });
  const dragMoveRef = useRef({ active: false, startX: 0, startY: 0, mx: 0, mz: 0 });
  const guardsRef = useRef<Guard3D[]>([]);
  const terminalsRef = useRef<DataTerminal3D[]>([]);
  const buildFloorRef = useRef<(fl: number) => void>(() => {});

  const handleStart = useCallback(() => {
    heistRef.current = {
      x: 0,
      z: 6.5,
      floor: 1,
      hacked: 0,
      required: 3,
      speed: 6.8
    };
    setFloorLevel(1);
    setHackedCount(0);
    setTotalTerminals(3);
    buildFloorRef.current(1);
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
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') dirsRef.current.left = true;
        if (action === 'RIGHT') dirsRef.current.right = true;
        if (action === 'UP') dirsRef.current.up = true;
        if (action === 'DOWN') dirsRef.current.down = true;
      },
      onActionUp: (action) => {
        if (action === 'LEFT') dirsRef.current.left = false;
        if (action === 'RIGHT') dirsRef.current.right = false;
        if (action === 'UP') dirsRef.current.up = false;
        if (action === 'DOWN') dirsRef.current.down = false;
      }
    });

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x050b14,
        fogColor: 0x050b14,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#06b6d4',
        gridSecondaryColor: '#07111e',
        cameraPresets: {
          isometric: { position: [9.5, 13.5, 10.5], lookAt: [0, 0, 0], fov: 46 },
          chase: { position: [0, 8.5, 12.5], lookAt: [0, 0.5, 0], fov: 52 },
          diorama: { position: [0, 18.5, 2.0], lookAt: [0, 0, 0], fov: 48 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const agent = buildCyberActionHero3D(0x06b6d4, 0x10b981);
    agent.group.position.set(0, 0, 6.5);
    stage.scene.add(agent.group);

    // Extraction Portal Ring at North End (z = -6.8)
    const portalGroup = new THREE.Group();
    const portalMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.9
    });
    const portalRing = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.1, 10, 24), portalMat);
    portalRing.rotation.x = Math.PI / 2;
    portalRing.position.y = 0.12;
    portalGroup.add(portalRing);
    portalGroup.position.set(0, 0, -6.8);
    stage.scene.add(portalGroup);

    buildFloorRef.current = (fl: number) => {
      guardsRef.current.forEach((g) => {
        stage.scene.remove(g.group);
        disposeObject3D(g.group);
      });
      terminalsRef.current.forEach((t) => {
        stage.scene.remove(t.mesh);
        disposeObject3D(t.mesh);
      });
      guardsRef.current = [];
      terminalsRef.current = [];

      const termCoords: [number, number][] = [
        [-4.8, 2.2],
        [4.8, 0.0],
        [-3.8, -3.8]
      ];
      if (fl >= 2) termCoords.push([4.5, -4.2]);

      termCoords.forEach(([tx, tz]) => {
        const mesh = buildTerminalMesh3D();
        mesh.position.set(tx, 0, tz);
        stage.scene.add(mesh);
        terminalsRef.current.push({ mesh, x: tx, z: tz, hacked: false });
      });

      const guardCount = Math.min(4, 2 + Math.floor(fl / 2));
      for (let i = 0; i < guardCount; i++) {
        const gz = 2.5 - i * 3.2;
        const gMesh = buildSecurityGuard3D();
        const startX = i % 2 === 0 ? -4.5 : 4.5;
        gMesh.position.set(startX, 0, gz);
        stage.scene.add(gMesh);
        guardsRef.current.push({
          group: gMesh,
          x: startX,
          z: gz,
          dirX: i % 2 === 0 ? 1 : -1,
          dirZ: 0,
          patrolMinX: -5.5,
          patrolMaxX: 5.5,
          speed: 2.8 + fl * 0.35
        });
      }

      heistRef.current.x = 0;
      heistRef.current.z = 6.5;
      heistRef.current.hacked = 0;
      heistRef.current.required = termCoords.length;
      setHackedCount(0);
      setTotalTerminals(termCoords.length);
    };

    buildFloorRef.current(1);

    const onPointerDown = (e: PointerEvent) => {
      dragMoveRef.current = { active: true, startX: e.clientX, startY: e.clientY, mx: 0, mz: 0 };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragMoveRef.current.active) return;
      const dx = e.clientX - dragMoveRef.current.startX;
      const dy = e.clientY - dragMoveRef.current.startY;
      if (Math.hypot(dx, dy) > 10) {
        dragMoveRef.current.mx = THREE.MathUtils.clamp(dx / 36, -1, 1);
        dragMoveRef.current.mz = THREE.MathUtils.clamp(dy / 36, -1, 1);
      }
    };
    const onPointerUp = () => {
      dragMoveRef.current.active = false;
      dragMoveRef.current.mx = 0;
      dragMoveRef.current.mz = 0;
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);

    stage.startLoop((dt, elapsed) => {
      portalRing.rotation.z = elapsed * 2;
      if (gameStateRef.current !== 'playing') return;

      const hs = heistRef.current;
      const dirs = dirsRef.current;

      let mx = dragMoveRef.current.active ? dragMoveRef.current.mx : 0;
      let mz = dragMoveRef.current.active ? dragMoveRef.current.mz : 0;
      if (dirs.left) mx -= 1;
      if (dirs.right) mx += 1;
      if (dirs.up) mz -= 1;
      if (dirs.down) mz += 1;

      if (Math.hypot(mx, mz) > 0.05) {
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;
        hs.x = THREE.MathUtils.clamp(hs.x + mx * hs.speed * dt, -7.2, 7.2);
        hs.z = THREE.MathUtils.clamp(hs.z + mz * hs.speed * dt, -7.2, 7.2);
        agent.group.rotation.y = Math.atan2(mx, mz);
        const swing = Math.sin(elapsed * 14) * 0.45;
        agent.legL.rotation.x = swing;
        agent.legR.rotation.x = -swing;
      }

      agent.group.position.set(hs.x, 0, hs.z);
      stage.setFollowTarget(hs.x, 0, hs.z, 0.38);

      // Update Terminals
      for (const t of terminalsRef.current) {
        t.mesh.children[1].rotation.y += dt * 3;
        if (!t.hacked && Math.hypot(hs.x - t.x, hs.z - t.z) < 1.15) {
          t.hacked = true;
          const holo = t.mesh.children[1] as THREE.Mesh;
          (holo.material as THREE.MeshStandardMaterial).color.setHex(0x10b981);
          (holo.material as THREE.MeshStandardMaterial).emissive.setHex(0x10b981);
          hs.hacked += 1;
          setHackedCount(hs.hacked);
          addScore(50);
          audioController.playScore();
          stage.particles.burst(t.x, 1.2, t.z, 22, 0x10b981, 6.5);
        }
      }

      // Check Extraction Portal
      if (hs.hacked >= hs.required && Math.hypot(hs.x - 0, hs.z - -6.8) < 1.35) {
        addScore(150);
        hs.floor += 1;
        setFloorLevel(hs.floor);
        audioController.playLevelUp();
        stage.particles.burst(0, 1.0, -6.8, 36, 0x22d3ee, 9);
        stage.kickFov(5);
        buildFloorRef.current(hs.floor);
        return;
      }

      // Update Patrolling Guards & 3D Vision Cone Detection
      for (const g of guardsRef.current) {
        g.x += g.dirX * g.speed * dt;
        if (g.x > g.patrolMaxX) {
          g.x = g.patrolMaxX;
          g.dirX = -1;
        } else if (g.x < g.patrolMinX) {
          g.x = g.patrolMinX;
          g.dirX = 1;
        }
        g.group.position.set(g.x, 0, g.z);
        g.group.rotation.y = g.dirX > 0 ? Math.PI / 2 : -Math.PI / 2;

        // Check proximity or vision cone
        const dx = hs.x - g.x;
        const dz = hs.z - g.z;
        const dist = Math.hypot(dx, dz);
        const inFront = dx * g.dirX > 0.2 && Math.abs(dz) < 1.35 && dist < 3.85;
        if (dist < 0.85 || inFront) {
          stage.particles.burst(hs.x, 0.9, hs.z, 35, 0xef4444, 9.5);
          stage.triggerTrauma(0.75);
          audioController.playExplosion();
          audioController.playGameOver();
          triggerGameOver(scoreRef.current);
          return;
        }
      }
    });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-cyan-500/20 select-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-cyan-400">
            <KeyRound className="w-3.5 h-3.5" /> LANTAI {floorLevel}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-emerald-400 font-semibold tabular-nums">
          <Terminal className="w-3.5 h-3.5" /> TERMINAL: {hackedCount} / {totalTerminals}
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <ShieldAlert className="w-3 h-3 text-cyan-400" /> WASD: Retas Semua Terminal Lalu Menuju Portal Utara
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
        title="Neon Heist 3D"
        description="Retas terminal holografik 3D, hindari sorotan kerucut pandang penjaga siber, dan kabur lewat portal ekstraksi!"
        themeColor="cyan"
      />
    </div>
  );
}
