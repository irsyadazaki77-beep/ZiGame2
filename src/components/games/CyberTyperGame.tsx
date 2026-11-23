import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController, ObjectPool } from '../../sdk';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D,
  buildEnemyShip3D,
  buildCyberTurret3D,
  createHoloLabelSprite3D,
  updateHoloLabelSprite3D,
  LaserBeamPool3D,
  dampValue
} from '../../utils/threeStage';
import { Keyboard, Shield, Zap } from 'lucide-react';

const CYBER_WORDS = [
  'MATRIX',
  'FIREWALL',
  'VECTOR',
  'SHADER',
  'KERNEL',
  'NEBULA',
  'QUANTUM',
  'CIPHER',
  'PHOTON',
  'PROTOCOL',
  'SYNAPSE',
  'VORTEX',
  'PLASMA',
  'BEACON',
  'ORBITAL',
  'ENCRYPT'
];

interface WordDrone3D {
  id: number;
  word: string;
  typedLen: number;
  x: number;
  z: number;
  speed: number;
  mesh: THREE.Group;
  labelSprite: THREE.Sprite;
}

export default function CyberTyperGame({
  onGameOver,
  onScoreUpdate,
  highScore
}: GameComponentProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<ThreeStageController | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    gameState,
    score,
    addScore,
    startWithCountdown,
    countdown,
    triggerGameOver,
    scoreRef
  } = useGameEngine({
    gameId: 'cyber-typer',
    onGameOver,
    onScoreUpdate
  });

  const [shieldHp, setShieldHp] = useState(100);
  const [hudDrones, setHudDrones] = useState<{ id: number; word: string; typedLen: number }[]>([]);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const typerRef = useRef({
    hp: 100,
    spawnTimer: 0.4,
    nextId: 1,
    aimYaw: 0,
    barrelRecoil: 0,
    combo: 0
  });

  const dronesRef = useRef<WordDrone3D[]>([]);
  const releaseDronesRef = useRef<() => void>(() => {});
  const releaseSingleDroneRef = useRef<(d: WordDrone3D) => void>(() => {});
  const fireLaserRef = useRef<(toX: number, toZ: number, isFinish: boolean) => void>(() => {});

  const syncHudDrones = useCallback(() => {
    setHudDrones(
      dronesRef.current.map((d) => ({
        id: d.id,
        word: d.word,
        typedLen: d.typedLen
      }))
    );
  }, []);

  const handleCharInput = useCallback(
    (rawChar: string) => {
      if (gameStateRef.current !== 'playing') return;
      const ch = rawChar.toUpperCase();
      if (!/^[A-Z]$/.test(ch)) return;

      const stage = stageRef.current;
      let target = dronesRef.current.find(
        (d) => d.typedLen > 0 && d.word[d.typedLen] === ch
      );
      if (!target) {
        target = dronesRef.current.find((d) => d.typedLen === 0 && d.word[0] === ch);
      }

      if (target) {
        target.typedLen += 1;
        typerRef.current.combo += 1;
        // Aim turret head toward target drone
        const dx = target.x;
        const dz = target.z - 5.5;
        typerRef.current.aimYaw = Math.atan2(-dx, -dz);
        typerRef.current.barrelRecoil = 0.28;

        const isCompleted = target.typedLen >= target.word.length;
        fireLaserRef.current(target.x, target.z, isCompleted);
        audioController.playLaser();
        stage?.particles.burst(target.x, 0.75, target.z, 10, 0x22c55e, 6.0);

        updateHoloLabelSprite3D(target.labelSprite, target.word, {
          highlightPrefixLen: target.typedLen,
          borderColor: '#22c55e',
          highlightColor: '#4ade80'
        });

        if (isCompleted) {
          stage?.particles.burst(target.x, 0.75, target.z, 32, 0x10b981, 9.5);
          stage?.triggerShockwave(target.x, 0.08, target.z, 0x22c55e, 3.6, 0.42);
          stage?.triggerTrauma(0.32);
          releaseSingleDroneRef.current(target);
          dronesRef.current = dronesRef.current.filter((d) => d.id !== target!.id);
          addScore(target.word.length * 15 + Math.min(60, typerRef.current.combo * 3));
          audioController.playScore();
        }
        syncHudDrones();
      } else {
        typerRef.current.combo = 0;
      }
    },
    [addScore, syncHudDrones]
  );

  const handleStart = useCallback(() => {
    releaseDronesRef.current();
    dronesRef.current = [];
    typerRef.current = {
      hp: 100,
      spawnTimer: 0.4,
      nextId: 1,
      aimYaw: 0,
      barrelRecoil: 0,
      combo: 0
    };
    setShieldHp(100);
    setHudDrones([]);
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === mobileInputRef.current) return;
      if (e.key.length === 1) {
        handleCharInput(e.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCharInput]);

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
        backgroundColor: 0x040d09,
        fogColor: 0x040d09,
        fogDensity: 0.015,
        initialPreset: 'chase',
        gridPrimaryColor: '#22c55e',
        gridSecondaryColor: '#06150e',
        cameraPresets: {
          chase: { position: [0, 7.8, 12.2], lookAt: [0, 0.5, -2.5], fov: 52 },
          isometric: { position: [9.5, 12.5, 9.5], lookAt: [0, 0.5, -1.5], fov: 46 },
          diorama: { position: [0, 17.5, 2.0], lookAt: [0, 0, -2.0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build Multi-Part Cyber Turret + Firewall Energy Barrier
    const turret = buildCyberTurret3D(0x22c55e, 0x38bdf8);
    turret.group.position.set(0, 0, 5.5);
    stage.scene.add(turret.group);

    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x10b981,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.42
    });
    const firewallBar = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.45, 0.14), barrierMat);
    firewallBar.position.set(0, 0.25, 4.7);
    stage.scene.add(firewallBar);

    const pylonGeo = new THREE.CylinderGeometry(0.24, 0.32, 1.35, 8);
    const pylonMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.22
    });
    const pylonL = new THREE.Mesh(pylonGeo, pylonMat);
    pylonL.position.set(-6.2, 0.67, 4.7);
    const pylonR = pylonL.clone();
    pylonR.position.x = 6.2;
    stage.scene.add(pylonL, pylonR);

    const laserPool = new LaserBeamPool3D(stage.scene, 10, 0x22c55e);
    fireLaserRef.current = (toX: number, toZ: number, isFinish: boolean) => {
      laserPool.fire(
        [0, 0.85, 4.4],
        [toX, 0.75, toZ],
        isFinish ? 0x38bdf8 : 0x22c55e,
        isFinish ? 0.22 : 0.14
      );
    };

    const dronePool = new ObjectPool<WordDrone3D>(
      () => {
        const mesh = buildEnemyShip3D('interceptor');
        const labelSprite = createHoloLabelSprite3D('MATRIX', {
          borderColor: '#38bdf8',
          scaleX: 2.55,
          scaleY: 0.68
        });
        labelSprite.position.set(0, 1.18, 0);
        mesh.add(labelSprite);
        mesh.visible = false;
        stage.scene.add(mesh);
        return {
          id: 0,
          word: '',
          typedLen: 0,
          x: 0,
          z: -12.5,
          speed: 2,
          mesh,
          labelSprite
        };
      },
      (d) => {
        d.mesh.visible = false;
        d.mesh.position.set(0, -99, -20);
        d.typedLen = 0;
      },
      8
    );

    releaseDronesRef.current = () => {
      dronePool.releaseAll();
    };
    releaseSingleDroneRef.current = (d) => {
      dronePool.releaseItem(d);
    };

    stage.startLoop((dt, elapsed) => {
      const st = typerRef.current;
      turret.core.rotation.y = elapsed * 2.5;
      turret.head.rotation.y = dampValue(turret.head.rotation.y, st.aimYaw, 14, dt);
      st.barrelRecoil = dampValue(st.barrelRecoil, 0, 12, dt);
      turret.barrels.position.z = st.barrelRecoil;
      laserPool.update(dt);

      if (gameStateRef.current !== 'playing') return;

      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0 && dronesRef.current.length < 5) {
        st.spawnTimer = 1.95;
        const word = CYBER_WORDS[Math.floor(Math.random() * CYBER_WORDS.length)];
        const drone = dronePool.acquire();
        const x = (Math.random() - 0.5) * 10;
        const z = -12.5;
        drone.id = st.nextId++;
        drone.word = word;
        drone.typedLen = 0;
        drone.x = x;
        drone.z = z;
        drone.speed = 1.85 + Math.random() * 0.65;
        drone.mesh.position.set(x, 0.75, z);
        drone.mesh.visible = true;
        updateHoloLabelSprite3D(drone.labelSprite, word, {
          highlightPrefixLen: 0,
          borderColor: '#38bdf8'
        });
        dronesRef.current.push(drone);
        syncHudDrones();
      }

      for (let i = dronesRef.current.length - 1; i >= 0; i--) {
        const d = dronesRef.current[i];
        d.z += d.speed * dt;
        const bobY = 0.75 + Math.sin(elapsed * 4 + d.id) * 0.12;
        d.mesh.position.set(d.x, bobY, d.z);
        d.mesh.rotation.z = Math.sin(elapsed * 2.5 + d.id) * 0.08;

        if (d.z >= 4.7) {
          dronePool.releaseItem(d);
          dronesRef.current.splice(i, 1);
          st.hp = Math.max(0, st.hp - 25);
          st.combo = 0;
          setShieldHp(st.hp);
          stage.particles.burst(d.x, 0.85, 4.7, 34, 0xef4444, 9);
          stage.triggerShockwave(d.x, 0.08, 4.7, 0xef4444, 3.8, 0.45);
          stage.triggerTrauma(0.65);
          audioController.playExplosion();
          syncHudDrones();
          if (st.hp <= 0) {
            audioController.playGameOver();
            triggerGameOver(scoreRef.current);
            return;
          }
        }
      }
    });

    return () => {
      releaseDronesRef.current();
      releaseDronesRef.current = () => {};
      releaseSingleDroneRef.current = () => {};
      dronesRef.current = [];
      stage.dispose();
      stageRef.current = null;
    };
  }, [scoreRef, syncHudDrones, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-emerald-500/20 touch-none select-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            <Keyboard className="w-3.5 h-3.5" /> SKOR: {score}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => mobileInputRef.current?.focus()}
            className="pointer-events-auto sm:hidden min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-slate-950/90 px-3 text-xs font-semibold text-emerald-300"
          >
            <Keyboard className="w-3.5 h-3.5" /> Keyboard
          </button>
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-emerald-400 tabular-nums">
            <Shield className="w-3.5 h-3.5" /> FIREWALL: {shieldHp}%
          </div>
        </div>
      </div>

      {/* Hidden mobile keyboard input helper */}
      <input
        ref={mobileInputRef}
        type="text"
        value=""
        onChange={(e) => {
          const val = e.target.value;
          for (const c of val) handleCharInput(c);
          e.target.value = '';
        }}
        aria-label="Input ketik Cyber Typer"
        className="sr-only"
      />

      {/* Active Target Word Callouts (Clickable on Mobile/Touch or Typed on Keyboard) */}
      {gameState === 'playing' && (
        <div className="pointer-events-auto absolute inset-x-0 top-14 sm:top-14 z-10 flex flex-wrap justify-center gap-2 px-3 sm:px-4">
          {hudDrones.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => handleCharInput(d.word[d.typedLen] || '')}
              className="min-h-[44px] rounded-lg border border-emerald-500/40 bg-slate-950/90 px-3 py-1.5 font-mono text-xs tracking-wider shadow-lg hover:bg-slate-900 active:bg-emerald-950 whitespace-nowrap shrink-0"
              title="Ketik di keyboard atau ketuk untuk menembak huruf berikutnya"
            >
              <span className="text-emerald-400 font-bold">{d.word.slice(0, d.typedLen)}</span>
              <span className="text-white">{d.word.slice(d.typedLen)}</span>
            </button>
          ))}
        </div>
      )}

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-emerald-400" /> Ketik Kata Sandi Drone 3D atau Ketuk Target
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
        title="Cyber Typer 3D"
        description="Ketik kode enkripsi pada skuadron drone 3D sebelum mereka menabrak reaktor Firewall Anda!"
        themeColor="emerald"
      />
    </div>
  );
}
