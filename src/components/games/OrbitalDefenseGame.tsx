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
import { Shield, Cpu, Zap, PlusCircle } from 'lucide-react';

interface TurretSlot3D {
  index: number;
  x: number;
  z: number;
  level: number;
  group: THREE.Group;
  head: THREE.Group;
  cooldown: number;
}

interface InvaderDrone3D {
  mesh: THREE.Group;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
}

function buildTurretPad3D(): { group: THREE.Group; head: THREE.Group } {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.3
  });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, 0.25, 8), baseMat);
  pad.position.y = 0.125;
  group.add(pad);

  const head = new THREE.Group();
  head.position.y = 0.35;
  group.add(head);

  return { group, head };
}

function populateTurretHead(head: THREE.Group, level: number): void {
  while (head.children.length > 0) head.remove(head.children[0]);
  if (level <= 0) return;

  const color = level === 1 ? 0x38bdf8 : level === 2 ? 0xa855f7 : 0xf59e0b;
  const turretMat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.75,
    roughness: 0.22
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.9,
    roughness: 0.18
  });

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), turretMat);
  head.add(dome);

  const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8);
  barrelGeo.rotateX(Math.PI / 2);
  if (level === 1) {
    const b = new THREE.Mesh(barrelGeo, barrelMat);
    b.position.set(0, 0.1, 0.42);
    head.add(b);
  } else {
    const bL = new THREE.Mesh(barrelGeo, barrelMat);
    bL.position.set(-0.14, 0.1, 0.42);
    const bR = bL.clone();
    bR.position.x = 0.14;
    head.add(bL, bR);
  }
}

export default function OrbitalDefenseGame({
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
    gameId: 'orbital-defense',
    onGameOver,
    onScoreUpdate
  });

  const [energy, setEnergy] = useState(120);
  const [coreHp, setCoreHp] = useState(100);
  const [wave, setWave] = useState(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const defenseStateRef = useRef({
    energy: 120,
    coreHp: 100,
    wave: 1,
    kills: 0,
    spawnTimer: 0.5
  });

  const slotsRef = useRef<TurretSlot3D[]>([]);
  const dronesRef = useRef<InvaderDrone3D[]>([]);

  const upgradeNextTurret = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const ds = defenseStateRef.current;
    if (ds.energy < 40) return;

    // Find lowest-level turret slot
    let targetSlot: TurretSlot3D | null = null;
    for (const s of slotsRef.current) {
      if (s.level < 3 && (!targetSlot || s.level < targetSlot.level)) {
        targetSlot = s;
      }
    }
    if (!targetSlot) return;

    ds.energy -= 40;
    setEnergy(ds.energy);
    targetSlot.level += 1;
    populateTurretHead(targetSlot.head, targetSlot.level);
    audio.playPowerUp?.();
    stageRef.current?.particles.burst(targetSlot.x, 0.6, targetSlot.z, 20, 0x38bdf8, 6);
  }, []);

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      dronesRef.current.forEach((d) => stage.scene.remove(d.mesh));
    }
    dronesRef.current = [];
    defenseStateRef.current = {
      energy: 120,
      coreHp: 100,
      wave: 1,
      kills: 0,
      spawnTimer: 0.5
    };
    setEnergy(120);
    setCoreHp(100);
    setWave(1);

    slotsRef.current.forEach((s, idx) => {
      s.level = idx < 2 ? 1 : 0;
      populateTurretHead(s.head, s.level);
    });

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
        backgroundColor: 0x050914,
        fogColor: 0x050914,
        fogDensity: 0.015,
        initialPreset: 'isometric',
        gridPrimaryColor: '#38bdf8',
        gridSecondaryColor: '#071020',
        cameraPresets: {
          isometric: { position: [10.5, 13.5, 10.5], lookAt: [0, 0.4, 0], fov: 46 },
          chase: { position: [0, 9.5, 13.5], lookAt: [0, 0.4, 0], fov: 52 },
          diorama: { position: [0, 19.5, 2.0], lookAt: [0, 0, 0], fov: 48 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build Central Planetary Reactor Core (6 parts)
    const reactorGroup = new THREE.Group();
    const coreSphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.15, 1),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2
      })
    );
    coreSphere.position.y = 1.25;
    const gyroRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.08, 8, 28),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 })
    );
    gyroRing1.position.y = 1.25;
    const gyroRing2 = gyroRing1.clone();
    gyroRing2.rotation.x = Math.PI / 2;
    reactorGroup.add(coreSphere, gyroRing1, gyroRing2);
    stage.scene.add(reactorGroup);

    // Build 6 Orbital Turret Pads around radius 3.8
    const builtSlots: TurretSlot3D[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const tx = Math.cos(angle) * 3.8;
      const tz = Math.sin(angle) * 3.8;
      const { group, head } = buildTurretPad3D();
      group.position.set(tx, 0, tz);
      const lvl = i < 2 ? 1 : 0;
      populateTurretHead(head, lvl);
      stage.scene.add(group);
      builtSlots.push({ index: i, x: tx, z: tz, level: lvl, group, head, cooldown: 0 });
    }
    slotsRef.current = builtSlots;

    stage.startLoop((dt, elapsed) => {
      coreSphere.rotation.y = elapsed * 1.4;
      gyroRing1.rotation.z = elapsed * 2.1;
      gyroRing2.rotation.y = -elapsed * 1.8;

      if (gameStateRef.current !== 'playing') return;

      const ds = defenseStateRef.current;

      // Spawn spiralling invader drones
      ds.spawnTimer -= dt;
      if (ds.spawnTimer <= 0) {
        ds.spawnTimer = Math.max(0.45, 1.35 - ds.wave * 0.08);
        const angle = Math.random() * Math.PI * 2;
        const g = new THREE.Group();
        const hull = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.48, 0),
          new THREE.MeshStandardMaterial({
            color: 0xf43f5e,
            emissive: 0xe11d48,
            emissiveIntensity: 0.7
          })
        );
        hull.position.y = 0.7;
        g.add(hull);
        const r = 11.5;
        g.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        stage.scene.add(g);

        const maxHp = 2 + Math.floor(ds.wave * 0.8);
        dronesRef.current.push({
          mesh: g,
          angle,
          radius: r,
          hp: maxHp,
          maxHp,
          speed: 1.55 + Math.min(1.5, ds.wave * 0.12)
        });
      }

      // Turrets track and fire at nearest drone
      for (const slot of slotsRef.current) {
        if (slot.level <= 0) continue;
        slot.cooldown -= dt;

        let nearest: InvaderDrone3D | null = null;
        let minDist = Infinity;
        for (const d of dronesRef.current) {
          const dx = d.mesh.position.x - slot.x;
          const dz = d.mesh.position.z - slot.z;
          const dist = Math.hypot(dx, dz);
          if (dist < minDist) {
            minDist = dist;
            nearest = d;
          }
        }

        if (nearest && minDist < 9.5) {
          slot.head.lookAt(nearest.mesh.position.x, 0.35, nearest.mesh.position.z);
          if (slot.cooldown <= 0) {
            slot.cooldown = Math.max(0.22, 0.65 - slot.level * 0.14);
            nearest.hp -= slot.level;
            stage.particles.burst(
              nearest.mesh.position.x,
              0.7,
              nearest.mesh.position.z,
              6,
              0x38bdf8,
              4.5
            );
            audio.playLaser?.();
          }
        }
      }

      // Update drones
      for (let i = dronesRef.current.length - 1; i >= 0; i--) {
        const d = dronesRef.current[i];
        if (d.hp <= 0) {
          stage.particles.burst(
            d.mesh.position.x,
            0.7,
            d.mesh.position.z,
            18,
            0xf59e0b,
            7.5
          );
          stage.scene.remove(d.mesh);
          dronesRef.current.splice(i, 1);
          ds.energy += 15;
          setEnergy(ds.energy);
          addScore(25);
          ds.kills += 1;
          if (ds.kills >= 8 + ds.wave * 3) {
            ds.kills = 0;
            ds.wave += 1;
            setWave(ds.wave);
            stage.kickFov(4);
          }
          continue;
        }

        d.angle += dt * 0.55;
        d.radius -= d.speed * dt;
        const wx = Math.cos(d.angle) * d.radius;
        const wz = Math.sin(d.angle) * d.radius;
        d.mesh.position.set(wx, 0, wz);
        d.mesh.rotation.y = -d.angle;

        if (d.radius < 1.45) {
          stage.scene.remove(d.mesh);
          dronesRef.current.splice(i, 1);
          ds.coreHp = Math.max(0, ds.coreHp - 20);
          setCoreHp(ds.coreHp);
          stage.particles.burst(0, 1.2, 0, 30, 0xef4444, 9);
          stage.triggerTrauma(0.65);
          audio.playExplosion?.();
          if (ds.coreHp <= 0) {
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
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-sky-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-sky-400">
            <Cpu className="w-3.5 h-3.5" /> WAVE {wave}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-400 font-semibold">ENERGI: {energy}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={upgradeNextTurret}
            disabled={energy < 40}
            className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-sky-400 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Bangun / Upgrade Turret (40 Energi)
          </button>
          <div className="rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2 text-xs font-semibold text-emerald-400 tabular-nums whitespace-nowrap shrink-0">
            <Shield className="inline w-3.5 h-3.5 mr-1" /> INTI: {coreHp}%
          </div>
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-sky-400" /> Bangun Turret 3D untuk Melindungi Inti Reaktor
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
        title="Orbital Defense 3D"
        description="Bangun dan tingkatkan menara pertahanan orbit 3D untuk menghancurkan invasi drone sebelum menembus reaktor!"
        themeColor="sky"
      />
    </div>
  );
}
