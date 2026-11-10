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
  buildCyberActionHero3D
} from '../../utils/threeStage';
import { Shield, Sword, Sparkles, Heart } from 'lucide-react';

interface VoidMonster3D {
  mesh: THREE.Group;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: 'swarmer' | 'brute' | 'voidlord';
  radius: number;
  xpValue: number;
}

interface VoidBolt3D {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
}

interface XpGem3D {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  value: number;
}

const ARENA_BOUND = 15.5;

function buildVoidMonsterMesh(type: VoidMonster3D['type']): THREE.Group {
  const g = new THREE.Group();
  const color = type === 'voidlord' ? 0xf43f5e : type === 'brute' ? 0xa855f7 : 0x8b5cf6;
  const scale = type === 'voidlord' ? 1.55 : type === 'brute' ? 1.15 : 0.72;

  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.65
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.95
  });
  const spikeMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b4b,
    roughness: 0.6,
    metalness: 0.8
  });

  // 1. Core Carapace
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48 * scale, 0), bodyMat);
  core.position.y = 0.55 * scale;
  core.castShadow = true;
  g.add(core);

  // 2. Glowing Void Eye
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 10, 10), eyeMat);
  eye.position.set(0, 0.62 * scale, 0.38 * scale);
  g.add(eye);

  // 3 & 4. Shoulder Spikes
  const spikeGeo = new THREE.ConeGeometry(0.16 * scale, 0.55 * scale, 6);
  const spikeL = new THREE.Mesh(spikeGeo, spikeMat);
  spikeL.position.set(-0.42 * scale, 0.85 * scale, 0);
  spikeL.rotation.z = 0.45;
  const spikeR = spikeL.clone();
  spikeR.position.x = 0.42 * scale;
  spikeR.rotation.z = -0.45;
  g.add(spikeL, spikeR);

  return g;
}

export default function VoidSurvivorGame({
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
    gameId: 'void-survivor',
    onGameOver,
    onScoreUpdate
  });

  const [hp, setHp] = useState(100);
  const [level, setLevel] = useState(1);
  const [bladeCount, setBladeCount] = useState(2);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const heroStateRef = useRef({
    x: 0,
    z: 0,
    hp: 100,
    maxHp: 100,
    xp: 0,
    nextXp: 50,
    level: 1,
    speed: 7.2,
    bladeCount: 2,
    boltCooldown: 0,
    fireRate: 0.45,
    damage: 1,
    invuln: 0,
    spawnTimer: 0
  });

  const keysRef = useRef<Record<string, boolean>>({});
  const monstersRef = useRef<VoidMonster3D[]>([]);
  const boltsRef = useRef<VoidBolt3D[]>([]);
  const gemsRef = useRef<XpGem3D[]>([]);
  const bladesGroupRef = useRef<THREE.Group | null>(null);

  const rebuildOrbitBlades = useCallback((count: number) => {
    const g = bladesGroupRef.current;
    if (!g) return;
    while (g.children.length > 0) {
      g.remove(g.children[0]);
    }
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.8
    });
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.85), bladeMat);
      blade.position.set(Math.cos(angle) * 2.2, 0.65, Math.sin(angle) * 2.2);
      blade.rotation.y = -angle;
      g.add(blade);
    }
  }, []);

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      monstersRef.current.forEach((m) => stage.scene.remove(m.mesh));
      boltsRef.current.forEach((b) => stage.scene.remove(b.mesh));
      gemsRef.current.forEach((gm) => stage.scene.remove(gm.mesh));
    }
    monstersRef.current = [];
    boltsRef.current = [];
    gemsRef.current = [];

    heroStateRef.current = {
      x: 0,
      z: 0,
      hp: 100,
      maxHp: 100,
      xp: 0,
      nextXp: 50,
      level: 1,
      speed: 7.2,
      bladeCount: 2,
      boltCooldown: 0,
      fireRate: 0.42,
      damage: 1,
      invuln: 0,
      spawnTimer: 0.5
    };
    setHp(100);
    setLevel(1);
    setBladeCount(2);
    rebuildOrbitBlades(2);
    startWithCountdown();
  }, [rebuildOrbitBlades, startWithCountdown]);

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
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = true;
        if (action === 'RIGHT') keysRef.current['arrowright'] = true;
        if (action === 'UP') keysRef.current['arrowup'] = true;
        if (action === 'DOWN') keysRef.current['arrowdown'] = true;
      },
      onActionUp: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = false;
        if (action === 'RIGHT') keysRef.current['arrowright'] = false;
        if (action === 'UP') keysRef.current['arrowup'] = false;
        if (action === 'DOWN') keysRef.current['arrowdown'] = false;
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
        backgroundColor: 0x090614,
        fogColor: 0x090614,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridSize: 40,
        gridPrimaryColor: '#a855f7',
        gridSecondaryColor: '#0c081d',
        cameraPresets: {
          isometric: { position: [10.5, 13.5, 10.5], lookAt: [0, 0.4, 0], fov: 46 },
          chase: { position: [0, 8.5, 12.5], lookAt: [0, 0.5, 0], fov: 54 },
          diorama: { position: [0, 20.5, 2.0], lookAt: [0, 0, 0], fov: 48 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 8-part Cyber Hero
    const hero = buildCyberActionHero3D(0xa855f7, 0x22d3ee);
    stage.scene.add(hero.group);

    // Orbiting Plasma Blades Group
    const bladesGroup = new THREE.Group();
    stage.scene.add(bladesGroup);
    bladesGroupRef.current = bladesGroup;
    rebuildOrbitBlades(2);

    const boltGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const boltMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.95
    });

    const gemGeo = new THREE.OctahedronGeometry(0.24, 0);
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.85
    });

    stage.startLoop((dt, elapsed) => {
      if (gameStateRef.current !== 'playing') return;

      const hs = heroStateRef.current;
      const keys = keysRef.current;

      let mx = 0;
      let mz = 0;
      if (keys['arrowleft'] || keys['a']) mx -= 1;
      if (keys['arrowright'] || keys['d']) mx += 1;
      if (keys['arrowup'] || keys['w']) mz -= 1;
      if (keys['arrowdown'] || keys['s']) mz += 1;

      if (mx !== 0 || mz !== 0) {
        const len = Math.hypot(mx, mz);
        mx /= len;
        mz /= len;
        hs.x = THREE.MathUtils.clamp(hs.x + mx * hs.speed * dt, -ARENA_BOUND, ARENA_BOUND);
        hs.z = THREE.MathUtils.clamp(hs.z + mz * hs.speed * dt, -ARENA_BOUND, ARENA_BOUND);
        hero.group.rotation.y = Math.atan2(mx, mz);
        const swing = Math.sin(elapsed * 14) * 0.45;
        hero.legL.rotation.x = swing;
        hero.legR.rotation.x = -swing;
        hero.armL.rotation.x = -swing * 0.7;
        hero.armR.rotation.x = swing * 0.7;
      } else {
        hero.legL.rotation.x = 0;
        hero.legR.rotation.x = 0;
      }

      hero.group.position.set(hs.x, 0, hs.z);
      bladesGroup.position.set(hs.x, 0, hs.z);
      bladesGroup.rotation.y = elapsed * 3.8;

      stage.setFollowTarget(hs.x, 0, hs.z, 0.75);

      if (hs.invuln > 0) hs.invuln -= dt;

      // Auto-fire arcane bolt at nearest monster
      hs.boltCooldown -= dt;
      if (hs.boltCooldown <= 0 && monstersRef.current.length > 0) {
        let nearest: VoidMonster3D | null = null;
        let minDist = Infinity;
        for (const m of monstersRef.current) {
          const d = Math.hypot(m.x - hs.x, m.z - hs.z);
          if (d < minDist) {
            minDist = d;
            nearest = m;
          }
        }
        if (nearest && minDist < 16) {
          hs.boltCooldown = hs.fireRate;
          const dx = nearest.x - hs.x;
          const dz = nearest.z - hs.z;
          const dist = Math.max(0.01, Math.hypot(dx, dz));
          const mesh = new THREE.Mesh(boltGeo, boltMat);
          mesh.position.set(hs.x, 0.75, hs.z);
          stage.scene.add(mesh);
          boltsRef.current.push({
            mesh,
            x: hs.x,
            z: hs.z,
            vx: (dx / dist) * 16,
            vz: (dz / dist) * 16,
            damage: hs.damage
          });
          audio.playLaser?.();
        }
      }

      // Spawn Void Monsters around perimeter
      hs.spawnTimer -= dt;
      if (hs.spawnTimer <= 0 && monstersRef.current.length < 36) {
        hs.spawnTimer = Math.max(0.32, 1.15 - hs.level * 0.06);
        const angle = Math.random() * Math.PI * 2;
        const dist = 11 + Math.random() * 4;
        const sx = THREE.MathUtils.clamp(hs.x + Math.cos(angle) * dist, -ARENA_BOUND, ARENA_BOUND);
        const sz = THREE.MathUtils.clamp(hs.z + Math.sin(angle) * dist, -ARENA_BOUND, ARENA_BOUND);

        const r = Math.random();
        const type: VoidMonster3D['type'] =
          hs.level >= 3 && r < 0.12 ? 'voidlord' : hs.level >= 2 && r < 0.35 ? 'brute' : 'swarmer';

        const mesh = buildVoidMonsterMesh(type);
        mesh.position.set(sx, 0, sz);
        stage.scene.add(mesh);

        monstersRef.current.push({
          mesh,
          x: sx,
          z: sz,
          hp: type === 'voidlord' ? 6 + hs.level : type === 'brute' ? 3 : 1,
          maxHp: type === 'voidlord' ? 6 + hs.level : type === 'brute' ? 3 : 1,
          speed: type === 'swarmer' ? 3.6 : type === 'brute' ? 2.5 : 2.1,
          type,
          radius: type === 'voidlord' ? 0.95 : type === 'brute' ? 0.72 : 0.52,
          xpValue: type === 'voidlord' ? 30 : type === 'brute' ? 15 : 8
        });
      }

      // Update Bolts
      for (let i = boltsRef.current.length - 1; i >= 0; i--) {
        const b = boltsRef.current[i];
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.mesh.position.set(b.x, 0.75, b.z);
        if (Math.abs(b.x) > ARENA_BOUND + 4 || Math.abs(b.z) > ARENA_BOUND + 4) {
          stage.scene.remove(b.mesh);
          boltsRef.current.splice(i, 1);
        }
      }

      // Update Monsters & Collisions
      for (let i = monstersRef.current.length - 1; i >= 0; i--) {
        const m = monstersRef.current[i];
        const dx = hs.x - m.x;
        const dz = hs.z - m.z;
        const dist = Math.max(0.01, Math.hypot(dx, dz));
        m.x += (dx / dist) * m.speed * dt;
        m.z += (dz / dist) * m.speed * dt;
        m.mesh.position.set(m.x, Math.abs(Math.sin(elapsed * 6 + i)) * 0.15, m.z);
        m.mesh.lookAt(hs.x, 0.5, hs.z);

        // Orbiting blades damage check
        if (Math.abs(dist - 2.2) < m.radius + 0.35) {
          m.hp -= dt * 4.5;
          stage.particles.burst(m.x, 0.65, m.z, 2, 0x22d3ee, 4);
        }

        // Bolt hits
        for (let j = boltsRef.current.length - 1; j >= 0; j--) {
          const b = boltsRef.current[j];
          if (Math.hypot(b.x - m.x, b.z - m.z) < m.radius + 0.25) {
            m.hp -= b.damage;
            stage.scene.remove(b.mesh);
            boltsRef.current.splice(j, 1);
            stage.particles.burst(m.x, 0.65, m.z, 7, 0xa855f7, 5.5);
            if (m.hp <= 0) break;
          }
        }

        if (m.hp <= 0) {
          stage.scene.remove(m.mesh);
          monstersRef.current.splice(i, 1);
          addScore(m.xpValue * 2);
          stage.particles.burst(m.x, 0.65, m.z, m.type === 'voidlord' ? 32 : 14, 0xc084fc, 7.5);
          stage.triggerTrauma(m.type === 'voidlord' ? 0.45 : 0.16);
          audio.playExplosion?.();

          const gem = new THREE.Mesh(gemGeo, gemMat);
          gem.position.set(m.x, 0.35, m.z);
          stage.scene.add(gem);
          gemsRef.current.push({ mesh: gem, x: m.x, z: m.z, value: m.xpValue });
          continue;
        }

        // Hero contact damage
        if (dist < m.radius + 0.48 && hs.invuln <= 0) {
          hs.hp = Math.max(0, hs.hp - (m.type === 'voidlord' ? 20 : 12));
          setHp(hs.hp);
          hs.invuln = 0.65;
          stage.triggerTrauma(0.5);
          stage.particles.burst(hs.x, 0.8, hs.z, 20, 0xef4444, 7);
          if (hs.hp <= 0) {
            triggerGameOver(scoreRef.current);
            return;
          }
        }
      }

      // Collect XP Gems
      for (let i = gemsRef.current.length - 1; i >= 0; i--) {
        const gm = gemsRef.current[i];
        gm.mesh.rotation.y += dt * 3;
        const d = Math.hypot(hs.x - gm.x, hs.z - gm.z);
        if (d < 3.5) {
          gm.x = THREE.MathUtils.damp(gm.x, hs.x, 9, dt);
          gm.z = THREE.MathUtils.damp(gm.z, hs.z, 9, dt);
          gm.mesh.position.set(gm.x, 0.35, gm.z);
        }
        if (d < 0.75) {
          stage.scene.remove(gm.mesh);
          gemsRef.current.splice(i, 1);
          hs.xp += gm.value;
          addScore(gm.value);
          audio.playCoin?.();
          if (hs.xp >= hs.nextXp) {
            hs.xp -= hs.nextXp;
            hs.level += 1;
            hs.nextXp = Math.floor(hs.nextXp * 1.35);
            hs.bladeCount = Math.min(6, hs.bladeCount + 1);
            hs.fireRate = Math.max(0.16, hs.fireRate * 0.9);
            hs.hp = Math.min(hs.maxHp, hs.hp + 25);
            setLevel(hs.level);
            setBladeCount(hs.bladeCount);
            setHp(hs.hp);
            rebuildOrbitBlades(hs.bladeCount);
            stage.particles.burst(hs.x, 1.0, hs.z, 36, 0x22d3ee, 9);
            stage.kickFov(5);
          }
        }
      }
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, rebuildOrbitBlades, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-purple-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-purple-400">
            <Sparkles className="w-3.5 h-3.5" /> LVL {level}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 text-cyan-400 font-medium">
            <Sword className="w-3.5 h-3.5" /> {bladeCount} ORBIT BLADES
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Heart className="w-3.5 h-3.5" /> {hp}% HP
          </span>
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        presetLabels={{
          isometric: 'Isometric 3D',
          chase: 'Third-Person 3D',
          diorama: 'Top Arena 3D'
        }}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Shield className="w-3 h-3 text-purple-400" /> WASD / Panah: Bertahan & Kumpulkan Kristal XP
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
        title="Void Survivor 3D"
        description="Bertahan hidup di arena 3D melawan gelombang entitas Void dengan pedang orbit plasma dan meriam otomatis!"
        themeColor="purple"
      />
    </div>
  );
}
