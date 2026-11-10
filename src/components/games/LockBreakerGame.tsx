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
  QualityLevel3D
} from '../../utils/threeStage';
import { Lock, Unlock, Zap } from 'lucide-react';

export default function LockBreakerGame({
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
    gameId: 'lock-breaker',
    onGameOver,
    onScoreUpdate
  });

  const [vaultLevel, setVaultLevel] = useState(1);
  const [pinsLeft, setPinsLeft] = useState(3);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const lockRef = useRef({
    needleAngle: 0,
    targetAngle: Math.PI * 0.65,
    dir: 1,
    speed: 2.3,
    pinsRemaining: 3,
    vault: 1
  });

  const attemptStrike = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const st = lockRef.current;
    const stage = stageRef.current;

    let diff = Math.abs(st.needleAngle - st.targetAngle) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;

    if (diff < 0.34) {
      // Hit target lock pin!
      st.dir *= -1;
      st.pinsRemaining -= 1;
      addScore(30 * st.vault);
      audio.playCoin?.();

      const tx = Math.cos(st.targetAngle) * 3.1;
      const tz = Math.sin(st.targetAngle) * 3.1;
      stage?.particles.burst(tx, 0.7, tz, 22, 0xf59e0b, 7.5);
      stage?.triggerTrauma(0.24);

      if (st.pinsRemaining <= 0) {
        st.vault += 1;
        st.pinsRemaining = 2 + st.vault;
        st.speed = Math.min(5.2, 2.3 + st.vault * 0.25);
        setVaultLevel(st.vault);
        addScore(100);
        stage?.kickFov(5);
        audio.playPowerUp?.();
      }
      setPinsLeft(st.pinsRemaining);
      st.targetAngle = (st.needleAngle + Math.PI * (0.45 + Math.random() * 1.1)) % (Math.PI * 2);
    } else {
      // Missed pin -> Vault Lockdown
      stage?.particles.burst(0, 0.8, 0, 36, 0xef4444, 9.5);
      stage?.triggerTrauma(0.75);
      audio.playExplosion?.();
      triggerGameOver(scoreRef.current);
    }
  }, [addScore, scoreRef, triggerGameOver]);

  const handleStart = useCallback(() => {
    lockRef.current = {
      needleAngle: 0,
      targetAngle: Math.PI * 0.65,
      dir: 1,
      speed: 2.3,
      pinsRemaining: 3,
      vault: 1
    };
    setVaultLevel(1);
    setPinsLeft(3);
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        attemptStrike();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'ACTION_PRIMARY') attemptStrike();
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsub();
    };
  }, [attemptStrike]);

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
        backgroundColor: 0x0c0905,
        fogColor: 0x0c0905,
        fogDensity: 0.015,
        initialPreset: 'chase',
        gridPrimaryColor: '#f59e0b',
        gridSecondaryColor: '#171108',
        cameraPresets: {
          chase: { position: [0, 8.8, 8.5], lookAt: [0, 0.3, 0], fov: 48 },
          isometric: { position: [7.5, 10.5, 7.5], lookAt: [0, 0.3, 0], fov: 45 },
          diorama: { position: [0, 13.5, 1.2], lookAt: [0, 0, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build Multi-Part 3D Titanium Vault Dial (6 parts)
    const vaultGroup = new THREE.Group();
    const steelMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      metalness: 0.88,
      roughness: 0.22,
      clearcoat: 0.85
    });
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.18,
      clearcoat: 0.9
    });

    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.38, 16, 48), steelMat);
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = 0.4;
    outerRing.castShadow = true;

    const centerHub = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.35, 0.65, 24), goldMat);
    centerHub.position.y = 0.325;
    centerHub.castShadow = true;

    vaultGroup.add(outerRing, centerHub);
    stage.scene.add(vaultGroup);

    // Target Lock Pin Orb
    const targetOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.45, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.95
      })
    );
    stage.scene.add(targetOrb);

    // Rotating Laser Needle Arm
    const needleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.25, 0.9),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.95
      })
    );
    stage.scene.add(needleMesh);

    stage.startLoop((dt, elapsed) => {
      if (gameStateRef.current !== 'playing') return;

      const st = lockRef.current;
      st.needleAngle = (st.needleAngle + st.dir * st.speed * dt + Math.PI * 2) % (Math.PI * 2);

      const nx = Math.cos(st.needleAngle) * 3.1;
      const nz = Math.sin(st.needleAngle) * 3.1;
      needleMesh.position.set(nx, 0.65, nz);
      needleMesh.rotation.y = -st.needleAngle;

      const tx = Math.cos(st.targetAngle) * 3.1;
      const tz = Math.sin(st.targetAngle) * 3.1;
      targetOrb.position.set(tx, 0.68 + Math.sin(elapsed * 6) * 0.08, tz);
      targetOrb.rotation.y = elapsed * 4;
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  return (
    <div
      className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-amber-500/20"
      onClick={attemptStrike}
    >
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-amber-400">
            <Lock className="w-3.5 h-3.5" /> BRANKAS #{vaultLevel}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs font-semibold text-cyan-400 tabular-nums">
          <Unlock className="w-3.5 h-3.5" /> PIN TERSISA: {pinsLeft}
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-amber-400" /> Klik / Tekan Space Tepat Saat Jarum Biru Menyentuh Kristal Emas
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
        title="Neon Lock Breaker 3D"
        description="Buka silinder kombinasi brankas titanium 3D dengan mengetuk tepat saat indikator sejajar dengan pin!"
        themeColor="amber"
      />
    </div>
  );
}
