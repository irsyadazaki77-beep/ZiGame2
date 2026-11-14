import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { audioController, ObjectPool, useGameEngine } from '../../sdk';
import { inputManager } from '../../services/inputService';
import {
  ThreeStageController,
  createWetAsphaltMaps,
  followDirectionalShadow,
  type CameraPreset3D,
  type QualityLevel3D
} from '../../utils/threeStage';
import { screenShake } from '../../utils/screenShake';
import { haptics } from '../../utils/haptics';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import { Target, Wind, Sparkles, Crosshair } from 'lucide-react';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

interface FlyingArrow3D {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
  trailAcc: number;
  life: number;
}

interface TrailSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  life: number;
  maxLife: number;
}

const TRAIL_CAPACITY = 84;
const _camTargetPos = new THREE.Vector3(0, 2.1, 3.2);
const _camSmoothPos = new THREE.Vector3(0, 2.1, 3.2);
const _camLook = new THREE.Vector3(0, 2.2, -22);
const _lookAhead = new THREE.Vector3();
const _trailDummy = new THREE.Object3D();
const _lampOffset = new THREE.Vector3(6, 15, 10);

function createTargetFaceTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);
  const cx = 256;
  const cy = 256;

  const rings = [
    { r: 248, color: '#f8fafc' },
    { r: 200, color: '#0f172a' },
    { r: 150, color: '#06b6d4' },
    { r: 100, color: '#ef4444' },
    { r: 48, color: '#facc15' }
  ];

  for (const ring of rings) {
    ctx.fillStyle = ring.color;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function buildArrowMesh(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.78, roughness: 0.2 })
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.castShadow = true;
  g.add(shaft);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.044, 0.2, 8),
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.7,
      roughness: 0.2
    })
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.75;
  g.add(tip);

  const fletchingMat = new THREE.MeshStandardMaterial({
    color: 0xf43f5e,
    emissive: 0xec4899,
    emissiveIntensity: 1.55,
    roughness: 0.25
  });
  const fletching = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.02, 0.22),
    fletchingMat
  );
  fletching.position.z = 0.56;
  const fletchingV = fletching.clone();
  fletchingV.rotation.z = Math.PI / 2;
  g.add(fletching, fletchingV);

  return g;
}

function buildCompoundBow(): {
  group: THREE.Group;
  nockedArrow: THREE.Group;
  sightMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();

  const riserMat = new THREE.MeshPhysicalMaterial({
    color: 0x0891b2,
    metalness: 0.85,
    roughness: 0.2,
    clearcoat: 1.0
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.32
  });
  const camMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.18
  });
  const sightMat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.9,
    roughness: 0.15
  });

  // 1. Sculpted Center Riser (RoundedBoxGeometry)
  const riser = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.76, 0.13, 3, 0.02), riserMat);
  riser.castShadow = true;
  group.add(riser);

  // 2. Upper & Lower Composite Limbs
  const limbGeo = new RoundedBoxGeometry(0.064, 0.66, 0.085, 2, 0.016);
  const topLimb = new THREE.Mesh(limbGeo, limbMat);
  topLimb.position.set(0, 0.62, 0.12);
  topLimb.rotation.x = -0.35;
  topLimb.castShadow = true;
  const botLimb = topLimb.clone();
  botLimb.position.set(0, -0.62, 0.12);
  botLimb.rotation.x = 0.35;
  group.add(topLimb, botLimb);

  // 3. Cam Pulleys
  const camGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.045, 18);
  camGeo.rotateZ(Math.PI / 2);
  const topCam = new THREE.Mesh(camGeo, camMat);
  topCam.position.set(0, 0.92, 0.24);
  const botCam = topCam.clone();
  botCam.position.set(0, -0.92, 0.24);
  group.add(topCam, botCam);

  // 4. HDR Holographic Sight Ring
  const sightRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.095, 0.013, 10, 28),
    sightMat
  );
  sightRing.position.set(-0.12, 0.18, -0.12);
  group.add(sightRing);

  // 5. Nocked Arrow Preview
  const nockedArrow = buildArrowMesh();
  nockedArrow.position.set(-0.04, 0.08, 0);
  group.add(nockedArrow);

  return { group, nockedArrow, sightMat };
}

export default function ArcheryNeoGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const {
    gameState,
    score,
    updateScore,
    addScore,
    triggerGameOver,
    startWithCountdown,
    resumeGame,
    countdown,
    gameStateRef,
    scoreRef
  } = useGameEngine({
    gameId: 'archeryneo',
    onGameOver,
    onScoreUpdate
  });

  const [arrowsLeft, setArrowsLeft] = useState(12);
  const [stageNum, setStageNum] = useState(1);
  const [combo, setCombo] = useState(1);
  const [windSpeed, setWindSpeed] = useState(0);
  const [drawPct, setDrawPct] = useState(0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('chase');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');
  const [hitBanner, setHitBanner] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<ThreeStageController | null>(null);
  const camModeRef = useRef<CameraPreset3D>('chase');
  const arrowsLeftRef = useRef(12);
  const stageNumRef = useRef(1);
  const comboRef = useRef(1);
  const lastDrawPctRef = useRef(0);
  const bannerTimerRef = useRef<number | null>(null);

  const rangeStateRef = useRef({
    aimYaw: 0,
    aimPitch: 0.04,
    isDrawing: false,
    drawTension: 0,
    windX: 0,
    targetX: 0,
    targetY: 2.2,
    targetZ: -22,
    targetRadius: 1.65,
    orbX: -3.2,
    orbY: 3.1,
    orbZ: -18,
    orbActive: true,
    fireRequested: false,
    resetRequested: true
  });

  useEffect(() => {
    camModeRef.current = cameraPreset;
  }, [cameraPreset]);

  const cycleQuality = useCallback(() => {
    const order: QualityLevel3D[] = ['ultra', 'balanced', 'performance'];
    const next = order[(order.indexOf(quality) + 1) % order.length];
    setQuality(next);
    stageRef.current?.setQualityLevel(next);
  }, [quality]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const showBanner = useCallback((msg: string) => {
    setHitBanner(msg);
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setHitBanner(null);
      bannerTimerRef.current = null;
    }, 1300);
  }, []);

  const randomizeWind = useCallback((lvl: number) => {
    const maxWind = Math.min(4.5, 0.8 + (lvl - 1) * 0.65);
    const w = Number(((Math.random() - 0.5) * 2 * maxWind).toFixed(1));
    rangeStateRef.current.windX = w;
    setWindSpeed(w);
  }, []);

  const startGame = useCallback(() => {
    updateScore(0);
    arrowsLeftRef.current = 12;
    setArrowsLeft(12);
    stageNumRef.current = 1;
    setStageNum(1);
    comboRef.current = 1;
    setCombo(1);
    lastDrawPctRef.current = 0;
    setDrawPct(0);

    rangeStateRef.current = {
      aimYaw: 0,
      aimPitch: 0.04,
      isDrawing: false,
      drawTension: 0,
      windX: 0,
      targetX: 0,
      targetY: 2.2,
      targetZ: -22,
      targetRadius: 1.65,
      orbX: -3.2,
      orbY: 3.1,
      orbZ: -18,
      orbActive: true,
      fireRequested: false,
      resetRequested: true
    };
    randomizeWind(1);

    startWithCountdown(() => {
      audioController.playClick();
    });
  }, [randomizeWind, startWithCountdown, updateScore]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameStateRef.current !== 'playing' || arrowsLeftRef.current <= 0) return;
    rangeStateRef.current.isDrawing = true;
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameStateRef.current !== 'playing') return;
    const mount = canvasMountRef.current;
    if (!mount) return;
    const rect = mount.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    rangeStateRef.current.aimYaw = THREE.MathUtils.clamp(-nx * 0.35, -0.42, 0.42);
    rangeStateRef.current.aimPitch = THREE.MathUtils.clamp(ny * 0.25 + 0.05, -0.15, 0.35);
  };

  const releaseArrow = useCallback(() => {
    const st = rangeStateRef.current;
    if (!st.isDrawing) return;
    st.isDrawing = false;
    if (st.drawTension > 0.25 && arrowsLeftRef.current > 0) {
      st.fireRequested = true;
      haptics.trigger('medium');
    } else {
      st.drawTension = 0;
      lastDrawPctRef.current = 0;
      setDrawPct(0);
    }
  }, []);

  // Keyboard & InputManager support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        setCameraPreset((prev) => (prev === 'chase' ? 'isometric' : prev === 'isometric' ? 'diorama' : 'chase'));
        return;
      }
      if (gameStateRef.current !== 'playing') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        rangeStateRef.current.aimYaw = Math.min(0.42, rangeStateRef.current.aimYaw + 0.03);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        rangeStateRef.current.aimYaw = Math.max(-0.42, rangeStateRef.current.aimYaw - 0.03);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        rangeStateRef.current.aimPitch = Math.min(0.35, rangeStateRef.current.aimPitch + 0.025);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        rangeStateRef.current.aimPitch = Math.max(-0.15, rangeStateRef.current.aimPitch - 0.025);
      }
    };

    const unsubInput = inputManager.subscribe({
      onActionDown: (action) => {
        if (gameStateRef.current !== 'playing') return;
        if ((action === 'PRIMARY' || action === 'ACTION_PRIMARY') && !rangeStateRef.current.isDrawing && arrowsLeftRef.current > 0) {
          rangeStateRef.current.isDrawing = true;
        } else if (action === 'LEFT') {
          rangeStateRef.current.aimYaw = Math.min(0.42, rangeStateRef.current.aimYaw + 0.035);
        } else if (action === 'RIGHT') {
          rangeStateRef.current.aimYaw = Math.max(-0.42, rangeStateRef.current.aimYaw - 0.035);
        } else if (action === 'UP') {
          rangeStateRef.current.aimPitch = Math.min(0.35, rangeStateRef.current.aimPitch + 0.03);
        } else if (action === 'DOWN') {
          rangeStateRef.current.aimPitch = Math.max(-0.15, rangeStateRef.current.aimPitch - 0.03);
        }
      },
      onActionUp: (action) => {
        if (action === 'PRIMARY' || action === 'ACTION_PRIMARY') {
          releaseArrow();
        }
      }
    });

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsubInput();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameStateRef, releaseArrow]);

  // Unified ThreeStageController 3D Archery Range
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let stageCtrl: ThreeStageController;
    try {
      stageCtrl = new ThreeStageController({
        container: mount,
        backgroundColor: 0x050914,
        fogColor: 0x050914,
        fogDensity: 0.017,
        fov: 54,
        near: 0.1,
        far: 140,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 14,
        toneMappingExposure: 1.12,
        bloom: {
          enabled: true,
          strength: 0.52,
          radius: 0.4,
          threshold: 0.8
        }
      });
    } catch {
      return;
    }

    const { scene, camera, renderer } = stageCtrl;
    stageRef.current = stageCtrl;
    setQuality(stageCtrl.getQualityLevel());
    camera.position.set(0, 2.1, 3.2);
    stageCtrl.rimLight.color.setHex(0xa855f7);
    stageCtrl.rimLight.position.set(-8, 8, -20);

    // Wet Asphalt PBR Range Floor
    const floorMaps = createWetAsphaltMaps(renderer, {
      baseColor: '#091120',
      stripeColor: '#06b6d4',
      puddleIntensity: 0.48,
      repeatX: 2,
      repeatY: 8
    });
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 60),
      new THREE.MeshStandardMaterial({
        map: floorMaps.map,
        roughnessMap: floorMaps.roughnessMap,
        bumpMap: floorMaps.bumpMap,
        bumpScale: 0.03,
        roughness: 0.72,
        metalness: 0.18
      })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.z = -24;
    floorMesh.receiveShadow = !stageCtrl.isSoftwareGl;
    scene.add(floorMesh);

    // Neon Range Arches & Side Guide Strips
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.25,
      metalness: 0.75,
      roughness: 0.25
    });
    for (let z = -8; z >= -38; z -= 10) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.11, 8, 36, Math.PI), archMat);
      arch.position.set(0, 0, z);
      scene.add(arch);
    }

    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const targetTex = createTargetFaceTexture(maxAniso);

    // Composite 3D Target Assembly
    const targetGroup = new THREE.Group();
    const boardDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.66, 1.66, 0.24, 36),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.65 })
    );
    boardDisc.rotation.x = Math.PI / 2;
    boardDisc.castShadow = !stageCtrl.isSoftwareGl;
    targetGroup.add(boardDisc);

    const faceDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.62, 36),
      new THREE.MeshStandardMaterial({ map: targetTex, roughness: 0.32, metalness: 0.08 })
    );
    faceDisc.position.z = 0.13;
    targetGroup.add(faceDisc);

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.85,
      roughness: 0.15
    });
    const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(1.67, 0.065, 12, 36), rimMat);
    targetGroup.add(rimTorus);

    const bullseyeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.022, 8, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 1.5,
        roughness: 0.15
      })
    );
    bullseyeRing.position.z = 0.14;
    targetGroup.add(bullseyeRing);

    targetGroup.position.set(0, 2.2, -22);
    scene.add(targetGroup);

    // Bonus Quiver Orb (+2 Arrows)
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.9,
      roughness: 0.12
    });
    const bonusOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), orbMat);
    bonusOrb.castShadow = !stageCtrl.isSoftwareGl;
    scene.add(bonusOrb);

    // Compound Bow in Foreground
    const bow = buildCompoundBow();
    bow.group.position.set(0.42, 1.75, 1.8);
    scene.add(bow.group);

    // Instanced Arrow Trail Particle Pool
    const trailGeo = new THREE.SphereGeometry(0.055, 6, 6);
    const trailMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.1,
      roughness: 0.15
    });
    const trailInst = new THREE.InstancedMesh(trailGeo, trailMat, TRAIL_CAPACITY);
    trailInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    trailInst.frustumCulled = false;
    const trailSlots: TrailSlot[] = Array.from({ length: TRAIL_CAPACITY }, () => ({
      active: false,
      x: 0,
      y: -99,
      z: 0,
      life: 0,
      maxLife: 0.32
    }));
    let trailCursor = 0;

    _trailDummy.position.set(0, -99, 0);
    _trailDummy.scale.setScalar(0);
    _trailDummy.updateMatrix();
    for (let i = 0; i < TRAIL_CAPACITY; i++) {
      trailInst.setMatrixAt(i, _trailDummy.matrix);
    }
    trailInst.instanceMatrix.needsUpdate = true;
    scene.add(trailInst);

    const spawnTrail = (x: number, y: number, z: number) => {
      const slot = trailSlots[trailCursor];
      trailCursor = (trailCursor + 1) % TRAIL_CAPACITY;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.maxLife = 0.28;
      slot.life = slot.maxLife;
    };

    const arrowPool = new ObjectPool<FlyingArrow3D>(
      () => {
        const mesh = buildArrowMesh();
        mesh.visible = false;
        scene.add(mesh);
        return {
          mesh,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          active: false,
          trailAcc: 0,
          life: 3.5
        };
      },
      (item) => {
        item.active = false;
        item.mesh.visible = false;
        item.trailAcc = 0;
        item.life = 3.5;
      },
      10
    );

    const stuckPool = new ObjectPool<THREE.Group>(
      () => {
        const mesh = buildArrowMesh();
        mesh.visible = false;
        targetGroup.add(mesh);
        return mesh;
      },
      (item) => {
        item.visible = false;
      },
      16
    );

    const clearArrows = () => {
      arrowPool.releaseAll();
      stuckPool.releaseAll();
      trailSlots.forEach((s) => {
        s.active = false;
      });
    };

    let drawHudAcc = 0;
    _camSmoothPos.set(0, 2.1, 3.2);

    stageCtrl.startLoop((dt, elapsed) => {
      const delta = Math.min(dt, 0.05);
      const st = rangeStateRef.current;

      if (st.resetRequested) {
        clearArrows();
        st.resetRequested = false;
      }

      if (gameStateRef.current === 'playing') {
        const swayAmp = Math.min(4.2, (stageNumRef.current - 1) * 1.15);
        const swaySpeed = 0.9 + stageNumRef.current * 0.22;
        st.targetX = Math.sin(elapsed * swaySpeed) * swayAmp;
        st.targetY = 2.3 + Math.cos(elapsed * swaySpeed * 0.7) * Math.min(1.1, (stageNumRef.current - 1) * 0.3);
        st.targetZ = -20 - Math.min(12, (stageNumRef.current - 1) * 2.5);
        targetGroup.position.set(st.targetX, st.targetY, st.targetZ);

        // Pulse target rim subtly
        rimMat.emissiveIntensity = 1.7 + Math.sin(elapsed * 4.5) * 0.25;

        bonusOrb.visible = st.orbActive;
        if (st.orbActive) {
          st.orbX = Math.cos(elapsed * 1.4) * 3.6;
          st.orbY = 3.2 + Math.sin(elapsed * 2.1) * 0.6;
          bonusOrb.position.set(st.orbX, st.orbY, st.orbZ);
          bonusOrb.rotation.y = elapsed * 2.5;
        }

        if (st.isDrawing) {
          st.drawTension = Math.min(1, st.drawTension + delta * 1.35);
          drawHudAcc += delta;
          if (drawHudAcc >= 0.065) {
            drawHudAcc = 0;
            const nextPct = Math.round(st.drawTension * 100);
            if (nextPct !== lastDrawPctRef.current) {
              lastDrawPctRef.current = nextPct;
              setDrawPct(nextPct);
            }
          }
        }

        bow.group.rotation.y = st.aimYaw;
        bow.group.rotation.x = st.aimPitch;
        bow.nockedArrow.visible = arrowsLeftRef.current > 0;
        bow.nockedArrow.position.z = st.drawTension * 0.42;
        bow.sightMat.emissiveIntensity = 1.6 + st.drawTension * 1.1;

        if (st.fireRequested) {
          st.fireRequested = false;
          const speed = 26 + st.drawTension * 24;
          st.drawTension = 0;
          lastDrawPctRef.current = 0;
          setDrawPct(0);

          arrowsLeftRef.current = Math.max(0, arrowsLeftRef.current - 1);
          setArrowsLeft(arrowsLeftRef.current);
          audioController.playLaser();
          stageCtrl.cameraRig.kickFov(3.2);

          const arr = arrowPool.acquire();
          arr.pos.set(0.35, 1.82, 1.5);
          arr.mesh.position.copy(arr.pos);
          arr.mesh.visible = true;
          arr.active = true;
          arr.trailAcc = 0;
          arr.life = 3.5;

          const dir = new THREE.Vector3(0, 0, -1)
            .applyEuler(new THREE.Euler(st.aimPitch, st.aimYaw, 0, 'YXZ'))
            .normalize();
          arr.vel.copy(dir).multiplyScalar(speed);
        }

        const activeArrows = arrowPool.getActiveItems();
        for (let i = activeArrows.length - 1; i >= 0; i--) {
          const arr = activeArrows[i];
          if (!arr.active) continue;

          const prevZ = arr.pos.z;
          arr.vel.y -= 9.8 * delta;
          arr.vel.x += st.windX * 0.85 * delta;

          arr.pos.addScaledVector(arr.vel, delta);
          arr.mesh.position.copy(arr.pos);

          _lookAhead.copy(arr.pos).add(arr.vel);
          arr.mesh.lookAt(_lookAhead);

          arr.trailAcc += delta;
          if (arr.trailAcc >= 0.016) {
            arr.trailAcc = 0;
            spawnTrail(arr.pos.x, arr.pos.y, arr.pos.z);
          }

          if (st.orbActive && arr.pos.distanceTo(bonusOrb.position) < 0.65) {
            st.orbActive = false;
            arrowsLeftRef.current += 2;
            setArrowsLeft(arrowsLeftRef.current);
            addScore(75);
            audioController.playPowerup();
            stageCtrl.particles.burst(bonusOrb.position.x, bonusOrb.position.y, bonusOrb.position.z, 28, 0x10b981, 8);
            stageCtrl.cameraRig.addTrauma(0.35);
            showBanner('QUIVER ORB! +2 ANAK PANAH & +75');
          }

          if (prevZ >= st.targetZ + 0.12 && arr.pos.z <= st.targetZ + 0.12) {
            const dx = arr.pos.x - st.targetX;
            const dy = arr.pos.y - st.targetY;
            const distFromCenter = Math.hypot(dx, dy);

            if (distFromCenter <= st.targetRadius) {
              arrowPool.release(i);

              if (stuckPool.activeCount >= 16) {
                stuckPool.release(0);
              }
              const stuck = stuckPool.acquire();
              stuck.position.set(dx, dy, 0.35);
              stuck.visible = true;

              let basePts = 15;
              let ringName = 'OUTER RING';
              let burstColor = 0x38bdf8;
              if (distFromCenter <= 0.32) {
                basePts = 100;
                ringName = 'BULLSEYE!';
                burstColor = 0xfacc15;
                comboRef.current = Math.min(8, comboRef.current + 1);
                screenShake.trigger('medium');
                stageCtrl.cameraRig.addTrauma(0.5);
                stageCtrl.triggerSlowMo(0.45, 0.18);
                audioController.playCombo(comboRef.current);
              } else if (distFromCenter <= 0.68) {
                basePts = 60;
                ringName = 'INNER RED!';
                burstColor = 0xf43f5e;
                comboRef.current = Math.min(8, comboRef.current + 1);
                stageCtrl.cameraRig.addTrauma(0.28);
                audioController.playScore();
              } else if (distFromCenter <= 1.05) {
                basePts = 35;
                ringName = 'CYAN RING';
                burstColor = 0x22d3ee;
                stageCtrl.cameraRig.addTrauma(0.18);
                audioController.playScore();
              } else {
                comboRef.current = 1;
                audioController.playHit();
              }

              stageCtrl.particles.burst(arr.pos.x, arr.pos.y, st.targetZ + 0.25, 22, burstColor, 6.5);
              setCombo(comboRef.current);
              const totalPts = basePts * comboRef.current;
              addScore(totalPts);
              showBanner(`${ringName} +${totalPts} (x${comboRef.current})`);

              const nextStage = Math.floor((scoreRef.current + totalPts) / 350) + 1;
              if (nextStage > stageNumRef.current) {
                stageNumRef.current = nextStage;
                setStageNum(nextStage);
                st.orbActive = true;
              }
              randomizeWind(stageNumRef.current);
              continue;
            }
          }

          arr.life -= delta;
          if (arr.life <= 0 || arr.pos.y < -1 || arr.pos.z < -48) {
            comboRef.current = 1;
            setCombo(1);
            arrowPool.release(i);
          }
        }

        if (arrowsLeftRef.current <= 0 && arrowPool.activeCount === 0) {
          audioController.playGameOver();
          triggerGameOver(scoreRef.current);
        }
      }

      // Step Arrow Trail Instances
      let trailDirty = false;
      for (let i = 0; i < TRAIL_CAPACITY; i++) {
        const ts = trailSlots[i];
        if (!ts.active) continue;
        trailDirty = true;
        ts.life -= delta;
        if (ts.life <= 0) {
          ts.active = false;
          _trailDummy.position.set(0, -99, 0);
          _trailDummy.scale.setScalar(0);
          _trailDummy.updateMatrix();
          trailInst.setMatrixAt(i, _trailDummy.matrix);
        } else {
          const s = (ts.life / ts.maxLife) * 1.15;
          _trailDummy.position.set(ts.x, ts.y, ts.z);
          _trailDummy.scale.set(s, s, s * 2.2);
          _trailDummy.updateMatrix();
          trailInst.setMatrixAt(i, _trailDummy.matrix);
        }
      }
      if (trailDirty) {
        trailInst.instanceMatrix.needsUpdate = true;
      }

      // Keep tight crisp shadow around target zone
      followDirectionalShadow(stageCtrl.keyLight, targetGroup.position, 14, true, _lampOffset);

      // Camera Choreography + Dynamic FOV + Trauma Shake
      const mode = camModeRef.current;
      const activeList = arrowPool.getActiveItems();
      const latestArrow = activeList[activeList.length - 1];

      if (mode === 'isometric' && latestArrow) {
        _camTargetPos.set(latestArrow.pos.x, latestArrow.pos.y + 0.45, latestArrow.pos.z + 2.4);
        _camLook.copy(latestArrow.pos);
      } else if (mode === 'diorama') {
        _camTargetPos.set(7.5, 3.2, -9);
        _camLook.set(0, 2.2, -16);
      } else {
        const zoomOffset = st.isDrawing ? -0.65 : 0;
        _camTargetPos.set(-st.aimYaw * 1.2, 2.05 + st.aimPitch * 0.8, 3.2 + zoomOffset);
        _camLook.set(-st.aimYaw * 16, 2.2 + st.aimPitch * 16, st.targetZ);
      }

      _camSmoothPos.x = THREE.MathUtils.damp(_camSmoothPos.x, _camTargetPos.x, 9, delta);
      _camSmoothPos.y = THREE.MathUtils.damp(_camSmoothPos.y, _camTargetPos.y, 9, delta);
      _camSmoothPos.z = THREE.MathUtils.damp(_camSmoothPos.z, _camTargetPos.z, 9, delta);

      stageCtrl.cameraRig.updateDynamicFov(
        camera,
        54,
        st.isDrawing ? -0.35 * st.drawTension : 0,
        delta,
        12
      );
      stageCtrl.cameraRig.applyTraumaToCamera(camera, _camSmoothPos, delta, 0.35);
      camera.lookAt(_camLook);
    });

    return () => {
      stageRef.current = null;
      targetTex.dispose();
      floorMaps.dispose();
      clearArrows();
      stageCtrl.dispose();
    };
  }, [addScore, gameStateRef, randomizeWind, scoreRef, showBanner, triggerGameOver]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releaseArrow}
      onPointerCancel={releaseArrow}
      className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[480px] flex flex-col items-center justify-center bg-[#060a14] overflow-hidden select-none cursor-crosshair touch-none"
    >
      {/* Dedicated WebGL Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Center Aim Reticle */}
      {gameState === 'playing' && (
        <div className="pointer-events-none z-10 flex items-center justify-center opacity-70">
          <Crosshair className="w-7 h-7 text-cyan-400" />
        </div>
      )}

      {/* Top HUD */}
      <div className="absolute top-2.5 inset-x-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-950/90 border border-white/10 px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-mono tabular-nums">
          <span className={arrowsLeft <= 3 ? 'text-red-400 font-bold' : 'text-cyan-400 font-semibold'}>
            <Target className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            PANAH {arrowsLeft}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-200 flex items-center gap-1">
            <Wind className="w-3.5 h-3.5 text-sky-400" />
            {windSpeed > 0 ? `→ ${windSpeed}` : windSpeed < 0 ? `← ${Math.abs(windSpeed)}` : '0.0'} m/s
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            x{combo}
          </span>
        </div>

        <div className="bg-slate-950/90 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-mono tabular-nums">
          <span className="text-slate-400 mr-1.5 sm:mr-2">STAGE {stageNum} · SKOR</span>
          <span className="text-white font-bold text-sm sm:text-base">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Hit Notification Toast */}
      {hitBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-amber-400/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-amber-300 tracking-wide shadow-lg whitespace-nowrap">
          {hitBanner}
        </div>
      )}

      <ThreeDockOverlay
        cameraPreset={cameraPreset}
        onSelectPreset={(preset) => {
          audioController.playClick();
          setCameraPreset(preset);
        }}
        quality={quality}
        onCycleQuality={cycleQuality}
        presetLabels={{ chase: 'Archer', isometric: 'Arrow', diorama: 'Side' }}
        extraControls={
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400 hidden sm:inline">TARIKAN BUSUR</span>
            <span className="text-slate-400 sm:hidden">POWER</span>
            <div className="w-16 sm:w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-500"
                style={{ width: `${drawPct}%` }}
              />
            </div>
            <span className="text-white w-9 text-right tabular-nums">{drawPct}%</span>
          </div>
        }
      />

      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        countdown={countdown}
        onStart={startGame}
        onRestart={startGame}
        onResume={resumeGame}
        gameTitle="ARCHERY NEO 3D"
        instructions="Tahan klik/sentuhan (atau SPASI) untuk menarik tali busur komposit 3D, perhatikan kecepatan angin & gravitasi, lalu lepaskan untuk membidik Bullseye!"
      />
    </div>
  );
}
