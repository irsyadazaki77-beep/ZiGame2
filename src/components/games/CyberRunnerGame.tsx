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
import { Zap, Shield, Flame } from 'lucide-react';

interface RunnerObstacle3D {
  mesh: THREE.Group;
  lane: number; // -1, 0, 1
  z: number;
  type: 'hurdle' | 'drone' | 'coin' | 'boost';
  passed: boolean;
}

const LANE_WIDTH = 2.4;

function buildObstacleMesh3D(type: RunnerObstacle3D['type']): THREE.Group {
  const g = new THREE.Group();
  if (type === 'hurdle') {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const laserMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.95
    });
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.1, 8), postMat);
    postL.position.set(-0.85, 0.55, 0);
    const postR = postL.clone();
    postR.position.x = 0.85;
    const beam1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 8), laserMat);
    beam1.rotation.z = Math.PI / 2;
    beam1.position.y = 0.45;
    const beam2 = beam1.clone();
    beam2.position.y = 0.88;
    g.add(postL, postR, beam1, beam2);
  } else if (type === 'drone') {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf97316, metalness: 0.7, roughness: 0.25 });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.95
    });
    const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 1), bodyMat);
    hull.position.y = 1.65;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), eyeMat);
    eye.position.set(0, 1.65, 0.42);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.05, 8, 20),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.65;
    g.add(hull, eye, ring);
  } else if (type === 'coin') {
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.8,
      metalness: 0.85,
      roughness: 0.15
    });
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16), coinMat);
    coin.rotation.x = Math.PI / 2;
    coin.position.y = 0.85;
    g.add(coin);
  } else {
    const boostMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.9
    });
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), boostMat);
    orb.position.y = 0.9;
    g.add(orb);
  }
  return g;
}

export default function CyberRunnerGame({
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
    gameId: 'cyber-runner',
    onGameOver,
    onScoreUpdate
  });

  const [speedKmh, setSpeedKmh] = useState(120);
  const [hasShield, setHasShield] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const runnerRef = useRef({
    lane: 0,
    x: 0,
    y: 0,
    vy: 0,
    isJumping: false,
    isSliding: false,
    slideTimer: 0,
    speed: 15,
    shield: false,
    spawnTimer: 0,
    distanceAcc: 0
  });

  const obstaclesRef = useRef<RunnerObstacle3D[]>([]);

  const handleStart = useCallback(() => {
    const stage = stageRef.current;
    if (stage) {
      obstaclesRef.current.forEach((o) => stage.scene.remove(o.mesh));
    }
    obstaclesRef.current = [];
    runnerRef.current = {
      lane: 0,
      x: 0,
      y: 0,
      vy: 0,
      isJumping: false,
      isSliding: false,
      slideTimer: 0,
      speed: 15,
      shield: false,
      spawnTimer: 0.4,
      distanceAcc: 0
    };
    setSpeedKmh(120);
    setHasShield(false);
    startWithCountdown();
  }, [startWithCountdown]);

  const shiftLane = useCallback((dir: -1 | 1) => {
    if (gameStateRef.current !== 'playing') return;
    const r = runnerRef.current;
    r.lane = Math.max(-1, Math.min(1, r.lane + dir));
  }, []);

  const triggerJump = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const r = runnerRef.current;
    if (!r.isJumping) {
      r.isJumping = true;
      r.isSliding = false;
      r.vy = 11.5;
      audio.playJump?.();
    }
  }, []);

  const triggerSlide = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const r = runnerRef.current;
    r.isSliding = true;
    r.slideTimer = 0.65;
    if (r.isJumping) {
      r.vy = -14;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') shiftLane(-1);
      else if (k === 'arrowright' || k === 'd') shiftLane(1);
      else if (k === 'arrowup' || k === 'w' || k === ' ') triggerJump();
      else if (k === 'arrowdown' || k === 's') triggerSlide();
    };
    window.addEventListener('keydown', onKeyDown);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') shiftLane(-1);
        if (action === 'RIGHT') shiftLane(1);
        if (action === 'UP' || action === 'ACTION_PRIMARY') triggerJump();
        if (action === 'DOWN') triggerSlide();
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsub();
    };
  }, [shiftLane, triggerJump, triggerSlide]);

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
        backgroundColor: 0x090714,
        fogColor: 0x090714,
        fogDensity: 0.022,
        initialPreset: 'chase',
        gridPrimaryColor: '#f97316',
        gridSecondaryColor: '#0c0a1a',
        cameraPresets: {
          chase: { position: [0, 4.2, 8.2], lookAt: [0, 1.2, -6], fov: 60 },
          isometric: { position: [7.5, 8.5, 7.5], lookAt: [0, 0.8, -3], fov: 48 },
          diorama: { position: [0, 14.5, 4.0], lookAt: [0, 0, -4], fov: 50 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Build 3-Lane Highway Guide Rails
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 0.75
    });
    [-3.8, -1.2, 1.2, 3.8].forEach((rx) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 60), railMat);
      rail.position.set(rx, 0.03, -15);
      stage.scene.add(rail);
    });

    // Build 8-part Cyber Hero
    const hero = buildCyberActionHero3D(0xf97316, 0x22d3ee);
    hero.group.rotation.y = Math.PI; // Face forward (-Z)
    hero.group.position.set(0, 0, 2.5);
    stage.scene.add(hero.group);

    stage.startLoop((dt, elapsed) => {
      if (gameStateRef.current !== 'playing') return;

      const r = runnerRef.current;
      r.speed = Math.min(32, r.speed + dt * 0.45);
      r.distanceAcc += r.speed * dt;
      if (r.distanceAcc >= 3) {
        const pts = Math.floor(r.distanceAcc / 3);
        r.distanceAcc -= pts * 3;
        addScore(pts);
        setSpeedKmh(Math.round(r.speed * 8.5));
      }

      // Smooth lateral lane transition
      const targetX = r.lane * LANE_WIDTH;
      r.x = THREE.MathUtils.damp(r.x, targetX, 12, dt);

      // Jump physics
      if (r.isJumping) {
        r.y += r.vy * dt;
        r.vy -= 28 * dt;
        if (r.y <= 0) {
          r.y = 0;
          r.vy = 0;
          r.isJumping = false;
        }
      }

      // Slide timer
      if (r.isSliding) {
        r.slideTimer -= dt;
        if (r.slideTimer <= 0) {
          r.isSliding = false;
        }
      }

      // Animate Hero
      hero.group.position.set(r.x, r.y, 2.5);
      hero.group.scale.y = r.isSliding ? 0.52 : 1.0;
      hero.group.rotation.z = (targetX - r.x) * -0.18;

      const stride = Math.sin(elapsed * r.speed * 1.1) * 0.65;
      hero.legL.rotation.x = r.isJumping ? 0.4 : stride;
      hero.legR.rotation.x = r.isJumping ? -0.4 : -stride;
      hero.armL.rotation.x = -stride * 0.8;
      hero.armR.rotation.x = stride * 0.8;

      stage.setFollowTarget(r.x, r.y * 0.3, 0, 0.45);

      // Spawn obstacles & coins
      r.spawnTimer -= dt;
      if (r.spawnTimer <= 0) {
        r.spawnTimer = Math.max(0.32, 0.95 - (r.speed - 15) * 0.025);
        const lane = Math.floor(Math.random() * 3) - 1;
        const roll = Math.random();
        const type: RunnerObstacle3D['type'] =
          roll < 0.42 ? 'hurdle' : roll < 0.72 ? 'drone' : roll < 0.92 ? 'coin' : 'boost';

        const mesh = buildObstacleMesh3D(type);
        mesh.position.set(lane * LANE_WIDTH, 0, -34);
        stage.scene.add(mesh);
        obstaclesRef.current.push({ mesh, lane, z: -34, type, passed: false });
      }

      // Update obstacles
      for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
        const o = obstaclesRef.current[i];
        o.z += r.speed * dt;
        o.mesh.position.z = o.z;
        if (o.type === 'coin' || o.type === 'boost') {
          o.mesh.rotation.y += dt * 4;
        }

        // Collision check around z = 2.5
        if (Math.abs(o.z - 2.5) < 0.72 && Math.abs(o.lane * LANE_WIDTH - r.x) < 0.85) {
          if (o.type === 'coin') {
            stage.scene.remove(o.mesh);
            obstaclesRef.current.splice(i, 1);
            addScore(25);
            audio.playCoin?.();
            stage.particles.burst(r.x, r.y + 0.9, 2.5, 16, 0xfacc15, 6);
            continue;
          }
          if (o.type === 'boost') {
            stage.scene.remove(o.mesh);
            obstaclesRef.current.splice(i, 1);
            r.shield = true;
            setHasShield(true);
            addScore(40);
            audio.playPowerUp?.();
            stage.particles.burst(r.x, r.y + 0.9, 2.5, 22, 0x22d3ee, 8);
            stage.kickFov(6);
            continue;
          }

          // Hurdle requires jumping (y > 0.75); Drone requires sliding (isSliding)
          const hitHurdle = o.type === 'hurdle' && r.y < 0.72;
          const hitDrone = o.type === 'drone' && !r.isSliding;

          if (hitHurdle || hitDrone) {
            stage.scene.remove(o.mesh);
            obstaclesRef.current.splice(i, 1);
            if (r.shield) {
              r.shield = false;
              setHasShield(false);
              stage.particles.burst(r.x, r.y + 0.8, 2.5, 28, 0x22d3ee, 9);
              stage.triggerTrauma(0.45);
            } else {
              stage.particles.burst(r.x, r.y + 0.8, 2.5, 38, 0xef4444, 11);
              stage.triggerTrauma(0.75);
              audio.playExplosion?.();
              triggerGameOver(scoreRef.current);
              return;
            }
            continue;
          }
        }

        if (o.z > 8) {
          stage.scene.remove(o.mesh);
          obstaclesRef.current.splice(i, 1);
        }
      }
    });

    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-orange-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-orange-400">
            <Flame className="w-3.5 h-3.5" /> {speedKmh} KM/H
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        {hasShield && (
          <div className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-slate-950/85 px-3.5 py-2 text-xs font-semibold text-cyan-400">
            <Shield className="w-3.5 h-3.5" /> PERISAI AKTIF
          </div>
        )}
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-orange-400" /> A/D: Jalur · W/Space: Lompat · S: Meluncur
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
        title="Cyber Runner 3D"
        description="Berlari di jalan layang siber 3D! Lompati pagar laser merah dan meluncur di bawah drone patroli."
        themeColor="orange"
      />
    </div>
  );
}
