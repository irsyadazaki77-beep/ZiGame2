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
import { Cpu, Zap, PlusCircle, Orbit } from 'lucide-react';

export default function CyberClickerGame({
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
    gameId: 'cyber-clicker',
    onGameOver,
    onScoreUpdate
  });

  const [energyCredits, setEnergyCredits] = useState(0);
  const [clickPower, setClickPower] = useState(5);
  const [autoSatellites, setAutoSatellites] = useState(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const reactorRef = useRef({
    credits: 0,
    clickPower: 5,
    satellites: 1,
    pulseScale: 1.0,
    spinBoost: 0,
    autoTimer: 0
  });

  const pulseCore = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const r = reactorRef.current;
    r.credits += r.clickPower;
    r.pulseScale = 1.38;
    r.spinBoost = 6.0;
    setEnergyCredits(r.credits);
    addScore(r.clickPower);
    audio.playCoin?.();
    const stage = stageRef.current;
    if (stage) {
      stage.particles.burst(0, 1.5, 0, 16, 0x6366f1, 7.5);
      stage.triggerTrauma(0.16);
    }
  }, [addScore]);

  const buySatellite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (gameStateRef.current !== 'playing') return;
      const r = reactorRef.current;
      const cost = 35 * r.satellites;
      if (r.credits < cost) return;
      r.credits -= cost;
      r.satellites += 1;
      r.clickPower += 3;
      setEnergyCredits(r.credits);
      setAutoSatellites(r.satellites);
      setClickPower(r.clickPower);
      audio.playPowerUp?.();
      stageRef.current?.particles.burst(0, 1.5, 0, 32, 0x22d3ee, 9);
      stageRef.current?.kickFov(4);
    },
    []
  );

  const handleStart = useCallback(() => {
    reactorRef.current = {
      credits: 0,
      clickPower: 5,
      satellites: 1,
      pulseScale: 1.0,
      spinBoost: 0,
      autoTimer: 0
    };
    setEnergyCredits(0);
    setClickPower(5);
    setAutoSatellites(1);
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
        backgroundColor: 0x060818,
        fogColor: 0x060818,
        fogDensity: 0.015,
        initialPreset: 'isometric',
        gridPrimaryColor: '#6366f1',
        gridSecondaryColor: '#090d24',
        cameraPresets: {
          isometric: { position: [7.8, 8.8, 7.8], lookAt: [0, 1.4, 0], fov: 46 },
          chase: { position: [0, 4.5, 9.8], lookAt: [0, 1.4, 0], fov: 50 },
          diorama: { position: [0, 13.5, 1.8], lookAt: [0, 0, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 9-Part Quantum Gyroscope Reactor Core
    const reactorGroup = new THREE.Group();
    reactorGroup.position.y = 1.65;

    const coreCrystal = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 1),
      new THREE.MeshPhysicalMaterial({
        color: 0x6366f1,
        emissive: 0x4f46e5,
        emissiveIntensity: 0.85,
        roughness: 0.15,
        metalness: 0.3,
        clearcoat: 1.0
      })
    );
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.09, 12, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        metalness: 0.88,
        roughness: 0.18,
        clearcoat: 0.9
      })
    );
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.07, 12, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0xa855f7,
        metalness: 0.88,
        roughness: 0.18,
        clearcoat: 0.9
      })
    );
    ring2.rotation.x = Math.PI / 2;

    reactorGroup.add(coreCrystal, ring1, ring2);
    stage.scene.add(reactorGroup);

    // Orbiting Auto-Miner Satellites InstancedMesh
    const maxSats = 16;
    const satGeo = new THREE.OctahedronGeometry(0.28, 0);
    const satMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.9
    });
    const satInstanced = new THREE.InstancedMesh(satGeo, satMat, maxSats);
    satInstanced.frustumCulled = false;
    stage.scene.add(satInstanced);
    const dummyMat = new THREE.Matrix4();

    stage.startLoop((dt, elapsed) => {
      const r = reactorRef.current;
      r.pulseScale = THREE.MathUtils.damp(r.pulseScale, 1.0, 10, dt);
      r.spinBoost = THREE.MathUtils.damp(r.spinBoost, 0, 4, dt);

      coreCrystal.scale.setScalar(r.pulseScale);
      coreCrystal.rotation.y += (1.5 + r.spinBoost) * dt;
      ring1.rotation.z += (2.2 + r.spinBoost * 0.5) * dt;
      ring1.rotation.x += 1.1 * dt;
      ring2.rotation.y -= (1.8 + r.spinBoost * 0.5) * dt;

      // Update orbiting satellites
      const satCount = Math.min(maxSats, r.satellites);
      for (let i = 0; i < maxSats; i++) {
        if (i < satCount) {
          const angle = elapsed * 1.8 + (i / satCount) * Math.PI * 2;
          const sx = Math.cos(angle) * 3.1;
          const sz = Math.sin(angle) * 3.1;
          const sy = 1.65 + Math.sin(elapsed * 3 + i) * 0.35;
          dummyMat.makeScale(1, 1, 1);
          dummyMat.setPosition(sx, sy, sz);
          satInstanced.setMatrixAt(i, dummyMat);
        } else {
          dummyMat.makeScale(0, 0, 0);
          dummyMat.setPosition(0, -999, 0);
          satInstanced.setMatrixAt(i, dummyMat);
        }
      }
      satInstanced.instanceMatrix.needsUpdate = true;

      if (gameStateRef.current !== 'playing') return;

      r.autoTimer += dt;
      if (r.autoTimer >= 1.0) {
        r.autoTimer -= 1.0;
        const passive = r.satellites * 4;
        r.credits += passive;
        setEnergyCredits(r.credits);
        addScore(passive);
      }
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore]);

  return (
    <div
      className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-indigo-500/20"
      onClick={pulseCore}
    >
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-indigo-400">
            <Cpu className="w-3.5 h-3.5" /> ENERGI: {energyCredits}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
          <span aria-hidden="true">·</span>
          <span className="text-cyan-400 font-semibold flex items-center gap-1">
            <Orbit className="w-3.5 h-3.5" /> {autoSatellites} SATELIT
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={buySatellite}
            disabled={energyCredits < 35 * autoSatellites}
            className="pointer-events-auto flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Satelit Orbit ({35 * autoSatellites} Energi)
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              triggerGameOver(scoreRef.current);
            }}
            className="pointer-events-auto rounded-xl border border-white/15 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            Simpan & Selesai
          </button>
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-indigo-400" /> Klik Reaktor Kuantum 3D (+{clickPower} Energi/Klik)
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
        title="Cyber Core Clicker 3D"
        description="Ekstrak energi dari Reaktor Gyroskopik 3D dan luncurkan satelit penambang otomatis ke orbit!"
        themeColor="indigo"
      />
    </div>
  );
}
