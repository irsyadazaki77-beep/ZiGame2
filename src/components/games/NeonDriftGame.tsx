import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { audioController, useGameEngine } from '../../sdk';
import { inputManager } from '../../services/inputService';
import { ThreeStageController, createWetAsphaltMaps } from '../../utils/threeStage';
import { screenShake } from '../../utils/screenShake';
import { GameOverlay } from '../gameplay/GameOverlay';
import {
  Zap,
  Shield,
  Gauge,
  Eye,
  Trophy,
  Sparkles,
} from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

type CameraMode = 'chase' | 'hood' | 'topdown';

export type CyberPowerUpType = 'emp' | 'shield' | 'double';

interface TrafficCar {
  mesh: THREE.Group;
  lane: number;
  x: number;
  z: number;
  speed: number;
  type: 'coupe' | 'truck' | 'speeder' | 'drone';
  width: number;
  length: number;
  scoredNearMiss: boolean;
  color: number;
}

interface PowerUpItem {
  id: string;
  type: CyberPowerUpType;
  mesh: THREE.Group;
  lane: number;
  z: number;
  active: boolean;
}

interface DriftParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  g: number;
  b: number;
}

const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _trailDummy = new THREE.Object3D();
const _trailColor = new THREE.Color();

const ROAD_LANES = [-6, -2, 2, 6];
const ROAD_WIDTH = 18;
const ROAD_SEGMENT_LENGTH = 120;
const ROAD_SEGMENTS_COUNT = 4;
const TOTAL_ROAD_LENGTH = ROAD_SEGMENT_LENGTH * ROAD_SEGMENTS_COUNT;
const MAX_TRAFFIC = 10;

function createHighwayTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#080a10';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(0, 0, 32, 1024);
  ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.fillRect(32, 0, 48, 1024);

  ctx.fillStyle = '#ff007f';
  ctx.fillRect(1024 - 32, 0, 32, 1024);
  ctx.fillStyle = 'rgba(255, 0, 127, 0.25)';
  ctx.fillRect(1024 - 80, 0, 48, 1024);

  const laneDividers = [256, 512, 768];
  ctx.fillStyle = '#38bdf8';
  for (const lx of laneDividers) {
    for (let y = 0; y < 1024; y += 128) {
      ctx.fillRect(lx - 4, y + 16, 8, 80);
    }
  }

  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 1024; y += 64) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(1024 - 80, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function buildPlayerCar(isSoftwareGl: boolean): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  flameLeft: THREE.Mesh;
  flameRight: THREE.Mesh;
} {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: 0x00e5ff,
    metalness: 0.86,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x11131a, metalness: 0.55, roughness: 0.48 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.1,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.82,
    transparent: true,
    opacity: isSoftwareGl ? 0.5 : 0.94,
  });

  const cyanLightMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x00ffff,
    emissiveIntensity: 2.2,
    roughness: 0.2,
  });
  const redLightMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    emissive: 0xff0055,
    emissiveIntensity: 2.35,
    roughness: 0.2,
  });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.6,
    transparent: true,
    opacity: 0.92,
  });

  // Sculpted ExtrudeGeometry aerodynamic coupe hull
  const shape = new THREE.Shape();
  shape.moveTo(-2.15, 0.16);
  shape.lineTo(-1.35, 0.44);
  shape.lineTo(-0.35, 0.52);
  shape.lineTo(0.25, 0.78);
  shape.lineTo(1.25, 0.72);
  shape.lineTo(1.8, 0.56);
  shape.lineTo(1.75, 0.18);
  shape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 1.54,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  hullGeo.center();
  hullGeo.rotateY(-Math.PI / 2);

  const chassis = new THREE.Mesh(hullGeo, paintMat);
  chassis.position.set(0, 0.42, -0.04);
  chassis.castShadow = !isSoftwareGl;
  group.add(chassis);

  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.22, 0.36, 1.56, 3, 0.12), glassMat);
  cabin.position.set(0, 0.7, -0.1);
  cabin.castShadow = !isSoftwareGl;
  group.add(cabin);

  const nose = new THREE.Mesh(new RoundedBoxGeometry(1.56, 0.16, 0.65, 2, 0.05), carbonMat);
  nose.position.set(0, 0.22, -1.9);
  nose.castShadow = !isSoftwareGl;
  group.add(nose);

  const headlightL = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.08, 0.1, 2, 0.02), cyanLightMat);
  headlightL.position.set(-0.52, 0.34, -2.18);
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.52;
  group.add(headlightL, headlightR);

  const taillight = new THREE.Mesh(new RoundedBoxGeometry(1.58, 0.09, 0.09, 2, 0.025), redLightMat);
  taillight.position.set(0, 0.48, 1.78);
  group.add(taillight);

  const underglowL = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.05, 3.1, 2, 0.02), cyanLightMat);
  underglowL.position.set(-0.84, 0.18, 0);
  const underglowR = underglowL.clone();
  underglowR.position.x = 0.84;
  group.add(underglowL, underglowR);

  const wing = new THREE.Mesh(new RoundedBoxGeometry(1.76, 0.07, 0.44, 2, 0.025), carbonMat);
  wing.position.set(0, 0.86, 1.62);
  group.add(wing);

  const wheelGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 18);
  wheelGeom.rotateZ(Math.PI / 2);
  const rimGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.29, 12);
  rimGeom.rotateZ(Math.PI / 2);
  const wheelRubberMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 });

  const wheelPositions = [
    [-0.88, 0.34, -1.08],
    [0.88, 0.34, -1.08],
    [-0.92, 0.34, 1.15],
    [0.92, 0.34, 1.15],
  ];

  wheelPositions.forEach((pos) => {
    const wheel = new THREE.Mesh(wheelGeom, wheelRubberMat);
    wheel.position.set(pos[0], pos[1], pos[2]);
    wheel.castShadow = !isSoftwareGl;
    const rim = new THREE.Mesh(rimGeom, cyanLightMat);
    wheel.add(rim);
    group.add(wheel);
    wheels.push(wheel);
  });

  const flameGeom = new THREE.ConeGeometry(0.18, 0.95, 10);
  flameGeom.rotateX(-Math.PI / 2);
  const flameLeft = new THREE.Mesh(flameGeom, flameMat);
  flameLeft.position.set(-0.35, 0.3, 2.3);
  flameLeft.visible = false;

  const flameRight = flameLeft.clone();
  flameRight.position.x = 0.35;
  flameRight.visible = false;
  group.add(flameLeft, flameRight);

  return { group, wheels, flameLeft, flameRight };
}

function buildTrafficCarMesh(type: 'coupe' | 'truck' | 'speeder' | 'drone', colorHex: number): THREE.Group {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.28, metalness: 0.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.55 });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    emissive: 0xff0055,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });

  if (type === 'drone') {
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.75, 1),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.95,
        roughness: 0.15,
      })
    );
    core.position.y = 1.2;
    group.add(core);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 8, 20), bodyMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2;
    group.add(ring);
  } else if (type === 'truck') {
    const cabin = new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.2, 2.2, 2, 0.12), bodyMat);
    cabin.position.set(0, 0.85, -1.8);
    const cargo = new THREE.Mesh(new RoundedBoxGeometry(2.1, 1.6, 4.4, 2, 0.1), darkMat);
    cargo.position.set(0, 1.1, 1.2);
    const tail = new THREE.Mesh(new RoundedBoxGeometry(1.85, 0.14, 0.08, 2, 0.02), tailMat);
    tail.position.set(0, 0.55, 3.42);
    group.add(cabin, cargo, tail);
  } else if (type === 'speeder') {
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.52, 0.32, 3.2, 2, 0.09), bodyMat);
    body.position.y = 0.35;
    const tail = new THREE.Mesh(new RoundedBoxGeometry(1.38, 0.08, 0.08, 2, 0.02), tailMat);
    tail.position.set(0, 0.4, 1.62);
    group.add(body, tail);
  } else {
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.45, 3.2, 2, 0.1), bodyMat);
    body.position.y = 0.45;
    const roof = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.38, 1.6, 2, 0.09), darkMat);
    roof.position.set(0, 0.82, -0.1);
    const tail = new THREE.Mesh(new RoundedBoxGeometry(1.46, 0.09, 0.08, 2, 0.02), tailMat);
    tail.position.set(0, 0.5, 1.62);
    group.add(body, roof, tail);
  }

  return group;
}

function buildPowerUpMesh(type: CyberPowerUpType): THREE.Group {
  const grp = new THREE.Group();
  let col = 0x38bdf8;
  if (type === 'shield') col = 0x10b981;
  else if (type === 'double') col = 0xf59e0b;

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.65, 0),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.9, roughness: 0.15 })
  );
  core.position.y = 0.75;
  grp.add(core);

  return grp;
}

export default function NeonDriftGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const {
    gameState,
    score,
    updateScore,
    triggerGameOver,
    startWithCountdown,
    countdown,
    scoreRef,
  } = useGameEngine({
    gameId: 'neon-drift',
    onGameOver,
    onScoreUpdate,
  });

  const gameStateRef = useRef(gameState);
  const updateScoreRef = useRef(updateScore);
  const triggerGameOverRef = useRef(triggerGameOver);

  useEffect(() => {
    gameStateRef.current = gameState;
    scoreRef.current = score;
    updateScoreRef.current = updateScore;
    triggerGameOverRef.current = triggerGameOver;
  }, [gameState, score, updateScore, triggerGameOver, scoreRef]);

  const [speedKmh, setSpeedKmh] = useState(160);
  const [nitro, setNitro] = useState(45);
  const [shields, setShields] = useState(3);
  const [combo, setCombo] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [nearMissToast, setNearMissToast] = useState<{ id: number; text: string; multiplier: number } | null>(null);

  const inputStateRef = useRef({ left: false, right: false, drift: false, boost: false });
  const playerStateRef = useRef({
    x: 0,
    vx: 0,
    speedKmh: 160,
    baseSpeed: 170,
    driftAngle: 0,
    camRoll: 0,
    nitro: 45,
    shields: 3,
    invulnerableTimer: 0,
    combo: 1,
    comboTimer: 0,
    scoreAcc: 0,
    isDrifting: false,
    isBoosting: false,
  });

  const cameraModeRef = useRef<CameraMode>('chase');
  cameraModeRef.current = cameraMode;

  const trafficCarsRef = useRef<TrafficCar[]>([]);
  const powerUpsRef = useRef<PowerUpItem[]>([]);

  const toggleCameraMode = useCallback(() => {
    setCameraMode((prev) => (prev === 'chase' ? 'hood' : prev === 'hood' ? 'topdown' : 'chase'));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'c' || e.key === 'C') toggleCameraMode();
    };

    const unsubInput = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') inputStateRef.current.left = true;
        else if (action === 'RIGHT') inputStateRef.current.right = true;
        else if (action === 'DOWN' || action === 'SECONDARY' || action === 'ACTION_SECONDARY') {
          inputStateRef.current.drift = true;
        } else if (action === 'UP' || action === 'PRIMARY' || action === 'ACTION_PRIMARY') {
          inputStateRef.current.boost = true;
        }
      },
      onActionUp: (action) => {
        if (action === 'LEFT') inputStateRef.current.left = false;
        else if (action === 'RIGHT') inputStateRef.current.right = false;
        else if (action === 'DOWN' || action === 'SECONDARY' || action === 'ACTION_SECONDARY') {
          inputStateRef.current.drift = false;
        } else if (action === 'UP' || action === 'PRIMARY' || action === 'ACTION_PRIMARY') {
          inputStateRef.current.boost = false;
        }
      }
    });

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsubInput();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleCameraMode]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container: mount,
        backgroundColor: 0x070912,
        fogColor: 0x070912,
        fogDensity: 0.007,
        fov: 75,
        near: 0.1,
        far: 400,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 20,
        toneMappingExposure: 1.15,
        bloom: {
          enabled: true,
          strength: 0.56,
          radius: 0.42,
          threshold: 0.78,
        },
      });
    } catch {
      return;
    }

    const { scene, camera, renderer, isSoftwareGl } = stage;
    camera.position.set(0, 3.2, 5.8);

    stage.hemiLight.color.setHex(0x38bdf8);
    stage.hemiLight.groundColor.setHex(0x050810);
    stage.hemiLight.intensity = 0.85;

    stage.keyLight.color.setHex(0xffffff);
    stage.keyLight.intensity = 1.45;
    stage.keyLight.position.set(12, 24, -15);

    stage.rimLight.color.setHex(0xf472b6);
    stage.rimLight.intensity = 0.95;
    stage.rimLight.position.set(-12, 10, -25);

    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const roadTexture = createHighwayTexture(maxAniso);
    const wetMaps = createWetAsphaltMaps(renderer, {
      baseColor: '#080a10',
      puddleIntensity: 0.82,
      repeatX: 1,
      repeatY: 8,
    });

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      emissiveMap: roadTexture,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.35,
      roughnessMap: wetMaps.roughnessMap,
      bumpMap: wetMaps.bumpMap,
      bumpScale: 0.035,
      roughness: 0.92,
      metalness: 0.42,
    });
    const roadGeom = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_SEGMENT_LENGTH);
    roadGeom.rotateX(-Math.PI / 2);

    const roadMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < ROAD_SEGMENTS_COUNT; i++) {
      const road = new THREE.Mesh(roadGeom, roadMat);
      road.position.set(0, 0, -i * ROAD_SEGMENT_LENGTH);
      road.receiveShadow = !isSoftwareGl;
      scene.add(road);
      roadMeshes.push(road);
    }

    // Glowing Side Neon Guardrails
    const railGeo = new THREE.BoxGeometry(0.18, 0.28, TOTAL_ROAD_LENGTH);
    const cyanRailMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.7,
      roughness: 0.2,
    });
    const pinkRailMat = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff007f,
      emissiveIntensity: 1.7,
      roughness: 0.2,
    });
    const leftRail = new THREE.Mesh(railGeo, cyanRailMat);
    leftRail.position.set(-ROAD_WIDTH / 2 - 0.15, 0.25, -TOTAL_ROAD_LENGTH / 2 + ROAD_SEGMENT_LENGTH / 2);
    const rightRail = new THREE.Mesh(railGeo, pinkRailMat);
    rightRail.position.set(ROAD_WIDTH / 2 + 0.15, 0.25, -TOTAL_ROAD_LENGTH / 2 + ROAD_SEGMENT_LENGTH / 2);
    scene.add(leftRail, rightRail);

    // Instanced Flanking Cyber Towers
    const pillarGeo = new THREE.BoxGeometry(2.8, 28, 2.8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x1e1b4b,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.7,
    });
    const pillarCount = 32;
    const pillarInst = new THREE.InstancedMesh(pillarGeo, pillarMat, pillarCount);
    const pDummy = new THREE.Object3D();
    for (let i = 0; i < pillarCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const hScale = 0.6 + ((i * 5) % 7) * 0.25;
      pDummy.position.set(side * (16 + (i % 3) * 5), 14 * hScale - 2, -i * 15 + 15);
      pDummy.scale.set(1, hScale, 1);
      pDummy.updateMatrix();
      pillarInst.setMatrixAt(i, pDummy.matrix);
    }
    pillarInst.computeBoundingSphere();
    scene.add(pillarInst);

    const { group: playerCar, wheels, flameLeft, flameRight } = buildPlayerCar(isSoftwareGl);
    scene.add(playerCar);

    // Instanced Drift Sparks & Boost Trail Pool
    const trailCap = isSoftwareGl ? 40 : 120;
    const trailGeo = new THREE.BoxGeometry(0.14, 0.08, 0.65);
    const trailMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf97316,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    const trailMesh = new THREE.InstancedMesh(trailGeo, trailMat, trailCap);
    trailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    trailMesh.frustumCulled = false;
    const trailSlots: DriftParticleSlot[] = Array.from({ length: trailCap }, () => ({
      active: false,
      x: 0,
      y: -99,
      z: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.35,
      r: 1,
      g: 0.5,
      b: 0.1,
    }));
    let trailCursor = 0;
    _trailDummy.position.set(0, -99, 0);
    _trailDummy.scale.set(0, 0, 0);
    _trailDummy.updateMatrix();
    _trailColor.setHex(0x38bdf8);
    for (let i = 0; i < trailCap; i++) {
      trailMesh.setMatrixAt(i, _trailDummy.matrix);
      trailMesh.setColorAt(i, _trailColor);
    }
    trailMesh.instanceMatrix.needsUpdate = true;
    if (trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;
    scene.add(trailMesh);

    const emitWheelTrail = (carX: number, driftAngle: number, isBoost: boolean, isDrift: boolean) => {
      const rearOffsets = [-0.88, 0.88];
      for (const ox of rearOffsets) {
        const slot = trailSlots[trailCursor];
        trailCursor = (trailCursor + 1) % trailCap;
        slot.active = true;
        slot.x = carX + ox * Math.cos(driftAngle);
        slot.y = 0.15;
        slot.z = 1.35 + ox * Math.sin(driftAngle);
        slot.vx = (Math.random() - 0.5) * (isDrift ? 3.5 : 0.8);
        slot.vy = isDrift ? 1.2 + Math.random() * 1.4 : 0.4;
        slot.maxLife = isBoost ? 0.36 : 0.28;
        slot.life = slot.maxLife;
        if (isBoost) {
          slot.r = 0.15;
          slot.g = 0.92;
          slot.b = 1.0;
        } else {
          slot.r = 1.0;
          slot.g = 0.45;
          slot.b = 0.12;
        }
      }
    };

    const trafficCars: TrafficCar[] = [];
    const trafficColors = [0xef4444, 0xf59e0b, 0x10b981, 0xa855f7, 0xec4899, 0x3b82f6];
    const trafficTypes: ('coupe' | 'truck' | 'speeder' | 'drone')[] = ['coupe', 'truck', 'speeder', 'drone'];

    for (let i = 0; i < MAX_TRAFFIC; i++) {
      const type = trafficTypes[i % trafficTypes.length];
      const color = trafficColors[i % trafficColors.length];
      const mesh = buildTrafficCarMesh(type, color);

      const lane = ROAD_LANES[i % ROAD_LANES.length];
      const z = -60 - i * 32 - Math.random() * 15;
      mesh.position.set(lane, 0, z);
      scene.add(mesh);

      trafficCars.push({
        mesh,
        lane,
        x: lane,
        z,
        speed: type === 'truck' ? 85 : type === 'speeder' ? 145 : 110,
        type,
        width: type === 'truck' ? 2.2 : 1.7,
        length: type === 'truck' ? 4.6 : 3.4,
        scoredNearMiss: false,
        color,
      });
    }
    trafficCarsRef.current = trafficCars;

    const powerUps: PowerUpItem[] = [];
    const pTypes: CyberPowerUpType[] = ['emp', 'shield', 'double'];
    pTypes.forEach((type, idx) => {
      const pMesh = buildPowerUpMesh(type);
      const lane = ROAD_LANES[idx % ROAD_LANES.length];
      const z = -80 - idx * 60;
      pMesh.position.set(lane, 0, z);
      scene.add(pMesh);

      powerUps.push({
        id: `pu_${idx}`,
        type,
        mesh: pMesh,
        lane,
        z,
        active: true,
      });
    });
    powerUpsRef.current = powerUps;

    let toastTimeout: ReturnType<typeof setTimeout> | undefined;
    let hudSyncTimer = 0;
    let trailAcc = 0;
    let lastSpeedShown = 160;
    let lastNitroShown = 45;

    stage.startLoop((dt, elapsed) => {
      const delta = Math.min(dt, 0.05);
      const pState = playerStateRef.current;
      const inputs = inputStateRef.current;

      powerUps.forEach((p) => {
        if (p.active) {
          p.mesh.rotation.y = elapsed * 3.0;
        }
      });

      const roadSpeedUnits = ((pState.speedKmh / 3.6) * 1.6) * delta;

      if (gameStateRef.current === 'playing') {
        const wantsDrift = inputs.drift;
        pState.isDrifting = wantsDrift;

        const steerSpeed = wantsDrift ? 15.5 : 11.0;
        if (inputs.left) pState.vx -= steerSpeed * delta;
        else if (inputs.right) pState.vx += steerSpeed * delta;
        else pState.vx *= Math.pow(0.02, delta);

        const maxVx = wantsDrift ? 14 : 9.5;
        pState.vx = Math.max(-maxVx, Math.min(maxVx, pState.vx));
        pState.x += pState.vx * delta;

        const maxRoadX = ROAD_WIDTH / 2 - 1.6;
        if (pState.x < -maxRoadX) {
          pState.x = -maxRoadX;
          pState.vx = 2.0;
          screenShake.trigger('subtle');
          stage.cameraRig.addTrauma(0.22);
        } else if (pState.x > maxRoadX) {
          pState.x = maxRoadX;
          pState.vx = -2.0;
          screenShake.trigger('subtle');
          stage.cameraRig.addTrauma(0.22);
        }

        const targetDriftYaw = wantsDrift
          ? inputs.left
            ? 0.45
            : inputs.right
            ? -0.45
            : pState.vx * 0.04
          : pState.vx * 0.025;
        pState.driftAngle = THREE.MathUtils.damp(pState.driftAngle, targetDriftYaw, 12, delta);
        pState.camRoll = THREE.MathUtils.damp(pState.camRoll, -pState.vx * 0.0045 - pState.driftAngle * 0.06, 8, delta);

        if (wantsDrift && Math.abs(pState.vx) > 1.5) {
          pState.nitro = Math.min(100, pState.nitro + 18 * delta);
        }

        const wantsBoost = inputs.boost && pState.nitro > 2;
        pState.isBoosting = wantsBoost;

        if (wantsBoost) {
          pState.nitro = Math.max(0, pState.nitro - 28 * delta);
          pState.baseSpeed = THREE.MathUtils.damp(pState.baseSpeed, 335, 6, delta);
        } else {
          pState.baseSpeed = Math.min(240, pState.baseSpeed + 0.8 * delta);
        }

        pState.speedKmh = pState.baseSpeed;

        const speedMultiplier = pState.speedKmh / 160;
        const boostBonus = wantsBoost ? 2.5 : 1.0;
        const framePoints = 65 * speedMultiplier * boostBonus * pState.combo * delta;
        pState.scoreAcc += framePoints;

        if (pState.combo > 1) {
          pState.comboTimer -= delta;
          if (pState.comboTimer <= 0) {
            pState.combo = 1;
            setCombo(1);
          }
        }

        if (pState.invulnerableTimer > 0) {
          pState.invulnerableTimer -= delta;
          playerCar.visible = Math.floor(elapsed * 12.5) % 2 === 0;
        } else {
          playerCar.visible = true;
        }

        roadMeshes.forEach((road) => {
          road.position.z += roadSpeedUnits;
          if (road.position.z > ROAD_SEGMENT_LENGTH) {
            road.position.z -= TOTAL_ROAD_LENGTH;
          }
        });

        powerUps.forEach((p) => {
          if (!p.active) return;
          p.z += roadSpeedUnits;
          p.mesh.position.set(p.lane, 0, p.z);
          if (p.z > 25) {
            p.z = -180 - Math.random() * 80;
            p.active = true;
            p.mesh.visible = true;
          }

          const dx = Math.abs(pState.x - p.lane);
          const dz = Math.abs(p.z);
          if (dz < 2.0 && dx < 1.5) {
            p.active = false;
            p.mesh.visible = false;
            audioController.playPowerup();
            screenShake.trigger('medium');
            stage.cameraRig.addTrauma(0.32);

            if (p.type === 'emp') {
              trafficCars.forEach((tc) => {
                tc.z = -220;
              });
              stage.particles.burst(pState.x, 0.8, -1, isSoftwareGl ? 10 : 28, 0x38bdf8, 9, 1.3, 6);
              setNearMissToast({ id: Date.now(), text: 'EMP SHOCKWAVE! TRAFFIC CLEARED', multiplier: pState.combo });
            } else if (p.type === 'shield') {
              pState.shields = Math.min(4, pState.shields + 1);
              setShields(pState.shields);
              setNearMissToast({ id: Date.now(), text: 'CYBER SHIELD RESTORED!', multiplier: pState.combo });
            } else if (p.type === 'double') {
              pState.combo = Math.min(16, pState.combo * 2);
              pState.comboTimer = 6.0;
              setCombo(pState.combo);
              stage.cameraRig.kickFov(6);
              setNearMissToast({ id: Date.now(), text: 'DOUBLE MULTIPLIER ACTIVATED!', multiplier: pState.combo });
            }
            if (toastTimeout) clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => setNearMissToast(null), 1600);
          }
        });

        trafficCars.forEach((tCar) => {
          const relativeSpeed = ((pState.speedKmh - tCar.speed) / 3.6) * 1.5 * delta;
          tCar.z += relativeSpeed;

          if (tCar.z > 25) {
            tCar.z = -220 - Math.random() * 60;
            tCar.lane = ROAD_LANES[Math.floor(Math.random() * ROAD_LANES.length)];
            tCar.x = tCar.lane;
            tCar.scoredNearMiss = false;
          }

          tCar.mesh.position.set(tCar.x, 0, tCar.z);

          const dx = Math.abs(pState.x - tCar.x);
          const dz = Math.abs(tCar.z);

          if (!tCar.scoredNearMiss && dz < 3.2 && dx < 2.3 && dx > 1.3) {
            tCar.scoredNearMiss = true;
            pState.nitro = Math.min(100, pState.nitro + 22);
            pState.combo = Math.min(16, pState.combo + 1);
            pState.comboTimer = 4.0;
            const bonusPoints = 250 * pState.combo;
            const nextScore = scoreRef.current + bonusPoints;
            scoreRef.current = nextScore;
            updateScoreRef.current(nextScore);
            audioController.playNearMiss();
            screenShake.trigger('medium');
            stage.cameraRig.kickFov(3.5);

            setCombo(pState.combo);
            setNearMissToast({
              id: Date.now(),
              text: `NEAR MISS! +${bonusPoints}`,
              multiplier: pState.combo,
            });
            if (toastTimeout) clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => setNearMissToast(null), 1400);
          }

          if (pState.invulnerableTimer <= 0 && dz < 2.5 && dx < 1.45) {
            audioController.playExplosion();
            screenShake.trigger('heavy');
            stage.cameraRig.addTrauma(0.75);
            stage.particles.burst(pState.x, 0.7, 0, isSoftwareGl ? 10 : 30, 0xf97316, 8, 1.3, 12);
            pState.shields -= 1;
            pState.invulnerableTimer = 1.4;
            pState.combo = 1;
            pState.baseSpeed = Math.max(120, pState.baseSpeed - 80);
            setShields(pState.shields);
            setCombo(1);

            pState.vx = pState.x - tCar.x > 0 ? 6 : -6;

            if (pState.shields <= 0) {
              const pending = Math.floor(pState.scoreAcc);
              if (pending > 0) {
                pState.scoreAcc -= pending;
                scoreRef.current += pending;
                updateScoreRef.current(scoreRef.current);
              }
              audioController.playGameOver();
              triggerGameOverRef.current(scoreRef.current);
            }
          }
        });

        playerCar.position.x = pState.x;
        playerCar.rotation.y = pState.driftAngle;
        playerCar.rotation.z = -pState.vx * 0.035;

        const wheelRollSpeed = (pState.speedKmh / 3.6) * 4 * delta;
        wheels.forEach((w, idx) => {
          w.rotation.x += wheelRollSpeed;
          if (idx < 2) w.rotation.y = -pState.vx * 0.05;
        });

        flameLeft.visible = wantsBoost;
        flameRight.visible = wantsBoost;

        if (wantsBoost || (wantsDrift && Math.abs(pState.vx) > 1.2)) {
          trailAcc += delta;
          if (trailAcc >= 0.025) {
            trailAcc = 0;
            emitWheelTrail(pState.x, pState.driftAngle, wantsBoost, wantsDrift);
          }
        }

        hudSyncTimer += delta;
        if (hudSyncTimer >= 0.1) {
          hudSyncTimer = 0;
          if (pState.scoreAcc >= 1) {
            const added = Math.floor(pState.scoreAcc);
            pState.scoreAcc -= added;
            const nextScore = scoreRef.current + added;
            scoreRef.current = nextScore;
            updateScoreRef.current(nextScore);
          }
          const nextSpeed = Math.round(pState.speedKmh);
          if (nextSpeed !== lastSpeedShown) {
            lastSpeedShown = nextSpeed;
            setSpeedKmh(nextSpeed);
          }
          const nextNitro = Math.round(pState.nitro);
          if (nextNitro !== lastNitroShown) {
            lastNitroShown = nextNitro;
            setNitro(nextNitro);
          }
        }
      }

      // Update instanced drift/boost trail particles
      let trailUpdated = false;
      for (let i = 0; i < trailCap; i++) {
        const s = trailSlots[i];
        if (!s.active) continue;
        trailUpdated = true;
        s.life -= delta;
        if (s.life <= 0) {
          s.active = false;
          _trailDummy.position.set(0, -99, 0);
          _trailDummy.scale.set(0, 0, 0);
          _trailDummy.updateMatrix();
          trailMesh.setMatrixAt(i, _trailDummy.matrix);
          continue;
        }
        s.x += s.vx * delta;
        s.y += s.vy * delta;
        s.z += Math.max(12, roadSpeedUnits * 52) * delta;
        const ratio = s.life / s.maxLife;
        _trailDummy.position.set(s.x, s.y, s.z);
        _trailDummy.scale.set(ratio, ratio, 0.7 + (1 - ratio) * 1.1);
        _trailDummy.updateMatrix();
        trailMesh.setMatrixAt(i, _trailDummy.matrix);
        _trailColor.setRGB(s.r * ratio, s.g * ratio, s.b * ratio);
        trailMesh.setColorAt(i, _trailColor);
      }
      if (trailUpdated) {
        trailMesh.instanceMatrix.needsUpdate = true;
        if (trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;
      }

      // Dynamic FOV Kick + Camera Roll + Trauma Shake
      const activeMode = cameraModeRef.current;
      const speedRatio = Math.max(0, (pState.speedKmh - 160) / 180);
      stage.cameraRig.updateDynamicFov(camera, 75, speedRatio + (pState.isBoosting ? 0.25 : 0), delta, 15);

      if (activeMode === 'chase') {
        _camPos.set(
          pState.x * 0.65,
          2.9 + (pState.isBoosting ? 0.3 : 0),
          5.6 + (pState.isBoosting ? 0.8 : 0)
        );
        _camTarget.set(pState.x * 0.85, 1.1, -12);
      } else if (activeMode === 'hood') {
        _camPos.set(pState.x, 0.95, -0.6);
        _camTarget.set(pState.x + pState.driftAngle * 4, 0.85, -25);
      } else {
        _camPos.set(pState.x * 0.4, 14.5, 4.5);
        _camTarget.set(pState.x * 0.4, 0, -18);
      }

      camera.position.lerp(_camPos, Math.min(1, 14 * delta));
      stage.cameraRig.applyTraumaToCamera(camera, camera.position.clone(), delta, 0.48);
      camera.lookAt(_camTarget);
      if (activeMode !== 'topdown') {
        camera.rotateZ(pState.camRoll);
      }
    });

    return () => {
      if (toastTimeout) clearTimeout(toastTimeout);
      roadTexture.dispose();
      wetMaps.dispose();
      stage.dispose();
    };
  }, [scoreRef]);

  const handleStartGame = useCallback(() => {
    updateScore(0);
    playerStateRef.current = {
      x: 0,
      vx: 0,
      speedKmh: 160,
      baseSpeed: 170,
      driftAngle: 0,
      camRoll: 0,
      nitro: 45,
      shields: 3,
      invulnerableTimer: 0,
      combo: 1,
      comboTimer: 0,
      scoreAcc: 0,
      isDrifting: false,
      isBoosting: false,
    };
    trafficCarsRef.current.forEach((tc, i) => {
      tc.lane = ROAD_LANES[i % ROAD_LANES.length];
      tc.x = tc.lane;
      tc.z = -60 - i * 32;
      tc.scoredNearMiss = false;
    });
    setShields(3);
    setNitro(45);
    setCombo(1);
    startWithCountdown(() => {
      audioController.playClick();
    });
  }, [updateScore, startWithCountdown]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[480px] flex flex-col items-center justify-center bg-black overflow-hidden select-none font-sans touch-none">
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP HUD BAR (Zero backdrop-blur over WebGL canvas) */}
      <div className="absolute top-2.5 inset-x-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-zinc-950/90 px-3 py-1.5 rounded-lg border border-cyan-500/30 flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.15)] tabular-nums">
            <span className="text-[11px] sm:text-xs uppercase tracking-wider font-semibold text-cyan-400">SKOR</span>
            <span className="font-mono font-black text-base sm:text-xl text-white tracking-wider">
              {score.toLocaleString()}
            </span>
          </div>

          {combo > 1 && (
            <div className="bg-gradient-to-r from-pink-600 to-purple-600 px-2.5 py-1 rounded-md text-white font-extrabold text-[11px] sm:text-xs uppercase tracking-widest shadow-[0_0_12px_rgba(236,72,153,0.4)] tabular-nums">
              {combo}x COMBO
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-zinc-950/90 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2 text-zinc-400 tabular-nums">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] sm:text-xs font-mono font-medium text-zinc-300">
              BEST: {highScore.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* FLOATING NEAR MISS POPUP */}
      {nearMissToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none z-20 transition-all duration-300">
          <div className="bg-gradient-to-r from-cyan-500 via-pink-500 to-amber-400 text-black px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.6)] flex items-center gap-1.5 whitespace-nowrap">
            <Sparkles className="w-4 h-4 shrink-0" />
            {nearMissToast.text}
          </div>
        </div>
      )}

      {/* MOBILE TOUCH STEERING & NITRO CONTROLS */}
      {gameState === 'playing' && (
        <div className="md:hidden absolute bottom-20 left-3 right-3 z-10 flex items-center justify-between gap-2 pointer-events-auto touch-none">
          <div className="flex items-center gap-2">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                inputStateRef.current.left = true;
              }}
              onPointerUp={() => {
                inputStateRef.current.left = false;
              }}
              onPointerLeave={() => {
                inputStateRef.current.left = false;
              }}
              onPointerCancel={() => {
                inputStateRef.current.left = false;
              }}
              className="px-3.5 min-h-[44px] rounded-xl bg-zinc-950/90 border border-cyan-500/40 text-white font-bold text-xs uppercase active:bg-cyan-600 touch-none"
              aria-label="Belok Kiri"
            >
              ◀ Kiri
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                inputStateRef.current.right = true;
              }}
              onPointerUp={() => {
                inputStateRef.current.right = false;
              }}
              onPointerLeave={() => {
                inputStateRef.current.right = false;
              }}
              onPointerCancel={() => {
                inputStateRef.current.right = false;
              }}
              className="px-3.5 min-h-[44px] rounded-xl bg-zinc-950/90 border border-cyan-500/40 text-white font-bold text-xs uppercase active:bg-cyan-600 touch-none"
              aria-label="Belok Kanan"
            >
              Kanan ▶
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                inputStateRef.current.drift = true;
              }}
              onPointerUp={() => {
                inputStateRef.current.drift = false;
              }}
              onPointerLeave={() => {
                inputStateRef.current.drift = false;
              }}
              onPointerCancel={() => {
                inputStateRef.current.drift = false;
              }}
              className="px-3 min-h-[44px] rounded-xl bg-pink-600/90 border border-pink-400/40 text-white font-bold text-xs uppercase active:bg-pink-500 touch-none"
            >
              Drift
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                inputStateRef.current.boost = true;
              }}
              onPointerUp={() => {
                inputStateRef.current.boost = false;
              }}
              onPointerLeave={() => {
                inputStateRef.current.boost = false;
              }}
              onPointerCancel={() => {
                inputStateRef.current.boost = false;
              }}
              className="px-3 min-h-[44px] rounded-xl bg-amber-500 text-zinc-950 font-black text-xs uppercase active:bg-amber-400 touch-none"
            >
              Nitro
            </button>
          </div>
        </div>
      )}

      {/* BOTTOM DOCK */}
      <div className="absolute bottom-3 inset-x-3 flex flex-wrap items-end justify-between gap-2 pointer-events-none z-10 pb-[env(safe-area-inset-bottom)]">
        <div className="bg-zinc-950/90 border border-zinc-800 px-3 py-2 sm:p-3 rounded-xl flex flex-wrap items-center gap-2.5 sm:gap-4 text-white tabular-nums">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Gauge className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <div>
              <div className="text-[9px] sm:text-[10px] text-zinc-400 font-semibold uppercase">KECEPATAN</div>
              <div className="text-sm sm:text-xl font-mono font-black text-white">
                {speedKmh} <span className="text-[10px] sm:text-xs text-zinc-400 font-normal">KM/H</span>
              </div>
            </div>
          </div>
          <div className="hidden sm:block h-8 w-px bg-zinc-800" />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            <div>
              <div className="text-[9px] sm:text-[10px] text-zinc-400 font-semibold uppercase">NITRO</div>
              <div className="w-16 sm:w-24 h-2 bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-amber-500 to-pink-500" style={{ width: `${nitro}%` }} />
              </div>
            </div>
          </div>
          <div className="hidden sm:block h-8 w-px bg-zinc-800" />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            <div>
              <div className="text-[9px] sm:text-[10px] text-zinc-400 font-semibold uppercase">HULL</div>
              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 sm:w-3.5 h-2 rounded-sm ${
                      i < shields ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => {
              audioController.playClick();
              toggleCameraMode();
            }}
            className="px-3 min-h-[44px] sm:min-h-0 py-2.5 sm:p-3 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors flex items-center gap-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Kamera:</span> {cameraMode.toUpperCase()}
          </button>
        </div>
      </div>

      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        countdown={countdown}
        onStart={handleStartGame}
        onRestart={handleStartGame}
        gameTitle="NEON DRIFT 3D"
        instructions="Navigasi: A/D atau Panah Kiri/Kanan. Drift: SHIFT. Boost Nitro: SPASI / W."
      />
    </div>
  );
}
