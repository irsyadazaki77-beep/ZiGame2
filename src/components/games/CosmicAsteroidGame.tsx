import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D,
  buildStarfighter3D
} from '../../utils/threeStage';
import { Flame, Compass, Sparkles } from 'lucide-react';

interface Asteroid3D {
  mesh: THREE.Group;
  x: number;
  z: number;
  vx: number;
  vz: number;
  sizeTier: 3 | 2 | 1; // 3=Large, 2=Medium, 1=Small
  radius: number;
  rotVel: THREE.Vector3;
}

interface PlasmaShot3D {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
}

const WRAP_X = 11.5;
const WRAP_Z = 8.5;

function buildAsteroidGroup3D(sizeTier: 3 | 2 | 1): THREE.Group {
  const g = new THREE.Group();
  const radius = sizeTier === 3 ? 1.35 : sizeTier === 2 ? 0.82 : 0.45;
  const rockMat = new THREE.MeshStandardMaterial({
    color: sizeTier === 3 ? 0x64748b : sizeTier === 2 ? 0x94a3b8 : 0xcbd5e1,
    roughness: 0.78,
    metalness: 0.22,
    flatShading: true
  });
  const veinMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    wireframe: true
  });

  // 1. Primary Cratered Core
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), rockMat);
  core.castShadow = true;
  g.add(core);

  // 2. Secondary Sub-Boulder Lobe
  const lobe = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 0.65, 0), rockMat);
  lobe.position.set(radius * 0.45, radius * 0.2, 0);
  g.add(lobe);

  // 3. Glowing Mineral Vein Cage
  const cage = new THREE.Mesh(new THREE.DodecahedronGeometry(radius * 1.02, 0), veinMat);
  g.add(cage);

  return g;
}

export default function CosmicAsteroidGame({
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
    gameId: 'cosmic-asteroid',
    onGameOver,
    onScoreUpdate
  });

  const [lives, setLives] = useState(3);
  const [sector, setSector] = useState(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('diorama');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const shipStateRef = useRef({
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    angle: 0,
    lives: 3,
    sector: 1,
    invuln: 0,
    fireCooldown: 0
  });

  const keysRef = useRef<Record<string, boolean>>({});
  const asteroidsRef = useRef<Asteroid3D[]>([]);
  const shotsRef = useRef<PlasmaShot3D[]>([]);
  const spawnSectorRef = useRef<(sec: number) => void>(() => {});

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      asteroidsRef.current.forEach((a) => stage.scene.remove(a.mesh));
      shotsRef.current.forEach((s) => stage.scene.remove(s.mesh));
    }
    asteroidsRef.current = [];
    shotsRef.current = [];
    shipStateRef.current = {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      angle: 0,
      lives: 3,
      sector: 1,
      invuln: 2.0,
      fireCooldown: 0
    };
    setLives(3);
    setSector(1);
    spawnSectorRef.current(1);
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
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = true;
        if (action === 'RIGHT') keysRef.current['arrowright'] = true;
        if (action === 'UP') keysRef.current['arrowup'] = true;
        if (action === 'ACTION_PRIMARY') keysRef.current['Space'] = true;
      },
      onActionUp: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = false;
        if (action === 'RIGHT') keysRef.current['arrowright'] = false;
        if (action === 'UP') keysRef.current['arrowup'] = false;
        if (action === 'ACTION_PRIMARY') keysRef.current['Space'] = false;
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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
        backgroundColor: 0x040711,
        fogColor: 0x040711,
        fogDensity: 0.014,
        initialPreset: 'diorama',
        gridPrimaryColor: '#06b6d4',
        gridSecondaryColor: '#070c18',
        cameraPresets: {
          diorama: { position: [0, 19.5, 2.2], lookAt: [0, 0, 0], fov: 48 },
          isometric: { position: [10.5, 14.5, 10.5], lookAt: [0, 0, 0], fov: 46 },
          chase: { position: [0, 9.5, 13.5], lookAt: [0, 0, 0], fov: 54 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const ship = buildStarfighter3D(0x06b6d4, 0xf59e0b, stage.isSoftwareGl);
    ship.group.position.set(0, 0.7, 0);
    stage.scene.add(ship.group);

    const spawnAsteroid = (x: number, z: number, tier: 3 | 2 | 1) => {
      const mesh = buildAsteroidGroup3D(tier);
      mesh.position.set(x, 0.7, z);
      stage.scene.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const spd = (4 - tier) * 1.85 + Math.random() * 1.5;
      asteroidsRef.current.push({
        mesh,
        x,
        z,
        vx: Math.cos(angle) * spd,
        vz: Math.sin(angle) * spd,
        sizeTier: tier,
        radius: tier === 3 ? 1.3 : tier === 2 ? 0.8 : 0.45,
        rotVel: new THREE.Vector3(
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5
        )
      });
    };

    spawnSectorRef.current = (sec: number) => {
      const count = 4 + sec;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const ax = Math.cos(angle) * 7.5;
        const az = Math.sin(angle) * 5.8;
        spawnAsteroid(ax, az, 3);
      }
    };

    const shotGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const shotMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.95
    });

    stage.startLoop((dt) => {
      if (gameStateRef.current !== 'playing') return;

      const s = shipStateRef.current;
      const keys = keysRef.current;

      if (keys['arrowleft'] || keys['a']) s.angle += 4.2 * dt;
      if (keys['arrowright'] || keys['d']) s.angle -= 4.2 * dt;

      const thrusting = keys['arrowup'] || keys['w'];
      if (thrusting) {
        s.vx += -Math.sin(s.angle) * 14 * dt;
        s.vz += -Math.cos(s.angle) * 14 * dt;
      }

      // Zero-G damping
      s.vx *= Math.pow(0.985, dt * 60);
      s.vz *= Math.pow(0.985, dt * 60);

      s.x += s.vx * dt;
      s.z += s.vz * dt;

      // Toroidal screen wrap
      if (s.x > WRAP_X) s.x = -WRAP_X;
      if (s.x < -WRAP_X) s.x = WRAP_X;
      if (s.z > WRAP_Z) s.z = -WRAP_Z;
      if (s.z < -WRAP_Z) s.z = WRAP_Z;

      ship.group.position.set(s.x, 0.7, s.z);
      ship.group.rotation.y = s.angle;
      ship.thrusterL.visible = Boolean(thrusting);
      ship.thrusterR.visible = Boolean(thrusting);
      ship.shieldMesh.visible = s.invuln > 0;

      if (s.invuln > 0) s.invuln -= dt;

      stage.setFollowTarget(s.x, 0, s.z, 0.25);

      // Firing plasma cannon
      s.fireCooldown -= dt;
      if ((keys[' '] || keys['Space'] || keys['z']) && s.fireCooldown <= 0) {
        s.fireCooldown = 0.2;
        const dirX = -Math.sin(s.angle);
        const dirZ = -Math.cos(s.angle);
        const mesh = new THREE.Mesh(shotGeo, shotMat);
        mesh.position.set(s.x + dirX * 0.9, 0.7, s.z + dirZ * 0.9);
        stage.scene.add(mesh);
        shotsRef.current.push({
          mesh,
          x: s.x + dirX * 0.9,
          z: s.z + dirZ * 0.9,
          vx: dirX * 20 + s.vx * 0.3,
          vz: dirZ * 20 + s.vz * 0.3,
          life: 1.1
        });
        audio.playLaser?.();
      }

      // Update plasma shots
      for (let i = shotsRef.current.length - 1; i >= 0; i--) {
        const sh = shotsRef.current[i];
        sh.life -= dt;
        if (sh.life <= 0) {
          stage.scene.remove(sh.mesh);
          shotsRef.current.splice(i, 1);
          continue;
        }
        sh.x += sh.vx * dt;
        sh.z += sh.vz * dt;
        if (sh.x > WRAP_X) sh.x = -WRAP_X;
        if (sh.x < -WRAP_X) sh.x = WRAP_X;
        if (sh.z > WRAP_Z) sh.z = -WRAP_Z;
        if (sh.z < -WRAP_Z) sh.z = WRAP_Z;
        sh.mesh.position.set(sh.x, 0.7, sh.z);
      }

      // Update Asteroids
      for (let i = asteroidsRef.current.length - 1; i >= 0; i--) {
        const a = asteroidsRef.current[i];
        a.x += a.vx * dt;
        a.z += a.vz * dt;
        if (a.x > WRAP_X) a.x = -WRAP_X;
        if (a.x < -WRAP_X) a.x = WRAP_X;
        if (a.z > WRAP_Z) a.z = -WRAP_Z;
        if (a.z < -WRAP_Z) a.z = WRAP_Z;

        a.mesh.position.set(a.x, 0.7, a.z);
        a.mesh.rotation.x += a.rotVel.x * dt;
        a.mesh.rotation.y += a.rotVel.y * dt;

        // Check shot hits
        let hit = false;
        for (let j = shotsRef.current.length - 1; j >= 0; j--) {
          const sh = shotsRef.current[j];
          if (Math.hypot(sh.x - a.x, sh.z - a.z) < a.radius + 0.2) {
            stage.scene.remove(sh.mesh);
            shotsRef.current.splice(j, 1);
            hit = true;
            break;
          }
        }

        if (hit) {
          stage.scene.remove(a.mesh);
          asteroidsRef.current.splice(i, 1);
          addScore(a.sizeTier === 3 ? 20 : a.sizeTier === 2 ? 50 : 100);
          stage.particles.burst(a.x, 0.7, a.z, a.sizeTier * 10, 0x06b6d4, 7.5);
          stage.triggerTrauma(0.28);
          audio.playExplosion?.();

          if (a.sizeTier > 1) {
            const nextTier = (a.sizeTier - 1) as 2 | 1;
            spawnAsteroid(a.x, a.z, nextTier);
            spawnAsteroid(a.x, a.z, nextTier);
          }

          if (asteroidsRef.current.length === 0) {
            s.sector += 1;
            setSector(s.sector);
            s.invuln = 2.0;
            spawnSectorRef.current(s.sector);
            stage.kickFov(6);
          }
          continue;
        }

        // Check ship collision
        if (s.invuln <= 0 && Math.hypot(a.x - s.x, a.z - s.z) < a.radius + 0.55) {
          s.lives -= 1;
          setLives(s.lives);
          s.invuln = 2.2;
          s.x = 0;
          s.z = 0;
          s.vx = 0;
          s.vz = 0;
          stage.particles.burst(a.x, 0.7, a.z, 35, 0xef4444, 10);
          stage.triggerTrauma(0.75);
          audio.playExplosion?.();
          if (s.lives <= 0) {
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
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-cyan-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-cyan-400">
            <Compass className="w-3.5 h-3.5" /> SEKTOR {sector}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-rose-400 font-semibold tabular-nums">
          <Flame className="w-3.5 h-3.5" /> NYAWA: {lives}
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Sparkles className="w-3 h-3 text-cyan-400" /> A/D: Putar · W: Dorong · Space: Tembak Plasma
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
        title="Cosmic Asteroid 3D"
        description="Hancurkan bongkahan asteroid polihedral 3D di gravitasi nol sebelum bertabrakan dengan pesawat Anda!"
        themeColor="cyan"
      />
    </div>
  );
}
