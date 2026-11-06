import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useGameEngine } from '../../hooks/useGameEngine';
import { disposeThreeScene } from '../../utils/threeCleanup';
import { audio } from '../../utils/audio';
import { screenShake } from '../../utils/screenShake';
import { Flag, Gauge, RotateCcw, Eye, ChevronDown, ChevronUp, Ghost, Zap, Play, Shield, Sparkles, AlertTriangle } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

type CameraMode = 'chase' | 'hood' | 'overhead';

interface GhostSample {
  timeMs: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export type DeskPowerUpType = 'nitro' | 'shield' | 'magnet' | 'eraser';

interface DeskPowerUpItem {
  id: string;
  type: DeskPowerUpType;
  mesh: THREE.Group;
  uPos: number;
  lateralOffset: number;
  active: boolean;
}

interface DeskHazardItem {
  id: string;
  type: 'coffee' | 'eraser' | 'pen';
  mesh: THREE.Group;
  uPos: number;
  lateralOffset: number;
  active: boolean;
}

const GHOST_STORAGE_KEY = 'zigame_desk_racer_best_ghost_v1';
const TOTAL_LAPS = 3;

// Control points for the miniature desk coaster circuit matching the reference minimap shape
const TRACK_CONTROL_POINTS: [number, number, number][] = [
  [0, 0, 12],
  [0, 0, -10],
  [-4, 0.8, -22],
  [-15, 1.4, -24],
  [-24, 0.6, -14],
  [-20, 0, -2],
  [-11, 0, 2],
  [-14, 0, 12],
  [-24, 0.9, 18],
  [-20, 1.2, 28],
  [-8, 0.4, 26],
  [0, 0, 20]
];

const TRACK_HALF_WIDTH = 2.65;

// Pre-allocated vectors outside animation loop to guarantee zero per-frame GC
const _pt = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();

function createTrackRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark miniature asphalt
  ctx.fillStyle = '#1e222a';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt grain
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 600; i++) {
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }

  // Red & White racing kerbs on left and right edges
  for (let y = 0; y < 512; y += 64) {
    const isRed = (y / 64) % 2 === 0;
    ctx.fillStyle = isRed ? '#ef4444' : '#f8fafc';
    ctx.fillRect(0, y, 36, 64);
    ctx.fillRect(512 - 36, y, 36, 64);
  }

  // White inner racing lines
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(42, 0, 6, 512);
  ctx.fillRect(512 - 48, 0, 6, 512);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 38);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCheckeredTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const sq = 16;
  for (let y = 0; y < 64; y += sq) {
    for (let x = 0; x < 256; x += sq) {
      const even = ((x / sq) + (y / sq)) % 2 === 0;
      ctx.fillStyle = even ? '#f8fafc' : '#0f172a';
      ctx.fillRect(x, y, sq, sq);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// Composite 10-Part Miniature Formula Race Car Group with Nitro Flames & Shield Bubble
function buildFormulaRacerGroup(isGhost = false): { group: THREE.Group; shieldBubble: THREE.Mesh; flameL: THREE.Mesh; flameR: THREE.Mesh } {
  const car = new THREE.Group();

  const redPaint = new THREE.MeshPhysicalMaterial({
    color: isGhost ? 0x38bdf8 : 0xef4444,
    roughness: 0.2,
    metalness: 0.4,
    clearcoat: 1.0,
    transparent: isGhost,
    opacity: isGhost ? 0.42 : 1.0
  });

  const whiteTrim = new THREE.MeshStandardMaterial({
    color: isGhost ? 0xe0f2fe : 0xf8fafc,
    roughness: 0.35,
    metalness: 0.15,
    transparent: isGhost,
    opacity: isGhost ? 0.42 : 1.0
  });

  const darkCarbon = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.65,
    metalness: 0.3,
    transparent: isGhost,
    opacity: isGhost ? 0.35 : 1.0
  });

  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.85,
    metalness: 0.05,
    transparent: isGhost,
    opacity: isGhost ? 0.35 : 1.0
  });

  // 1. Main Chassis Body
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 1.55), redPaint);
  chassis.position.y = 0.22;
  chassis.castShadow = !isGhost;
  car.add(chassis);

  // 2. Aerodynamic Nose Cone
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.65), whiteTrim);
  nose.position.set(0, 0.19, -0.95);
  nose.castShadow = !isGhost;
  car.add(nose);

  // 3. Front Spoiler Wing
  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.05, 0.28), darkCarbon);
  frontWing.position.set(0, 0.12, -1.22);
  car.add(frontWing);

  // 4. Rear High Downforce Wing
  const rearWing = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.32), whiteTrim);
  rearWing.position.set(0, 0.52, 0.72);
  rearWing.castShadow = !isGhost;
  car.add(rearWing);

  const rearPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 0.24), redPaint);
  rearPillarL.position.set(-0.48, 0.42, 0.72);
  const rearPillarR = rearPillarL.clone();
  rearPillarR.position.x = 0.48;
  car.add(rearPillarL, rearPillarR);

  // 5. Cockpit Surround
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.55), darkCarbon);
  cockpit.position.set(0, 0.36, -0.05);
  car.add(cockpit);

  // 6. Driver Helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), whiteTrim);
  helmet.position.set(0, 0.5, -0.02);
  car.add(helmet);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.28), redPaint);
  stripe.position.set(0, 0.56, -0.02);
  car.add(stripe);

  // 7. Four Racing Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.22, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelOffsets: [number, number, number][] = [
    [-0.52, 0.22, -0.68],
    [0.52, 0.22, -0.68],
    [-0.54, 0.22, 0.58],
    [0.54, 0.22, 0.58]
  ];
  for (const [wx, wy, wz] of wheelOffsets) {
    const wheel = new THREE.Mesh(wheelGeo, rubberMat);
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = !isGhost;
    car.add(wheel);
  }

  // 8. Shield Forcefield Bubble (Toggling when Desk Shield active)
  const bubbleGeo = new THREE.SphereGeometry(1.15, 20, 20);
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x0284c7,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1
  });
  const shieldBubble = new THREE.Mesh(bubbleGeo, bubbleMat);
  shieldBubble.position.y = 0.35;
  shieldBubble.visible = false;
  car.add(shieldBubble);

  // 9. Twin Nitro Thruster Flames
  const flameGeo = new THREE.ConeGeometry(0.12, 0.65, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.24, 0.28, 1.05);
  flameL.visible = false;
  const flameR = flameL.clone();
  flameR.position.x = 0.24;
  flameR.visible = false;
  car.add(flameL, flameR);

  return { group: car, shieldBubble, flameL, flameR };
}

// Power-Up Mesh Builder
function buildPowerUpMesh(type: DeskPowerUpType): THREE.Group {
  const grp = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(0.65, 0.65, 0.65);

  let color = 0x38bdf8;
  if (type === 'shield') color = 0x10b981;
  else if (type === 'magnet') color = 0xf59e0b;
  else if (type === 'eraser') color = 0xec4899;

  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.3
  });

  const box = new THREE.Mesh(boxGeo, mat);
  grp.add(box);

  const ringGeo = new THREE.TorusGeometry(0.55, 0.04, 8, 20);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  grp.add(ring);

  grp.position.y = 0.45;
  return grp;
}

// Hazard Mesh Builder
function buildHazardMesh(type: 'coffee' | 'eraser' | 'pen'): THREE.Group {
  const grp = new THREE.Group();

  if (type === 'coffee') {
    // Coffee spill pool
    const poolGeo = new THREE.CircleGeometry(0.9, 16);
    const poolMat = new THREE.MeshBasicMaterial({ color: 0x451a03, transparent: true, opacity: 0.82 });
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.04;
    grp.add(pool);
  } else if (type === 'eraser') {
    // Pink Eraser Block
    const eraserGeo = new THREE.BoxGeometry(0.85, 0.35, 1.4);
    const eraserMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.7 });
    const eraser = new THREE.Mesh(eraserGeo, eraserMat);
    eraser.position.y = 0.2;
    grp.add(eraser);
  } else {
    // Rolling Office Pen
    const penGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 12);
    penGeo.rotateZ(Math.PI / 2);
    const penMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.3, metalness: 0.5 });
    const pen = new THREE.Mesh(penGeo, penMat);
    pen.position.y = 0.12;
    grp.add(pen);
  }

  return grp;
}

export default function DeskRacerGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const {
    score,
    updateScore,
    triggerGameOver,
    setGameState,
    gameState,
    gameStateRef
  } = useGameEngine({
    gameId: 'desk-racer',
    onScoreUpdate,
    onGameOver
  });

  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [lap, setLap] = useState<number>(1);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [boostPct, setBoostPct] = useState<number>(100);
  const [currentLapMs, setCurrentLapMs] = useState<number>(0);
  const [bestLapMs, setBestLapMs] = useState<number | null>(null);
  const [ghostEnabled, setGhostEnabled] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [raceFinished, setRaceFinished] = useState<{ totalTimeMs: number; bestLapMs: number; finalScore: number } | null>(null);
  const [playerMinimapPt, setPlayerMinimapPt] = useState<{ x: number; y: number }>({ x: 0, y: 12 });
  const [ghostMinimapPt, setGhostMinimapPt] = useState<{ x: number; y: number } | null>(null);

  // Modern Power-Up & Combo State
  const [hasShield, setHasShield] = useState<boolean>(false);
  const [hasMagnet, setHasMagnet] = useState<boolean>(false);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cameraModeRef = useRef<CameraMode>('chase');
  const ghostEnabledRef = useRef<boolean>(true);
  const keysRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
    boost: false
  });

  const resetRaceFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    ghostEnabledRef.current = ghostEnabled;
  }, [ghostEnabled]);

  useEffect(() => {
    setGameState('playing');
  }, [setGameState]);

  const formatRaceTime = (ms: number) => {
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  };

  const handleRestartRace = useCallback(() => {
    resetRaceFnRef.current?.();
    audio.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14161d);
    scene.fog = new THREE.FogExp2(0x14161d, 0.012);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 160);
    camera.position.set(0, 2.4, 16.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. RoomEnvironment Studio Reflection
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 3. Studio Desk Lighting + RGB Keyboard Backlight
    const hemiLight = new THREE.HemisphereLight(0xe2e8f0, 0x1e1b4b, 0.75);
    scene.add(hemiLight);

    const deskLampLight = new THREE.DirectionalLight(0xfff7ed, 1.9);
    deskLampLight.position.set(12, 24, 14);
    deskLampLight.castShadow = !isSoftwareGl;
    deskLampLight.shadow.mapSize.set(1024, 1024);
    deskLampLight.shadow.camera.near = 2;
    deskLampLight.shadow.camera.far = 75;
    const sd = 32;
    deskLampLight.shadow.camera.left = -sd;
    deskLampLight.shadow.camera.right = sd;
    deskLampLight.shadow.camera.top = sd;
    deskLampLight.shadow.camera.bottom = -sd;
    deskLampLight.shadow.bias = -0.0005;
    scene.add(deskLampLight);

    const rgbGlowLight = new THREE.PointLight(0x38bdf8, 6.5, 28, 1.5);
    rgbGlowLight.position.set(8.5, 2.5, 0);
    scene.add(rgbGlowLight);

    // 4. Giant Workspace Desk Surface
    const deskMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      new THREE.MeshStandardMaterial({
        color: 0x222631,
        roughness: 0.72,
        metalness: 0.15
      })
    );
    deskMesh.rotation.x = -Math.PI / 2;
    deskMesh.position.y = -0.05;
    deskMesh.receiveShadow = true;
    scene.add(deskMesh);

    // 5. Giant RGB Mechanical Keyboard Prop
    const keyboardGroup = new THREE.Group();
    keyboardGroup.position.set(8.2, 0, 0);
    const kbBody = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.55, 19.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.6 })
    );
    kbBody.position.y = 0.27;
    kbBody.receiveShadow = true;
    keyboardGroup.add(kbBody);

    const rgbStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 19.2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    rgbStrip.position.set(-3.62, 0.22, 0);
    keyboardGroup.add(rgbStrip);

    const rows = 6;
    const cols = 16;
    const keycapGeo = new THREE.BoxGeometry(0.78, 0.35, 0.92);
    const keycapMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.25,
      emissive: 0x0284c7,
      emissiveIntensity: 0.28
    });
    const keycapsInstanced = new THREE.InstancedMesh(keycapGeo, keycapMat, rows * cols);
    const dummy = new THREE.Object3D();
    const keyColor = new THREE.Color();
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dummy.position.set(-2.6 + r * 1.02, 0.68, -8.5 + c * 1.12);
        dummy.updateMatrix();
        keycapsInstanced.setMatrixAt(idx, dummy.matrix);
        keyColor.setHSL(0.55 + (c / cols) * 0.22, 0.85, 0.45);
        keycapsInstanced.setColorAt(idx, keyColor);
        idx++;
      }
    }
    keycapsInstanced.instanceMatrix.needsUpdate = true;
    if (keycapsInstanced.instanceColor) keycapsInstanced.instanceColor.needsUpdate = true;
    keycapsInstanced.computeBoundingSphere();
    keyboardGroup.add(keycapsInstanced);
    scene.add(keyboardGroup);

    // Giant Coffee Mug & Desk Books
    const mugGroup = new THREE.Group();
    mugGroup.position.set(-9.5, 0, -9);
    const mugCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.0, 4.6, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xf97316, roughness: 0.2, clearcoat: 0.8 })
    );
    mugCylinder.position.y = 2.3;
    mugCylinder.castShadow = !isSoftwareGl;
    mugGroup.add(mugCylinder);
    scene.add(mugGroup);

    // 6. Procedural Ribbon Coaster Track Geometry
    const curvePoints = TRACK_CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const trackCurve = new THREE.CatmullRomCurve3(curvePoints, true, 'catmullrom', 0.5);

    const segments = 320;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const pt = trackCurve.getPointAt(u);
      const tan = trackCurve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();

      const leftPt = pt.clone().addScaledVector(right, -TRACK_HALF_WIDTH);
      const rightPt = pt.clone().addScaledVector(right, TRACK_HALF_WIDTH);

      positions.push(leftPt.x, leftPt.y + 0.03, leftPt.z);
      positions.push(rightPt.x, rightPt.y + 0.03, rightPt.z);

      uvs.push(0, u);
      uvs.push(1, u);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const roadTex = createTrackRoadTexture(maxAniso);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // 7. Start / Finish Checkered Gantry Truss
    const startPt = trackCurve.getPointAt(0);
    const gantryGroup = new THREE.Group();
    gantryGroup.position.copy(startPt);

    const trussMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.8 });
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.6, 0.32), trussMat);
    leftPillar.position.set(-TRACK_HALF_WIDTH - 0.15, 1.8, 0);
    const rightPillar = leftPillar.clone();
    rightPillar.position.x = TRACK_HALF_WIDTH + 0.15;
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF_WIDTH * 2 + 0.8, 0.38, 0.38), trussMat);
    topBeam.position.set(0, 3.5, 0);

    const checkerTex = createCheckeredTexture(maxAniso);
    const bannerMat = new THREE.MeshBasicMaterial({ map: checkerTex, side: THREE.DoubleSide });
    const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 2, 0.85), bannerMat);
    bannerMesh.position.set(0, 3.0, 0);

    const finishLineDecal = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 1.9, 0.9),
      new THREE.MeshBasicMaterial({
        map: checkerTex,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      })
    );
    finishLineDecal.rotation.x = -Math.PI / 2;
    finishLineDecal.position.set(0, 0.05, 0);

    gantryGroup.add(leftPillar, rightPillar, topBeam, bannerMesh, finishLineDecal);
    scene.add(gantryGroup);

    // 8. Player Formula Car & Ghost Replay Car
    const { group: playerCar, shieldBubble, flameL, flameR } = buildFormulaRacerGroup(false);
    scene.add(playerCar);

    const { group: ghostCar } = buildFormulaRacerGroup(true);
    ghostCar.visible = false;
    scene.add(ghostCar);

    // 9. Spawn Interactive Power-Ups & Desk Hazards along Spline
    const powerUps: DeskPowerUpItem[] = [];
    const pTypes: DeskPowerUpType[] = ['nitro', 'shield', 'magnet', 'eraser'];
    const pSplineOffsets = [0.15, 0.35, 0.55, 0.75, 0.90];

    pSplineOffsets.forEach((u, i) => {
      const type = pTypes[i % pTypes.length];
      const pMesh = buildPowerUpMesh(type);
      const lat = (Math.random() - 0.5) * (TRACK_HALF_WIDTH * 1.2);

      const ptOnTrack = trackCurve.getPointAt(u);
      const tan = trackCurve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();

      pMesh.position.copy(ptOnTrack).addScaledVector(right, lat);
      scene.add(pMesh);

      powerUps.push({
        id: `p_${i}`,
        type,
        mesh: pMesh,
        uPos: u,
        lateralOffset: lat,
        active: true
      });
    });

    const hazards: DeskHazardItem[] = [];
    const hTypes: ('coffee' | 'eraser' | 'pen')[] = ['coffee', 'eraser', 'pen'];
    const hSplineOffsets = [0.1, 0.28, 0.48, 0.68, 0.84];

    hSplineOffsets.forEach((u, i) => {
      const type = hTypes[i % hTypes.length];
      const hMesh = buildHazardMesh(type);
      const lat = (Math.random() - 0.5) * (TRACK_HALF_WIDTH * 1.4);

      const ptOnTrack = trackCurve.getPointAt(u);
      const tan = trackCurve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();

      hMesh.position.copy(ptOnTrack).addScaledVector(right, lat);
      scene.add(hMesh);

      hazards.push({
        id: `h_${i}`,
        type,
        mesh: hMesh,
        uPos: u,
        lateralOffset: lat,
        active: true
      });
    });

    // Load saved best ghost replay if available
    let bestGhostFrames: GhostSample[] = [];
    try {
      const raw = localStorage.getItem(GHOST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.frames)) {
          bestGhostFrames = parsed.frames;
          if (typeof parsed.lapMs === 'number') {
            setBestLapMs(parsed.lapMs);
          }
        }
      }
    } catch {
      // ignore storage errors
    }

    // Driving Physics & Lap State
    const trackLength = trackCurve.getLength();
    let uPos = 0.002;
    let lateralOffset = 0;
    let speed = 0;
    let steerInput = 0;
    let boostEnergy = 100;
    let currentLap = 1;
    let passedHalfway = false;
    let lapStartMs = performance.now();
    let raceStartMs = performance.now();
    let currentLapFrames: GhostSample[] = [];
    let bestLapRecordMs = Infinity;
    let totalScoreAccum = 0;
    let finished = false;
    let hudThrottleTimer = 0;

    // Power-up duration counters
    let shieldActive = false;
    let magnetActive = false;
    let magnetTimer = 0;
    let comboMultiplierVal = 1;
    let comboDecayTimer = 0;

    const resetRaceState = () => {
      uPos = 0.002;
      lateralOffset = 0;
      speed = 0;
      steerInput = 0;
      boostEnergy = 100;
      currentLap = 1;
      passedHalfway = false;
      const now = performance.now();
      lapStartMs = now;
      raceStartMs = now;
      currentLapFrames = [];
      totalScoreAccum = 0;
      finished = false;
      shieldActive = false;
      magnetActive = false;
      magnetTimer = 0;
      comboMultiplierVal = 1;
      comboDecayTimer = 0;

      powerUps.forEach((p) => {
        p.active = true;
        p.mesh.visible = true;
      });
      hazards.forEach((h) => {
        h.active = true;
        h.mesh.visible = true;
      });

      setLap(1);
      setSpeedKmh(0);
      setBoostPct(100);
      setCurrentLapMs(0);
      setHasShield(false);
      setHasMagnet(false);
      setComboMultiplier(1);
      setRaceFinished(null);
      updateScore(0);
      setGameState('playing');
    };
    resetRaceFnRef.current = resetRaceState;

    // Keyboard listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keysRef.current.up = true;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = true;
      if (e.code === 'Space' || e.code === 'ShiftLeft') keysRef.current.boost = true;
      if (e.code === 'KeyR') resetRaceState();
      if (e.code === 'KeyH') setDockCollapsed((p) => !p);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keysRef.current.up = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = false;
      if (e.code === 'Space' || e.code === 'ShiftLeft') keysRef.current.boost = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const dt = Math.min(clock.getDelta(), 0.08);
      const now = performance.now();
      const elapsedTotal = clock.getElapsedTime();

      const isPlaying = (gameStateRef.current as string)?.toLowerCase() === 'playing';

      // Rotate Power-Up Mesh Boxes
      if (isPlaying) {
        powerUps.forEach((p) => {
          if (p.active) {
            p.mesh.rotation.y = elapsedTotal * 2.5;
          }
        });
      }

      if (!finished && isPlaying) {
        const k = keysRef.current;
        const isBoosting = k.boost && boostEnergy > 5 && k.up;
        const maxSpeed = isBoosting ? 32 : 22;
        const accel = isBoosting ? 26 : 15;

        if (isBoosting) {
          flameL.visible = true;
          flameR.visible = true;
          flameL.scale.setScalar(0.8 + Math.sin(now * 0.05) * 0.3);
          flameR.scale.setScalar(0.8 + Math.sin(now * 0.05) * 0.3);
        } else {
          flameL.visible = false;
          flameR.visible = false;
        }

        if (k.up) {
          speed = Math.min(maxSpeed, speed + accel * dt);
        } else if (k.down) {
          speed = Math.max(-8, speed - 20 * dt);
        } else {
          speed = THREE.MathUtils.damp(speed, 0, 2.5, dt);
        }

        if (isBoosting) {
          boostEnergy = Math.max(0, boostEnergy - 32 * dt);
        } else {
          boostEnergy = Math.min(100, boostEnergy + 14 * dt);
        }

        const targetSteer = (k.left ? -1 : 0) + (k.right ? 1 : 0);
        steerInput = THREE.MathUtils.damp(steerInput, targetSteer, 10, dt);

        if (Math.abs(speed) > 0.4) {
          lateralOffset += steerInput * (speed / 18) * 3.8 * dt;
        }

        // Kerb boundary friction & wall bounce with Screen Shake
        const maxLat = TRACK_HALF_WIDTH - 0.55;
        if (Math.abs(lateralOffset) > maxLat) {
          lateralOffset = Math.sign(lateralOffset) * maxLat;
          speed *= 0.88;
          screenShake.trigger('subtle');
        }

        const prevU = uPos;
        uPos = (uPos + (speed * dt) / trackLength + 1) % 1;

        if (uPos > 0.45 && uPos < 0.65) {
          passedHalfway = true;
        }

        // Magnet attraction logic
        if (magnetActive) {
          magnetTimer -= dt;
          if (magnetTimer <= 0) {
            magnetActive = false;
            setHasMagnet(false);
          }
        }

        // Combo decay logic
        if (comboMultiplierVal > 1) {
          comboDecayTimer -= dt;
          if (comboDecayTimer <= 0) {
            comboMultiplierVal = 1;
            setComboMultiplier(1);
          }
        }

        // POWER-UP COLLECTION CHECK
        powerUps.forEach((p) => {
          if (!p.active) return;
          const uDist = Math.abs(uPos - p.uPos);
          const latDist = Math.abs(lateralOffset - p.lateralOffset);

          if (uDist < 0.02 || (magnetActive && uDist < 0.08)) {
            if (latDist < 1.2 || magnetActive) {
              p.active = false;
              p.mesh.visible = false;
              audio.playPowerup();
              screenShake.trigger('medium');

              comboMultiplierVal = Math.min(8, comboMultiplierVal * 2);
              comboDecayTimer = 5.0;
              setComboMultiplier(comboMultiplierVal);

              if (p.type === 'nitro') {
                boostEnergy = 100;
                setToastMessage('NITRO REFILLED! +100% BOOST');
              } else if (p.type === 'shield') {
                shieldActive = true;
                shieldBubble.visible = true;
                setHasShield(true);
                setToastMessage('DESK SHIELD ACTIVATED!');
              } else if (p.type === 'magnet') {
                magnetActive = true;
                magnetTimer = 8.0;
                setHasMagnet(true);
                setToastMessage('COIN MAGNET ACTIVE (8s)!');
              } else if (p.type === 'eraser') {
                hazards.forEach((h) => {
                  h.active = false;
                  h.mesh.visible = false;
                });
                setToastMessage('ERASER BOMB! ALL HAZARDS CLEARED');
              }
              setTimeout(() => setToastMessage(null), 1800);
            }
          }
        });

        // HAZARD COLLISION CHECK
        hazards.forEach((h) => {
          if (!h.active) return;
          const uDist = Math.abs(uPos - h.uPos);
          const latDist = Math.abs(lateralOffset - h.lateralOffset);

          if (uDist < 0.015 && latDist < 1.0) {
            if (shieldActive) {
              shieldActive = false;
              shieldBubble.visible = false;
              setHasShield(false);
              h.active = false;
              h.mesh.visible = false;
              audio.playExplosion();
              screenShake.trigger('medium');
              setToastMessage('SHIELD ABSORBED IMPACT!');
              setTimeout(() => setToastMessage(null), 1500);
            } else {
              // Spin out / slow down penalty
              audio.playError();
              screenShake.trigger('heavy');
              speed *= 0.35;
              comboMultiplierVal = 1;
              setComboMultiplier(1);
              h.active = false;
              h.mesh.visible = false;
              setToastMessage('SPIN OUT! HAZARD HIT');
              setTimeout(() => setToastMessage(null), 1500);
            }
          }
        });

        const lapElapsed = now - lapStartMs;

        // Record ghost frame every ~60ms
        if (
          currentLapFrames.length === 0 ||
          lapElapsed - currentLapFrames[currentLapFrames.length - 1].timeMs >= 60
        ) {
          currentLapFrames.push({
            timeMs: Math.round(lapElapsed),
            x: playerCar.position.x,
            y: playerCar.position.y,
            z: playerCar.position.z,
            yaw: playerCar.rotation.y
          });
        }

        // Continuous score accumulation based on clean speed & combo multiplier
        if (speed > 4) {
          totalScoreAccum += speed * dt * 1.8 * comboMultiplierVal;
        }

        // Check Lap Completion crossing u=0 after passing halfway
        if (passedHalfway && prevU > 0.85 && uPos < 0.15) {
          passedHalfway = false;
          audio.playLevelUp();
          screenShake.trigger('medium');

          const completedLapMs = lapElapsed;
          const lapBonus = Math.max(400, Math.round(2200 - completedLapMs / 25)) * comboMultiplierVal;
          totalScoreAccum += lapBonus;

          if (completedLapMs < bestLapRecordMs) {
            bestLapRecordMs = completedLapMs;
            bestGhostFrames = [...currentLapFrames];
            setBestLapMs(Math.round(completedLapMs));
            try {
              localStorage.setItem(
                GHOST_STORAGE_KEY,
                JSON.stringify({ lapMs: Math.round(completedLapMs), frames: bestGhostFrames.slice(0, 400) })
              );
            } catch {
              // ignore quota errors
            }
          }

          if (currentLap >= TOTAL_LAPS) {
            finished = true;
            const finalScore = Math.round(totalScoreAccum);
            updateScore(finalScore);
            setRaceFinished({
              totalTimeMs: Math.round(now - raceStartMs),
              bestLapMs: Math.round(Math.min(bestLapRecordMs, completedLapMs)),
              finalScore
            });
            triggerGameOver(finalScore);
          } else {
            currentLap += 1;
            setLap(currentLap);
            lapStartMs = now;
            currentLapFrames = [];
          }
        }

        // Position Player Car on Spline + Lateral Offset
        trackCurve.getPointAt(uPos, _pt);
        trackCurve.getTangentAt(uPos, _tangent).normalize();
        _right.crossVectors(_tangent, _up).normalize();

        playerCar.position.copy(_pt).addScaledVector(_right, lateralOffset);
        const headingYaw = Math.atan2(_tangent.x, _tangent.z);
        playerCar.rotation.y = headingYaw - steerInput * 0.22;

        // Position Ghost Replay Car if available
        if (ghostEnabledRef.current && bestGhostFrames.length > 1) {
          ghostCar.visible = true;
          let gIdx = 0;
          while (
            gIdx < bestGhostFrames.length - 1 &&
            bestGhostFrames[gIdx + 1].timeMs < lapElapsed
          ) {
            gIdx++;
          }
          const f0 = bestGhostFrames[gIdx];
          const f1 = bestGhostFrames[Math.min(gIdx + 1, bestGhostFrames.length - 1)];
          const span = Math.max(1, f1.timeMs - f0.timeMs);
          const alpha = THREE.MathUtils.clamp((lapElapsed - f0.timeMs) / span, 0, 1);

          ghostCar.position.set(
            THREE.MathUtils.lerp(f0.x, f1.x, alpha),
            THREE.MathUtils.lerp(f0.y, f1.y, alpha),
            THREE.MathUtils.lerp(f0.z, f1.z, alpha)
          );
          ghostCar.rotation.y = f0.yaw;
        } else {
          ghostCar.visible = false;
        }

        // Dynamic Camera Tracking & FOV Speed Effect
        const targetFov = isBoosting ? 68 : 58 + (speed / 30) * 5;
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, dt);
        camera.updateProjectionMatrix();

        const cMode = cameraModeRef.current;
        if (cMode === 'hood') {
          _camDesired.copy(playerCar.position).add(new THREE.Vector3(0, 0.82, 0));
          _camLook.copy(playerCar.position).addScaledVector(_tangent, 8);
          camera.position.lerp(_camDesired, 0.45);
          camera.lookAt(_camLook);
        } else if (cMode === 'overhead') {
          _camDesired.copy(playerCar.position).add(new THREE.Vector3(0, 14, 6));
          camera.position.lerp(_camDesired, 0.15);
          camera.lookAt(playerCar.position);
        } else {
          // Chase Cam
          _camDesired
            .copy(playerCar.position)
            .addScaledVector(_tangent, -4.2)
            .add(new THREE.Vector3(0, 1.85, 0));
          _camLook.copy(playerCar.position).addScaledVector(_tangent, 5.5);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, 8, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, 8, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, 8, dt);
          camera.lookAt(_camLook);
        }

        // Update React HUD state at ~12Hz to avoid unnecessary React re-renders
        hudThrottleTimer += dt;
        if (hudThrottleTimer >= 0.08) {
          hudThrottleTimer = 0;
          setSpeedKmh(Math.round(Math.abs(speed) * 6.2));
          setBoostPct(Math.round(boostEnergy));
          setCurrentLapMs(Math.round(lapElapsed));
          updateScore(Math.round(totalScoreAccum));
          setPlayerMinimapPt({ x: playerCar.position.x, y: playerCar.position.z });
          if (ghostCar.visible) {
            setGhostMinimapPt({ x: ghostCar.position.x, y: ghostCar.position.z });
          } else {
            setGhostMinimapPt(null);
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, entry.contentRect.width);
        const h = Math.max(300, entry.contentRect.height);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      envTarget.dispose();
      roadTex.dispose();
      checkerTex.dispose();
      roadGeo.dispose();
      disposeThreeScene(scene, renderer);
    };
  }, [setGameState, triggerGameOver, updateScore]);

  // SVG path string for the 2D Track Minimap in bottom-left
  const minimapSvgPath =
    'M 0 12 L 0 -10 C -1 -18 -6 -24 -15 -24 C -22 -24 -25 -18 -24 -14 C -22 -6 -12 -2 -11 2 C -10 6 -16 14 -24 18 C -26 22 -23 28 -20 28 C -12 28 -2 24 0 20 Z';

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#14161d] overflow-hidden select-none">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Top Left Brand & Lap Timer HUD */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-3 px-4 py-2 rounded-xl bg-zinc-950/90 border border-amber-500/30 text-white pointer-events-auto tabular-nums">
        <span className="text-sm font-black italic tracking-wider text-amber-400 whitespace-nowrap">
          DESK RACER 3D
        </span>
        <span className="text-zinc-600" aria-hidden="true">·</span>
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <Flag className="w-3.5 h-3.5 text-red-400" />
          <span>LAP {lap}/{TOTAL_LAPS}</span>
        </div>
        <span className="text-zinc-600" aria-hidden="true">·</span>
        <div className="text-xs">
          <span className="text-zinc-400">Waktu: </span>
          <span className="font-mono font-bold text-cyan-300">{formatRaceTime(currentLapMs)}</span>
        </div>
        {bestLapMs !== null && (
          <>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <div className="text-xs">
              <span className="text-zinc-400">Best: </span>
              <span className="font-mono font-bold text-emerald-400">{formatRaceTime(bestLapMs)}</span>
            </div>
          </>
        )}
      </div>

      {/* Top Right Speedometer, Power-Up & Combo HUD */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-4 px-4 py-2 rounded-xl bg-zinc-950/90 border border-white/10 text-xs text-white pointer-events-auto tabular-nums">
        {comboMultiplier > 1 && (
          <div className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 text-zinc-950 font-black text-xs uppercase animate-pulse">
            {comboMultiplier}x COMBO
          </div>
        )}
        {hasShield && (
          <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
            <Shield className="w-4 h-4 fill-current" />
            <span>SHIELD</span>
          </div>
        )}
        {hasMagnet && (
          <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
            <Sparkles className="w-4 h-4 fill-current" />
            <span>MAGNET</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-red-400" />
          <span className="text-base font-black font-mono text-white">{speedKmh}</span>
          <span className="text-[10px] text-zinc-400">KM/H</span>
        </div>
        <span className="text-zinc-600" aria-hidden="true">·</span>
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-cyan-400" />
          <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-transform duration-75 origin-left"
              style={{ transform: `scaleX(${boostPct / 100})` }}
            />
          </div>
        </div>
        <span className="text-zinc-600" aria-hidden="true">·</span>
        <div>
          <span className="text-zinc-400">Skor: </span>
          <span className="font-bold text-amber-400">{score}</span>
        </div>
      </div>

      {/* Dynamic Toast Popup Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-500 text-zinc-950 font-black text-xs tracking-wider uppercase shadow-2xl animate-bounce flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Bottom-Left 2D Track Circuit Minimap */}
      <div className="absolute bottom-16 left-4 z-10 w-36 h-28 p-2 rounded-2xl bg-zinc-950/85 border border-white/15 pointer-events-none">
        <svg viewBox="-30 -30 36 64" className="w-full h-full overflow-visible">
          <path
            d={minimapSvgPath}
            fill="none"
            stroke="#334155"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={minimapSvgPath}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2.0"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {ghostMinimapPt && (
            <circle
              cx={ghostMinimapPt.x}
              cy={ghostMinimapPt.y}
              r="2.4"
              fill="#a855f7"
            />
          )}
          <circle
            cx={playerMinimapPt.x}
            cy={playerMinimapPt.y}
            r="3.0"
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Mobile Touch Steering Controls */}
      <div className="md:hidden absolute bottom-16 right-4 z-10 flex items-center gap-2 pointer-events-auto">
        <button
          onPointerDown={() => { keysRef.current.left = true; keysRef.current.up = true; }}
          onPointerUp={() => { keysRef.current.left = false; }}
          onPointerLeave={() => { keysRef.current.left = false; }}
          className="w-12 h-12 rounded-xl bg-zinc-900/90 border border-white/15 text-white font-bold text-sm active:bg-red-500"
        >
          ◀
        </button>
        <button
          onPointerDown={() => { keysRef.current.up = true; }}
          onPointerUp={() => { keysRef.current.up = false; }}
          className="px-4 h-12 rounded-xl bg-red-600/90 border border-red-400/30 text-white font-bold text-xs"
        >
          GAS
        </button>
        <button
          onPointerDown={() => { keysRef.current.right = true; keysRef.current.up = true; }}
          onPointerUp={() => { keysRef.current.right = false; }}
          onPointerLeave={() => { keysRef.current.right = false; }}
          className="w-12 h-12 rounded-xl bg-zinc-900/90 border border-white/15 text-white font-bold text-sm active:bg-red-500"
        >
          ▶
        </button>
      </div>

      {/* Race Finished Modal */}
      {raceFinished && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4">
          <div className="max-w-md w-full rounded-2xl bg-zinc-900 border border-red-500/40 p-6 text-center shadow-2xl">
            <Flag className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Desk Racer 3D Selesai!</h3>
            <p className="text-sm text-zinc-400 mb-4">
              3 Putaran Sirkuit Meja berhasil ditaklukkan
            </p>
            <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-zinc-950 border border-white/10 mb-5 tabular-nums">
              <div>
                <div className="text-[11px] text-zinc-400">Total Waktu</div>
                <div className="text-sm font-bold font-mono text-white">
                  {formatRaceTime(raceFinished.totalTimeMs)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">Best Lap</div>
                <div className="text-sm font-bold font-mono text-emerald-400">
                  {formatRaceTime(raceFinished.bestLapMs)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">Skor Akhir</div>
                <div className="text-sm font-bold font-mono text-amber-400">
                  {raceFinished.finalScore}
                </div>
              </div>
            </div>
            <button
              onClick={handleRestartRace}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              Balapan Lagi
            </button>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[min(860px,95vw)] flex flex-col items-center pointer-events-auto">
        <button
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="mb-1 px-3 py-1 rounded-t-lg bg-zinc-950/90 border border-b-0 border-white/15 text-[11px] font-medium text-zinc-300 hover:text-white flex items-center gap-1 whitespace-nowrap transition-colors"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Tampilkan Kontrol (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Sembunyikan Kontrol (H)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full px-4 py-2 rounded-2xl bg-zinc-950/95 border border-white/15 shadow-2xl flex flex-wrap items-center justify-between gap-3">
            {/* Camera Switcher */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5">
              <Eye className="w-3.5 h-3.5 text-zinc-400 ml-1.5 mr-1 shrink-0" />
              {(
                [
                  { id: 'chase', label: 'Chase Cam' },
                  { id: 'hood', label: 'Kokpit' },
                  { id: 'overhead', label: 'Helikopter' }
                ] as { id: CameraMode; label: string }[]
              ).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCameraMode(c.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    cameraMode === c.id
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Controls Hint */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 whitespace-nowrap">
              <span>Kemudi: WASD / Panah</span>
              <span aria-hidden="true">·</span>
              <span>Nitro Boost: Spasi</span>
            </div>

            {/* Ghost & Reset Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGhostEnabled((g) => !g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  ghostEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-zinc-900 text-zinc-400 border-white/10'
                }`}
              >
                <Ghost className="w-3.5 h-3.5" />
                {ghostEnabled ? 'Ghost: Aktif' : 'Ghost: Nonaktif'}
              </button>
              <button
                onClick={handleRestartRace}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-white/10 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Mulai Ulang (R)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
