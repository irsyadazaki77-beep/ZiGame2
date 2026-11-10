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
import { Orbit, Zap } from 'lucide-react';

interface GravityHazard3D {
  mesh: THREE.Group;
  x: number;
  onCeiling: boolean;
  type: 'spike' | 'orb';
}

const CEILING_Y = 4.4;

export default function GravityShiftGame({
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
    gameId: 'gravity-shift',
    onGameOver,
    onScoreUpdate
  });

  const [polarity, setPolarity] = useState<'FLOOR' | 'CEILING'>('FLOOR');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const stateRef = useRef({
    y: 0,
    targetY: 0,
    inverted: false,
    speed: 13.5,
    spawnTimer: 0,
    distAcc: 0
  });

  const hazardsRef = useRef<GravityHazard3D[]>([]);

  const flipGravity = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const s = stateRef.current;
    s.inverted = !s.inverted;
    s.targetY = s.inverted ? CEILING_Y : 0;
    setPolarity(s.inverted ? 'CEILING' : 'FLOOR');
    audio.playJump?.();
    stageRef.current?.kickFov(3.5);
  }, []);

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      hazardsRef.current.forEach((h) => stage.scene.remove(h.mesh));
    }
    hazardsRef.current = [];
    stateRef.current = {
      y: 0,
      targetY: 0,
      inverted: false,
      speed: 13.5,
      spawnTimer: 0.5,
      distAcc: 0
    };
    setPolarity('FLOOR');
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key.toLowerCase() === 'w') {
        flipGravity();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'ACTION_PRIMARY' || action === 'UP' || action === 'DOWN') {
          flipGravity();
        }
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsub();
    };
  }, [flipGravity]);

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
        backgroundColor: 0x050a14,
        fogColor: 0x050a14,
        fogDensity: 0.018,
        initialPreset: 'chase',
        gridPrimaryColor: '#06b6d4',
        gridSecondaryColor: '#081121',
        cameraPresets: {
          chase: { position: [0, 2.3, 11.5], lookAt: [1.5, 2.2, 0], fov: 52 },
          isometric: { position: [-6.5, 6.5, 11.5], lookAt: [1.5, 2.2, 0], fov: 48 },
          diorama: { position: [0, 2.2, 15.5], lookAt: [0, 2.2, 0], fov: 44 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build Upper Ceiling Deck
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.75,
      roughness: 0.35
    });
    const ceilingMesh = new THREE.Mesh(new THREE.BoxGeometry(40, 0.3, 6), ceilingMat);
    ceilingMesh.position.set(0, CEILING_Y + 0.15, 0);
    stage.scene.add(ceilingMesh);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.85
    });
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(40, 0.08, 0.15), railMat);
    topRail.position.set(0, CEILING_Y, 2.2);
    const botRail = topRail.clone();
    botRail.position.set(0, 0.04, 2.2);
    stage.scene.add(topRail, botRail);

    // Build 8-part Cyber Runner Robot
    const hero = buildCyberActionHero3D(0x06b6d4, 0xf43f5e);
    hero.group.rotation.y = Math.PI / 2; // Face +X
    hero.group.position.set(-4.5, 0, 0);
    stage.scene.add(hero.group);

    stage.startLoop((dt, elapsed) => {
      if (gameStateRef.current !== 'playing') return;

      const s = stateRef.current;
      s.speed = Math.min(25, s.speed + dt * 0.35);
      s.distAcc += s.speed * dt;
      if (s.distAcc >= 2.5) {
        const pts = Math.floor(s.distAcc / 2.5);
        s.distAcc -= pts * 2.5;
        addScore(pts);
      }

      s.y = THREE.MathUtils.damp(s.y, s.targetY, 14, dt);
      hero.group.position.set(-4.5, s.y, 0);
      const targetRotZ = s.inverted ? Math.PI : 0;
      hero.group.rotation.z = THREE.MathUtils.damp(hero.group.rotation.z, targetRotZ, 14, dt);

      const swing = Math.sin(elapsed * s.speed * 1.2) * 0.55;
      hero.legL.rotation.x = swing;
      hero.legR.rotation.x = -swing;

      // Spawn hazards
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        s.spawnTimer = Math.max(0.38, 1.05 - (s.speed - 13.5) * 0.035);
        const onCeiling = Math.random() > 0.5;
        const type: GravityHazard3D['type'] = Math.random() < 0.75 ? 'spike' : 'orb';
        const g = new THREE.Group();

        if (type === 'spike') {
          const spikeMat = new THREE.MeshStandardMaterial({
            color: 0xf43f5e,
            emissive: 0xe11d48,
            emissiveIntensity: 0.75,
            roughness: 0.25
          });
          const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 6), spikeMat);
          cone1.position.y = 0.62;
          const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.95, 6), spikeMat);
          cone2.position.set(0.45, 0.48, 0);
          g.add(cone1, cone2);
          if (onCeiling) {
            g.rotation.z = Math.PI;
            g.position.set(16, CEILING_Y, 0);
          } else {
            g.position.set(16, 0, 0);
          }
        } else {
          const orbMat = new THREE.MeshStandardMaterial({
            color: 0x22d3ee,
            emissive: 0x06b6d4,
            emissiveIntensity: 0.9
          });
          const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), orbMat);
          g.add(orb);
          g.position.set(16, onCeiling ? CEILING_Y - 0.85 : 0.85, 0);
        }

        stage.scene.add(g);
        hazardsRef.current.push({ mesh: g, x: 16, onCeiling, type });
      }

      // Update hazards
      for (let i = hazardsRef.current.length - 1; i >= 0; i--) {
        const h = hazardsRef.current[i];
        h.x -= s.speed * dt;
        h.mesh.position.x = h.x;
        if (h.type === 'orb') {
          h.mesh.rotation.y += dt * 4;
        }

        // Check collision with hero at x = -4.5
        if (Math.abs(h.x - -4.5) < 0.72) {
          const sameSide = h.onCeiling ? s.y > CEILING_Y * 0.55 : s.y < CEILING_Y * 0.45;
          if (sameSide) {
            if (h.type === 'orb') {
              stage.scene.remove(h.mesh);
              hazardsRef.current.splice(i, 1);
              addScore(30);
              audio.playCoin?.();
              stage.particles.burst(-4.5, s.y + (s.inverted ? -0.8 : 0.8), 0, 18, 0x22d3ee, 7);
              continue;
            } else {
              stage.scene.remove(h.mesh);
              hazardsRef.current.splice(i, 1);
              stage.particles.burst(-4.5, s.y + (s.inverted ? -0.8 : 0.8), 0, 36, 0xf43f5e, 10);
              stage.triggerTrauma(0.75);
              audio.playExplosion?.();
              triggerGameOver(scoreRef.current);
              return;
            }
          }
        }

        if (h.x < -14) {
          stage.scene.remove(h.mesh);
          hazardsRef.current.splice(i, 1);
        }
      }
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div
      className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-cyan-500/20"
      onClick={flipGravity}
    >
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-cyan-400">
            <Orbit className="w-3.5 h-3.5" /> GRAVITASI: {polarity}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-cyan-400" /> Space / Klik: Balik Gravitasi 3D
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
        title="Gravity Shift 3D"
        description="Balikkan gravitasi antara lantai dan langit-langit koridor luar angkasa 3D untuk menghindari duri plasma!"
        themeColor="cyan"
      />
    </div>
  );
}
