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
import { Hammer, Timer, Zap } from 'lucide-react';

interface DronePod3D {
  index: number;
  x: number;
  z: number;
  active: boolean;
  isGolden: boolean;
  timer: number;
  yOffset: number;
  droneGroup: THREE.Group;
  rotorMesh: THREE.Mesh;
  hitCollider: THREE.Mesh;
}

const POD_STEP = 2.6;

export default function WhackADroneGame({
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
    gameId: 'whack-a-drone',
    onGameOver,
    onScoreUpdate
  });

  const [timeLeft, setTimeLeft] = useState(45);
  const [combo, setCombo] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const stateRef = useRef({
    timeLeft: 45,
    combo: 0,
    spawnTimer: 0.4
  });

  const podsRef = useRef<DronePod3D[]>([]);

  const whackPod = useCallback(
    (pod: DronePod3D) => {
      if (gameStateRef.current !== 'playing' || !pod.active) return;
      pod.active = false;
      pod.timer = 0;
      stateRef.current.combo += 1;
      setCombo(stateRef.current.combo);
      const pts = (pod.isGolden ? 50 : 20) + Math.min(30, stateRef.current.combo * 2);
      addScore(pts);
      audio.playCoin?.();
      const stage = stageRef.current;
      if (stage) {
        stage.particles.burst(
          pod.x,
          0.95,
          pod.z,
          pod.isGolden ? 28 : 18,
          pod.isGolden ? 0xfacc15 : 0xd946ef,
          7.5
        );
        stage.triggerTrauma(0.24);
      }
    },
    [addScore]
  );

  const handleStart = useCallback(() => {
    podsRef.current.forEach((p) => {
      p.active = false;
      p.timer = 0;
      p.yOffset = 0;
    });
    stateRef.current = {
      timeLeft: 45,
      combo: 0,
      spawnTimer: 0.4
    };
    setTimeLeft(45);
    setCombo(0);
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
        backgroundColor: 0x0b0514,
        fogColor: 0x0b0514,
        fogDensity: 0.016,
        initialPreset: 'isometric',
        gridPrimaryColor: '#d946ef',
        gridSecondaryColor: '#130821',
        cameraPresets: {
          isometric: { position: [8.5, 11.5, 8.5], lookAt: [0, 0.3, 0], fov: 45 },
          chase: { position: [0, 8.2, 10.8], lookAt: [0, 0.3, 0], fov: 50 },
          diorama: { position: [0, 14.8, 1.5], lookAt: [0, 0, 0], fov: 46 }
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    const siloMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.82,
      roughness: 0.25,
      clearcoat: 0.8
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd946ef,
      emissive: 0xc026d3,
      emissiveIntensity: 0.65
    });

    const createdPods: DronePod3D[] = [];
    let idx = 0;
    for (let rz = -1; rz <= 1; rz++) {
      for (let rx = -1; rx <= 1; rx++) {
        const px = rx * POD_STEP;
        const pz = rz * POD_STEP;

        // Silo Base Cylinder + Glowing Rim
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.45, 16), siloMat);
        silo.position.set(px, 0.225, pz);
        silo.receiveShadow = true;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.06, 8, 24), rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(px, 0.45, pz);
        stage.scene.add(silo, rim);

        // Multi-part 3D Hacker Drone inside Silo
        const droneGroup = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.SphereGeometry(0.48, 14, 12),
          new THREE.MeshStandardMaterial({
            color: 0xd946ef,
            emissive: 0xa21caf,
            emissiveIntensity: 0.5,
            roughness: 0.22,
            metalness: 0.65
          })
        );
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 10),
          new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfacc15,
            emissiveIntensity: 0.95
          })
        );
        eye.position.set(0, 0.08, 0.42);
        const rotorMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.95, 0.05, 0.14),
          new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
        );
        rotorMesh.position.y = 0.52;
        droneGroup.add(body, eye, rotorMesh);
        droneGroup.position.set(px, -0.4, pz);
        stage.scene.add(droneGroup);

        // Invisible generous raycast hit box
        const hitCollider = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 0.95, 1.8, 12),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hitCollider.position.set(px, 0.8, pz);
        stage.scene.add(hitCollider);

        const pod: DronePod3D = {
          index: idx++,
          x: px,
          z: pz,
          active: false,
          isGolden: false,
          timer: 0,
          yOffset: -0.4,
          droneGroup,
          rotorMesh,
          hitCollider
        };
        hitCollider.userData.pod = pod;
        createdPods.push(pod);
      }
    }
    podsRef.current = createdPods;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, stage.camera);
      const hits = raycaster.intersectObjects(
        createdPods.map((p) => p.hitCollider),
        false
      );
      if (hits.length > 0) {
        const hitPod = hits[0].object.userData.pod as DronePod3D | undefined;
        if (hitPod && hitPod.active) {
          whackPod(hitPod);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      // Number keys 1-9 or Space whack active drone
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        const pod = createdPods[n - 1];
        if (pod && pod.active) whackPod(pod);
      } else if (e.key === ' ') {
        const activePod = createdPods.find((p) => p.active);
        if (activePod) whackPod(activePod);
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    stage.startLoop((dt) => {
      if (gameStateRef.current !== 'playing') return;

      const st = stateRef.current;
      st.timeLeft -= dt;
      setTimeLeft(Math.max(0, Math.ceil(st.timeLeft)));
      if (st.timeLeft <= 0) {
        triggerGameOver(scoreRef.current);
        return;
      }

      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0) {
        st.spawnTimer = 0.42 + Math.random() * 0.35;
        const inactive = createdPods.filter((p) => !p.active);
        if (inactive.length > 0) {
          const pick = inactive[Math.floor(Math.random() * inactive.length)];
          pick.active = true;
          pick.isGolden = Math.random() < 0.2;
          pick.timer = 0.95 + Math.random() * 0.45;
          const bodyMesh = pick.droneGroup.children[0] as THREE.Mesh;
          const mat = bodyMesh.material as THREE.MeshStandardMaterial;
          mat.color.setHex(pick.isGolden ? 0xfacc15 : 0xd946ef);
          mat.emissive.setHex(pick.isGolden ? 0xeab308 : 0xa21caf);
        }
      }

      for (const p of createdPods) {
        p.rotorMesh.rotation.y += dt * 18;
        if (p.active) {
          p.timer -= dt;
          if (p.timer <= 0) {
            p.active = false;
            st.combo = 0;
            setCombo(0);
          }
        }
        const targetY = p.active ? 0.92 : -0.45;
        p.yOffset = THREE.MathUtils.damp(p.yOffset, targetY, 14, dt);
        p.droneGroup.position.y = p.yOffset;
      }
    });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      stage.dispose();
      stageRef.current = null;
    };
  }, [scoreRef, triggerGameOver, whackPod]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 overflow-hidden rounded-2xl border border-fuchsia-500/20">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-pointer" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3.5">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-slate-200 tabular-nums">
          <span className="flex items-center gap-1 font-semibold text-fuchsia-400">
            <Hammer className="w-3.5 h-3.5" /> SKOR: {score}
          </span>
          {combo > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400 font-semibold">{combo}x COMBO</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/85 px-3.5 py-2 text-xs text-cyan-400 font-semibold tabular-nums">
          <Timer className="w-3.5 h-3.5" /> {timeLeft}s
        </div>
      </div>

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={handleSelectPreset}
        quality={quality}
        onCycleQuality={handleCycleQuality}
        extraControls={
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 whitespace-nowrap shrink-0">
            <Zap className="w-3 h-3 text-fuchsia-400" /> Klik Drone 3D atau Tekan Angka 1–9 / Space
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
        title="Whack-a-Drone 3D"
        description="Hantam drone peretas 3D yang menyembul dari silo server sebelum mereka melarikan diri!"
        themeColor="fuchsia"
      />
    </div>
  );
}
