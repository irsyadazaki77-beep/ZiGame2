import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk';
import { useGameEngine } from '../../hooks/useGameEngine';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import {
  ThreeStageController,
  CameraPreset3D,
  QualityLevel3D,
  buildCyberActionHero3D,
  buildGroundShadowRing3D,
  createHoloLabelSprite3D,
  updateHoloLabelSprite3D,
  dampValue
} from '../../utils/threeStage';
import { Zap, Flame } from 'lucide-react';

export default function JumpRopeGame({
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
    gameId: 'jump-rope',
    onGameOver,
    onScoreUpdate
  });

  const [jumps, setJumps] = useState(0);
  const [rpm, setRpm] = useState(60);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const ropeStateRef = useRef({
    y: 0,
    vy: 0,
    jumping: false,
    ropeAngle: 0,
    ropeSpeed: 3.4,
    jumps: 0,
    scoredThisCycle: false,
    scaleY: 1,
    scaleXZ: 1,
    bannerTimer: 0
  });

  const jump = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const st = ropeStateRef.current;
    if (!st.jumping) {
      st.jumping = true;
      st.vy = 9.8;
      st.scaleY = 1.26;
      st.scaleXZ = 0.84;
      audioController.playJump();
    }
  }, []);

  const handleStart = useCallback(() => {
    ropeStateRef.current = {
      y: 0,
      vy: 0,
      jumping: false,
      ropeAngle: Math.PI,
      ropeSpeed: 3.4,
      jumps: 0,
      scoredThisCycle: false,
      scaleY: 1,
      scaleXZ: 1,
      bannerTimer: 0
    };
    setJumps(0);
    setRpm(60);
    startWithCountdown();
  }, [startWithCountdown]);

  useEffect(() => {
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'PRIMARY' || action === 'ACTION_PRIMARY' || action === 'UP') {
          jump();
        }
      }
    });

    return () => {
      unsub();
    };
  }, [jump]);

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
        backgroundColor: 0x05100a,
        fogColor: 0x05100a,
        fogDensity: 0.016,
        initialPreset: 'chase',
        gridPrimaryColor: '#22c55e',
        gridSecondaryColor: '#07170e',
        cameraPresets: {
          chase: { position: [0, 3.8, 9.2], lookAt: [0, 1.4, 0], fov: 50 },
          isometric: { position: [6.8, 6.8, 7.8], lookAt: [0, 1.2, 0], fov: 46 },
          diorama: { position: [0, 9.5, 5.5], lookAt: [0, 0.8, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const pylonMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.22,
      clearcoat: 0.85
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x4ade80,
      emissiveIntensity: 0.95
    });

    const buildEmitterPylon = (xPos: number) => {
      const g = new THREE.Group();
      g.position.set(xPos, 0, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.72, 0.35, 8), pylonMat);
      base.position.y = 0.175;
      base.castShadow = true;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 2.1, 12), pylonMat);
      shaft.position.y = 1.25;
      shaft.castShadow = true;
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 8, 20), glowMat);
      ring1.rotation.x = Math.PI / 2;
      ring1.position.y = 0.85;
      const ring2 = ring1.clone();
      ring2.position.y = 1.85;
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), glowMat);
      orb.position.y = 2.52;
      g.add(base, shaft, ring1, ring2, orb);
      return { g, orb };
    };

    const pylonL = buildEmitterPylon(-3.4);
    const pylonR = buildEmitterPylon(3.4);
    stage.scene.add(pylonL.g, pylonR.g);

    const ropePivot = new THREE.Group();
    ropePivot.position.set(0, 1.45, 0);
    const ropeArc = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.075, 12, 42, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x4ade80,
        emissiveIntensity: 1.25
      })
    );
    ropeArc.rotation.z = Math.PI;

    const trailArc = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.045, 10, 36, Math.PI),
      new THREE.MeshBasicMaterial({
        color: 0x86efac,
        transparent: true,
        opacity: 0.42
      })
    );
    trailArc.rotation.z = Math.PI;
    trailArc.rotation.x = -0.24;

    ropePivot.add(ropeArc, trailArc);
    stage.scene.add(ropePivot);

    const shadowRing = buildGroundShadowRing3D(0.85, 0x22c55e);
    stage.scene.add(shadowRing.group);

    const hero = buildCyberActionHero3D(0x22c55e, 0xfacc15);
    hero.group.position.set(0, 0, 0);
    stage.scene.add(hero.group);

    const comboSprite = createHoloLabelSprite3D('PERFECT!', {
      borderColor: '#4ade80',
      textColor: '#facc15',
      scaleX: 2.2,
      scaleY: 0.62
    });
    comboSprite.position.set(0, 2.75, 0);
    comboSprite.visible = false;
    stage.scene.add(comboSprite);

    stage.startLoop((dt, elapsed) => {
      pylonL.orb.rotation.y = elapsed * 2.8;
      pylonR.orb.rotation.y = -elapsed * 2.8;

      if (gameStateRef.current !== 'playing') return;

      const st = ropeStateRef.current;
      st.ropeSpeed = Math.min(8.5, st.ropeSpeed + dt * 0.09);
      const prevAngle = st.ropeAngle;
      st.ropeAngle = (st.ropeAngle + st.ropeSpeed * dt) % (Math.PI * 2);

      ropePivot.rotation.x = st.ropeAngle;

      if (st.jumping) {
        st.y += st.vy * dt;
        st.vy -= 26 * dt;
        if (st.y <= 0) {
          st.y = 0;
          st.vy = 0;
          st.jumping = false;
          // Squash on landing
          st.scaleY = 0.78;
          st.scaleXZ = 1.22;
        }
      }

      st.scaleY = dampValue(st.scaleY, 1.0, 14, dt);
      st.scaleXZ = dampValue(st.scaleXZ, 1.0, 14, dt);

      hero.group.position.set(0, st.y, 0);
      hero.group.scale.set(st.scaleXZ, st.scaleY, st.scaleXZ);
      hero.armL.rotation.x = dampValue(hero.armL.rotation.x, st.jumping ? -1.15 : 0, 16, dt);
      hero.armR.rotation.x = dampValue(hero.armR.rotation.x, st.jumping ? -1.15 : 0, 16, dt);
      hero.legL.rotation.x = dampValue(hero.legL.rotation.x, st.jumping ? 0.55 : 0, 16, dt);
      hero.legR.rotation.x = dampValue(hero.legR.rotation.x, st.jumping ? -0.45 : 0, 16, dt);

      const shadowScale = Math.max(0.42, 1 - st.y * 0.25);
      shadowRing.group.scale.setScalar(shadowScale);

      if (st.bannerTimer > 0) {
        st.bannerTimer -= dt;
        comboSprite.position.y = 2.65 + (0.65 - st.bannerTimer) * 0.6;
        if (st.bannerTimer <= 0) {
          comboSprite.visible = false;
        }
      }

      if (prevAngle > Math.PI * 1.5 && st.ropeAngle < Math.PI * 0.5) {
        if (st.y < 0.48) {
          stage.particles.burst(0, 0.4, 0, 38, 0xef4444, 9.5);
          stage.triggerShockwave(0, 0.08, 0, 0xef4444, 4.2, 0.45);
          stage.triggerTrauma(0.75);
          audioController.playExplosion();
          audioController.playGameOver();
          triggerGameOver(scoreRef.current);
          return;
        } else {
          st.jumps += 1;
          const isPerfect = st.y >= 0.72;
          setJumps(st.jumps);
          setRpm(Math.round(st.ropeSpeed * 18));
          addScore(20 + st.jumps * 2 + (isPerfect ? 15 : 0));
          stage.particles.burst(0, 0.15, 0, isPerfect ? 26 : 18, 0x22c55e, 7.2);
          stage.triggerShockwave(0, 0.08, 0, isPerfect ? 0xfacc15 : 0x22c55e, 3.2, 0.38);
          stage.triggerTrauma(0.18);
          if (isPerfect) {
            updateHoloLabelSprite3D(comboSprite, `PERFECT x${st.jumps}!`, {
              borderColor: '#4ade80',
              textColor: '#facc15'
            });
            comboSprite.visible = true;
            st.bannerTimer = 0.65;
          }
          audioController.playScore();
        }
      }
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-emerald-500/20 touch-none select-none">
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-pointer touch-none"
        onPointerDown={jump}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-emerald-400">
            <Flame className="w-3.5 h-3.5" /> LOMPATAN: {jumps}
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-amber-400 tabular-nums">
          KECEPATAN: {rpm} RPM
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-emerald-400" /> Space / Klik Tepat Saat Tali Plasma Mengayun ke Bawah
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
        title="Neon Jump Rope 3D"
        description="Lompati ayunan tali laser 360 derajat di panggung 3D dengan ketepatan waktu sempurna!"
        themeColor="emerald"
      />
    </div>
  );
}
