import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useGameEngine } from '../../hooks/useGameEngine';
import { audio } from '../../utils/audio';
import { screenShake } from '../../utils/screenShake';
import { GameOverlay } from '../gameplay/GameOverlay';
import {
  Zap,
  Shield,
  Gauge,
  Eye,
  RotateCcw,
  Flame,
  Trophy,
  Volume2,
  VolumeX,
  Sparkles,
  Radio,
  AlertTriangle
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

const _vec3 = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

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

  ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
  for (let i = 0; i < 2000; i++) {
    const rx = Math.random() * 1024;
    const ry = Math.random() * 1024;
    ctx.fillRect(rx, ry, 2, 2);
  }

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

function createSkyscraperTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, 256, 512);

  const colors = ['#00f0ff', '#ff007f', '#3b82f6', '#f59e0b'];
  for (let y = 16; y < 500; y += 24) {
    for (let x = 16; x < 240; x += 20) {
      if (Math.random() > 0.4) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.globalAlpha = 0.6 + Math.random() * 0.4;
        ctx.fillRect(x, y, 12, 14);
      }
    }
  }
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(240, 0, 8, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildPlayerCar(isSoftwareGl: boolean): { group: THREE.Group; wheels: THREE.Mesh[]; flameLeft: THREE.Mesh; flameRight: THREE.Mesh } {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: 0x00f0ff,
    metalness: 0.85,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1
  });

  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x11131a, metalness: 0.5, roughness: 0.55 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0f172a,
    metalness: 0.1,
    roughness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.45 : 0.95
  });

  const cyanLightMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.32, 3.4), paintMat);
  chassis.position.y = 0.38;
  chassis.castShadow = !isSoftwareGl;
  group.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.42, 1.6), glassMat);
  cabin.position.set(0, 0.68, -0.15);
  cabin.castShadow = !isSoftwareGl;
  group.add(cabin);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 0.85), carbonMat);
  nose.position.set(0, 0.3, -1.8);
  nose.castShadow = !isSoftwareGl;
  group.add(nose);

  const headlightL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.1), cyanLightMat);
  headlightL.position.set(-0.55, 0.38, -2.15);
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.55;
  group.add(headlightL, headlightR);

  const taillight = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 0.08), redLightMat);
  taillight.position.set(0, 0.46, 1.72);
  group.add(taillight);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.42), carbonMat);
  wing.position.set(0, 0.82, 1.62);
  group.add(wing);

  const wheelGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 16);
  wheelGeom.rotateZ(Math.PI / 2);
  const wheelRubberMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.8 });

  const wheelPositions = [
    [-0.88, 0.34, -1.05],
    [0.88, 0.34, -1.05],
    [-0.92, 0.34, 1.15],
    [0.92, 0.34, 1.15]
  ];

  wheelPositions.forEach((pos) => {
    const wheel = new THREE.Mesh(wheelGeom, wheelRubberMat);
    wheel.position.set(pos[0], pos[1], pos[2]);
    wheel.castShadow = !isSoftwareGl;
    group.add(wheel);
    wheels.push(wheel);
  });

  const flameGeom = new THREE.ConeGeometry(0.18, 0.9, 8);
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

  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

  if (type === 'drone') {
    // Cyber Police Drone Craft
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 1), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    core.position.y = 1.2;
    group.add(core);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.08, 8, 20), bodyMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2;
    group.add(ring);
  } else if (type === 'truck') {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 2.2), bodyMat);
    cabin.position.set(0, 0.85, -1.8);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 4.4), darkMat);
    cargo.position.set(0, 1.1, 1.2);
    group.add(cabin, cargo);
  } else if (type === 'speeder') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 3.2), bodyMat);
    body.position.y = 0.35;
    group.add(body);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 3.2), bodyMat);
    body.position.y = 0.45;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.38, 1.6), darkMat);
    roof.position.set(0, 0.82, -0.1);
    group.add(body, roof);
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
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6 })
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
    countdown
  } = useGameEngine({
    gameId: 'neon-drift',
    onGameOver,
    onScoreUpdate
  });

  const [speedKmh, setSpeedKmh] = useState(160);
  const [nitro, setNitro] = useState(40);
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
    nitro: 45,
    shields: 3,
    invulnerableTimer: 0,
    combo: 1,
    comboTimer: 0,
    scoreAcc: 0,
    isDrifting: false,
    isBoosting: false
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
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputStateRef.current.left = true;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputStateRef.current.right = true;
      else if (e.key === 'Shift' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputStateRef.current.drift = true;
      else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        inputStateRef.current.boost = true;
      } else if (e.key === 'c' || e.key === 'C') toggleCameraMode();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') inputStateRef.current.left = false;
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') inputStateRef.current.right = false;
      else if (e.key === 'Shift' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') inputStateRef.current.drift = false;
      else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') inputStateRef.current.boost = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleCameraMode]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 500;

    const renderer = new THREE.WebGLRenderer({ antialias: !isSoftwareGl, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070912);
    scene.fog = new THREE.FogExp2(0x070912, 0.0075);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 400);
    camera.position.set(0, 3.2, 5.8);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x050810, 0.85);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(12, 24, -15);
    scene.add(dirLight);

    const roadTexture = createHighwayTexture(renderer.capabilities.getMaxAnisotropy());
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.35, metalness: 0.25 });
    const roadGeom = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_SEGMENT_LENGTH);
    roadGeom.rotateX(-Math.PI / 2);

    const roadMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < ROAD_SEGMENTS_COUNT; i++) {
      const road = new THREE.Mesh(roadGeom, roadMat);
      road.position.set(0, 0, -i * ROAD_SEGMENT_LENGTH);
      scene.add(road);
      roadMeshes.push(road);
    }

    const { group: playerCar, wheels, flameLeft, flameRight } = buildPlayerCar(isSoftwareGl);
    scene.add(playerCar);

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
        color
      });
    }
    trafficCarsRef.current = trafficCars;

    // Power-Up Items
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
        active: true
      });
    });
    powerUpsRef.current = powerUps;

    let animationFrameId: number;
    let lastTime = performance.now();
    let toastTimeout: any = null;

    const tick = () => {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const pState = playerStateRef.current;
      const inputs = inputStateRef.current;

      powerUps.forEach((p) => {
        if (p.active) {
          p.mesh.rotation.y = now * 0.003;
        }
      });

      if (gameState === 'playing') {
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
        } else if (pState.x > maxRoadX) {
          pState.x = maxRoadX;
          pState.vx = -2.0;
          screenShake.trigger('subtle');
        }

        const targetDriftYaw = wantsDrift
          ? (inputs.left ? 0.45 : inputs.right ? -0.45 : pState.vx * 0.04)
          : pState.vx * 0.025;
        pState.driftAngle = THREE.MathUtils.damp(pState.driftAngle, targetDriftYaw, 12, delta);

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

        if (pState.scoreAcc >= 1) {
          const added = Math.floor(pState.scoreAcc);
          pState.scoreAcc -= added;
          updateScore(score + added);
        }

        if (pState.combo > 1) {
          pState.comboTimer -= delta;
          if (pState.comboTimer <= 0) {
            pState.combo = 1;
            setCombo(1);
          }
        }

        if (pState.invulnerableTimer > 0) {
          pState.invulnerableTimer -= delta;
          playerCar.visible = Math.floor(now / 80) % 2 === 0;
        } else {
          playerCar.visible = true;
        }

        const roadSpeedUnits = (pState.speedKmh / 3.6) * 1.6 * delta;
        roadMeshes.forEach((road) => {
          road.position.z += roadSpeedUnits;
          if (road.position.z > ROAD_SEGMENT_LENGTH) {
            road.position.z -= TOTAL_ROAD_LENGTH;
          }
        });

        // Power-Up Collection Check
        powerUps.forEach((p) => {
          if (!p.active) return;
          p.z += roadSpeedUnits;
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
            audio.playPowerup();
            screenShake.trigger('medium');

            if (p.type === 'emp') {
              trafficCars.forEach((tc) => {
                tc.z = -220;
              });
              setNearMissToast({ id: Date.now(), text: 'EMP SHOCKWAVE! TRAFFIC CLEARED', multiplier: pState.combo });
            } else if (p.type === 'shield') {
              pState.shields = Math.min(4, pState.shields + 1);
              setShields(pState.shields);
              setNearMissToast({ id: Date.now(), text: 'CYBER SHIELD RESTORED!', multiplier: pState.combo });
            } else if (p.type === 'double') {
              pState.combo = Math.min(16, pState.combo * 2);
              pState.comboTimer = 6.0;
              setCombo(pState.combo);
              setNearMissToast({ id: Date.now(), text: 'DOUBLE MULTIPLIER ACTIVATED!', multiplier: pState.combo });
            }
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => setNearMissToast(null), 1600);
          }
        });

        trafficCars.forEach((tCar) => {
          const relativeSpeed = (pState.speedKmh - tCar.speed) / 3.6 * 1.5 * delta;
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
            updateScore(score + bonusPoints);
            screenShake.trigger('medium');

            setCombo(pState.combo);
            setNearMissToast({
              id: Date.now(),
              text: `NEAR MISS! +${bonusPoints}`,
              multiplier: pState.combo
            });
            clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => setNearMissToast(null), 1400);
          }

          if (pState.invulnerableTimer <= 0 && dz < 2.5 && dx < 1.45) {
            audio.playCrash();
            screenShake.trigger('heavy');
            pState.shields -= 1;
            pState.invulnerableTimer = 1.4;
            pState.combo = 1;
            pState.baseSpeed = Math.max(120, pState.baseSpeed - 80);
            setShields(pState.shields);
            setCombo(1);

            pState.vx = (pState.x - tCar.x > 0 ? 6 : -6);

            if (pState.shields <= 0) {
              triggerGameOver();
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

        setSpeedKmh(Math.round(pState.speedKmh));
        setNitro(Math.round(pState.nitro));
      }

      const activeMode = cameraModeRef.current;
      const targetFov = pState.isBoosting ? 88 : 75;
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, delta);
      camera.updateProjectionMatrix();

      if (activeMode === 'chase') {
        _camPos.set(pState.x * 0.65, 2.9 + (pState.isBoosting ? 0.3 : 0), 5.6 + (pState.isBoosting ? 0.8 : 0));
        _camTarget.set(pState.x * 0.85, 1.1, -12);
      } else if (activeMode === 'hood') {
        _camPos.set(pState.x, 0.95, -0.6);
        _camTarget.set(pState.x + pState.driftAngle * 4, 0.85, -25);
      } else {
        _camPos.set(pState.x * 0.4, 14.5, 4.5);
        _camTarget.set(pState.x * 0.4, 0, -18);
      }

      camera.position.lerp(_camPos, Math.min(1, 14 * delta));
      camera.lookAt(_camTarget);

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(toastTimeout);
      roadGeom.dispose();
      roadTexture.dispose();
      renderer.dispose();
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [gameState, score, updateScore, triggerGameOver]);

  const handleStartGame = useCallback(() => {
    playerStateRef.current = {
      x: 0,
      vx: 0,
      speedKmh: 160,
      baseSpeed: 170,
      driftAngle: 0,
      nitro: 45,
      shields: 3,
      invulnerableTimer: 0,
      combo: 1,
      comboTimer: 0,
      scoreAcc: 0,
      isDrifting: false,
      isBoosting: false
    };
    setShields(3);
    setNitro(45);
    setCombo(1);
    startWithCountdown();
  }, [startWithCountdown]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden select-none font-sans">
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* TOP HUD BAR */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3">
          <div className="bg-zinc-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-cyan-500/30 flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400">SKOR</span>
            <span className="font-mono font-black text-xl text-white tracking-wider">
              {score.toLocaleString()}
            </span>
          </div>

          {combo > 1 && (
            <div className="bg-gradient-to-r from-pink-600 to-purple-600 px-3 py-1 rounded-md text-white font-extrabold text-xs uppercase tracking-widest shadow-[0_0_12px_rgba(236,72,153,0.4)] animate-bounce">
              {combo}x COMBO
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-zinc-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2 text-zinc-400">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-mono font-medium text-zinc-300">
              BEST: {highScore.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* FLOATING NEAR MISS POPUP */}
      {nearMissToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none z-20 transition-all duration-300 transform scale-105">
          <div className="bg-gradient-to-r from-cyan-500 via-pink-500 to-amber-400 text-black px-4 py-1.5 rounded-full font-black text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.6)] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            {nearMissToast.text}
          </div>
        </div>
      )}

      {/* BOTTOM COLLAPSIBLE DOCK */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between pointer-events-none z-10">
        <div className="bg-zinc-950/85 backdrop-blur-md border border-zinc-800 p-3 rounded-xl flex items-center gap-4 text-white">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-[10px] text-zinc-400 font-semibold uppercase">KECEPATAN</div>
              <div className="text-xl font-mono font-black text-white">{speedKmh} <span className="text-xs text-zinc-400 font-normal">KM/H</span></div>
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-[10px] text-zinc-400 font-semibold uppercase">NITRO OVERDRIVE</div>
              <div className="w-24 h-2.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-amber-500 to-pink-500" style={{ width: `${nitro}%` }} />
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-[10px] text-zinc-400 font-semibold uppercase">PERISAI HULL</div>
              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-2 rounded-sm ${i < shields ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-800'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={toggleCameraMode}
            className="p-3 bg-zinc-950/85 hover:bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors flex items-center gap-2 text-xs font-semibold"
          >
            <Eye className="w-4 h-4 text-cyan-400" />
            Kamera: {cameraMode.toUpperCase()}
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
