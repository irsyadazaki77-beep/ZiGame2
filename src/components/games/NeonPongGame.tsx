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
  QualityLevel3D
} from '../../utils/threeStage';
import { Zap, Trophy } from 'lucide-react';

const TABLE_HALF_W = 6.2;
const TABLE_HALF_Z = 7.2;

export default function NeonPongGame({
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
    gameId: 'neon-pong',
    onGameOver,
    onScoreUpdate
  });

  const [playerGoals, setPlayerGoals] = useState(0);
  const [aiGoals, setAiGoals] = useState(0);
  const [rally, setRally] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const pongRef = useRef({
    playerX: 0,
    aiX: 0,
    puckX: 0,
    puckZ: 0,
    vx: 6.5,
    vz: -10.5,
    rally: 0,
    playerGoals: 0,
    aiGoals: 0
  });

  const moveDirRef = useRef({ left: false, right: false });

  const handleStart = useCallback(() => {
    pongRef.current = {
      playerX: 0,
      aiX: 0,
      puckX: 0,
      puckZ: 0,
      vx: 6.5 * (Math.random() > 0.5 ? 1 : -1),
      vz: -10.5,
      rally: 0,
      playerGoals: 0,
      aiGoals: 0
    };
    moveDirRef.current = { left: false, right: false };
    setPlayerGoals(0);
    setAiGoals(0);
    setRally(0);
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
        if (action === 'LEFT') moveDirRef.current.left = true;
        if (action === 'RIGHT') moveDirRef.current.right = true;
      },
      onActionUp: (action) => {
        if (action === 'LEFT') moveDirRef.current.left = false;
        if (action === 'RIGHT') moveDirRef.current.right = false;
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
        backgroundColor: 0x050a18,
        fogColor: 0x050a18,
        fogDensity: 0.015,
        initialPreset: 'chase',
        gridPrimaryColor: '#3b82f6',
        gridSecondaryColor: '#070f24',
        cameraPresets: {
          chase: { position: [0, 8.2, 12.8], lookAt: [0, 0.2, 0], fov: 50 },
          isometric: { position: [9.5, 11.8, 9.5], lookAt: [0, 0.2, 0], fov: 46 },
          diorama: { position: [0, 16.5, 1.5], lookAt: [0, 0, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const tableDeck = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_HALF_W * 2, 0.08, TABLE_HALF_Z * 2),
      new THREE.MeshPhysicalMaterial({
        color: 0x060f24,
        metalness: 0.85,
        roughness: 0.2,
        clearcoat: 0.9
      })
    );
    tableDeck.position.y = -0.02;
    tableDeck.receiveShadow = true;

    const railMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 0.75
    });
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.52, TABLE_HALF_Z * 2 + 1), railMat);
    wallL.position.set(-TABLE_HALF_W - 0.13, 0.25, 0);
    const wallR = wallL.clone();
    wallR.position.x = TABLE_HALF_W + 0.13;
    const centerLine = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_HALF_W * 2, 0.04, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    centerLine.position.y = 0.025;

    const centerRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.055, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    centerRing.rotation.x = Math.PI / 2;
    centerRing.position.y = 0.03;

    const postGeo = new THREE.CylinderGeometry(0.26, 0.32, 0.75, 12);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, railMat);
        post.position.set(sx * (TABLE_HALF_W + 0.13), 0.375, sz * TABLE_HALF_Z);
        stage.scene.add(post);
      }
    }

    stage.scene.add(tableDeck, wallL, wallR, centerLine, centerRing);

    const playerPaddle = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.42, 0.45),
      new THREE.MeshPhysicalMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.75,
        metalness: 0.7,
        roughness: 0.2,
        clearcoat: 0.9
      })
    );
    playerPaddle.position.set(0, 0.21, TABLE_HALF_Z - 0.5);
    playerPaddle.castShadow = true;

    const aiPaddle = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.42, 0.45),
      new THREE.MeshPhysicalMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.75,
        metalness: 0.7,
        roughness: 0.2,
        clearcoat: 0.9
      })
    );
    aiPaddle.position.set(0, 0.21, -(TABLE_HALF_Z - 0.5));
    aiPaddle.castShadow = true;

    const puck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.24, 20),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 1.1
      })
    );
    puck.position.set(0, 0.16, 0);
    puck.castShadow = true;

    // 10-Segment Instanced Puck Motion Trail
    const trailCount = 10;
    const trailInst = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.38
      }),
      trailCount
    );
    trailInst.frustumCulled = false;
    const trailPts: { x: number; z: number }[] = Array.from({ length: trailCount }, () => ({
      x: 0,
      z: 0
    }));
    const dummyMat = new THREE.Matrix4();

    stage.scene.add(playerPaddle, aiPaddle, puck, trailInst);

    const updatePaddleFromPointer = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pongRef.current.playerX = THREE.MathUtils.clamp(
        nx * (TABLE_HALF_W - 1.15),
        -(TABLE_HALF_W - 1.15),
        TABLE_HALF_W - 1.15
      );
    };
    container.addEventListener('pointerdown', updatePaddleFromPointer);
    container.addEventListener('pointermove', updatePaddleFromPointer);

    stage.startLoop((dt) => {
      if (gameStateRef.current !== 'playing') return;

      const p = pongRef.current;
      if (moveDirRef.current.left) p.playerX -= 12.5 * dt;
      if (moveDirRef.current.right) p.playerX += 12.5 * dt;
      p.playerX = THREE.MathUtils.clamp(p.playerX, -(TABLE_HALF_W - 1.15), TABLE_HALF_W - 1.15);

      const aiSpeed = 8.4;
      if (p.aiX < p.puckX - 0.2) p.aiX += aiSpeed * dt;
      else if (p.aiX > p.puckX + 0.2) p.aiX -= aiSpeed * dt;
      p.aiX = THREE.MathUtils.clamp(p.aiX, -(TABLE_HALF_W - 1.15), TABLE_HALF_W - 1.15);

      playerPaddle.position.x = p.playerX;
      aiPaddle.position.x = p.aiX;
      stage.setFollowTarget(p.playerX, 0, 0, 0.22);

      p.puckX += p.vx * dt;
      p.puckZ += p.vz * dt;

      if (p.puckX < -TABLE_HALF_W + 0.4) {
        p.puckX = -TABLE_HALF_W + 0.4;
        p.vx = Math.abs(p.vx);
        stage.particles.burst(p.puckX, 0.25, p.puckZ, 8, 0x3b82f6, 4.5);
        audioController.playClick();
      } else if (p.puckX > TABLE_HALF_W - 0.4) {
        p.puckX = TABLE_HALF_W - 0.4;
        p.vx = -Math.abs(p.vx);
        stage.particles.burst(p.puckX, 0.25, p.puckZ, 8, 0x3b82f6, 4.5);
        audioController.playClick();
      }

      const pZ = TABLE_HALF_Z - 0.5;
      if (p.vz > 0 && Math.abs(p.puckZ - pZ) < 0.48 && Math.abs(p.puckX - p.playerX) < 1.38) {
        const offset = (p.puckX - p.playerX) / 1.15;
        p.vz = -Math.min(18, Math.abs(p.vz) * 1.05);
        p.vx = offset * 10.5;
        p.rally += 1;
        setRally(p.rally);
        addScore(15 + p.rally * 2);
        playerPaddle.scale.set(1.16, 1.25, 0.78);
        stage.particles.burst(p.puckX, 0.3, pZ, 18, 0x22d3ee, 6.8);
        stage.triggerShockwave(p.puckX, pZ, 0x22d3ee, 2.5);
        stage.triggerTrauma(0.2);
        audioController.playReflect();
      }

      const aZ = -(TABLE_HALF_Z - 0.5);
      if (p.vz < 0 && Math.abs(p.puckZ - aZ) < 0.48 && Math.abs(p.puckX - p.aiX) < 1.38) {
        const offset = (p.puckX - p.aiX) / 1.15;
        p.vz = Math.min(18, Math.abs(p.vz) * 1.04);
        p.vx = offset * 9.5;
        aiPaddle.scale.set(1.16, 1.25, 0.78);
        stage.particles.burst(p.puckX, 0.3, aZ, 16, 0xf43f5e, 6.5);
        stage.triggerShockwave(p.puckX, aZ, 0xf43f5e, 2.5);
        audioController.playReflect();
      }

      playerPaddle.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 14));
      aiPaddle.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 14));

      if (p.puckZ < -TABLE_HALF_Z - 0.6) {
        p.playerGoals += 1;
        setPlayerGoals(p.playerGoals);
        addScore(100);
        stage.particles.burst(p.puckX, 0.5, -TABLE_HALF_Z, 34, 0x22d3ee, 9.5);
        stage.triggerShockwave(p.puckX, -TABLE_HALF_Z, 0x22d3ee, 4.5);
        stage.triggerTrauma(0.45);
        stage.kickFov(4);
        audioController.playWin();
        p.puckX = 0;
        p.puckZ = 0;
        p.vz = 10.5;
        p.vx = (Math.random() - 0.5) * 8;
      }

      if (p.puckZ > TABLE_HALF_Z + 0.6) {
        p.aiGoals += 1;
        setAiGoals(p.aiGoals);
        p.rally = 0;
        setRally(0);
        stage.particles.burst(p.puckX, 0.5, TABLE_HALF_Z, 34, 0xef4444, 9.5);
        stage.triggerShockwave(p.puckX, TABLE_HALF_Z, 0xef4444, 4.5);
        stage.triggerTrauma(0.65);
        audioController.playHit();
        if (p.aiGoals >= 5) {
          audioController.playGameOver();
          triggerGameOver(scoreRef.current);
          return;
        }
        p.puckX = 0;
        p.puckZ = 0;
        p.vz = -10.5;
        p.vx = (Math.random() - 0.5) * 8;
      }

      puck.position.set(p.puckX, 0.16, p.puckZ);

      // Update Puck Motion Trail
      trailPts.pop();
      trailPts.unshift({ x: p.puckX, z: p.puckZ });
      for (let tIdx = 0; tIdx < trailCount; tIdx++) {
        const pt = trailPts[tIdx];
        const s = Math.max(0.18, 1 - tIdx / trailCount) * 0.85;
        dummyMat.makeScale(s, 1, s);
        dummyMat.setPosition(pt.x, 0.08, pt.z);
        trailInst.setMatrixAt(tIdx, dummyMat);
      }
      trailInst.instanceMatrix.needsUpdate = true;
    });

    return () => {
      container.removeEventListener('pointerdown', updatePaddleFromPointer);
      container.removeEventListener('pointermove', updatePaddleFromPointer);
      stage.dispose();
      stageRef.current = null;
    };
  }, [addScore, scoreRef, triggerGameOver]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-blue-500/20 touch-none select-none">
      <div ref={mountRef} className="absolute inset-0 w-full h-full touch-none" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-3.5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-cyan-400">
            <Trophy className="w-3.5 h-3.5" /> ANDA {playerGoals} - {aiGoals} AI
          </span>
          <span aria-hidden="true">·</span>
          <span>SKOR: <strong className="text-white">{score}</strong></span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs text-amber-400 font-semibold tabular-nums">
          RALLY: {rally}x
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-blue-400" /> Geser Mouse / Sentuh / Panah Kiri-Kanan untuk Paddle 3D
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
        title="Neon Pong 3D"
        description="Adu refleks di meja Air-Hockey Neon 3D melawan AI taktis! Cetak gol dan pertahankan reli pantulan."
        themeColor="blue"
      />
    </div>
  );
}
