import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useGameEngine, audioController } from '../../sdk';
import { ThreeStageController, createWetAsphaltMaps } from '../../utils/threeStage';
import { screenShake } from '../../utils/screenShake';
import { inputManager } from '../../services/inputService';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Flame, Sparkles, Shield, Eye, Gauge, ChevronDown, ChevronUp } from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

type CameraView = 'chase' | 'cockpit' | 'aerial';

interface TrafficCar3D {
  mesh: THREE.Group;
  lane: number;
  z: number;
  speed: number;
  scoredNearMiss: boolean;
}

interface PickupOrb3D {
  mesh: THREE.Group;
  lane: number;
  z: number;
  type: 'shield' | 'turbo';
  active: boolean;
}

interface TrailSlot {
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

const LANES_X = [-3.6, 0, 3.6];
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _trailDummy = new THREE.Object3D();
const _trailColor = new THREE.Color();

function createSynthwaveRoadTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090614';
  ctx.fillRect(0, 0, 512, 512);

  // Outer magenta neon shoulders
  ctx.fillStyle = '#f472b6';
  ctx.fillRect(0, 0, 18, 512);
  ctx.fillRect(512 - 18, 0, 18, 512);

  // Horizontal synth grid lines
  ctx.strokeStyle = 'rgba(217, 70, 239, 0.34)';
  ctx.lineWidth = 3;
  for (let y = 0; y < 512; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Cyan lane dividers
  ctx.fillStyle = '#22d3ee';
  const dividers = [170, 342];
  for (const dx of dividers) {
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(dx - 4, y, 8, 36);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function createRetroSunTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#fef9c3');
  grad.addColorStop(0.42, '#fb923c');
  grad.addColorStop(0.8, '#ec4899');
  grad.addColorStop(1, '#7e22ce');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(256, 256, 240, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) {
    const y = 275 + i * 32;
    const h = 6 + i * 3.5;
    ctx.fillRect(0, y, 512, h);
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSynthSupercar(isSoftwareGl: boolean): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  flameL: THREE.Mesh;
  flameR: THREE.Mesh;
  shieldDome: THREE.Mesh;
} {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xd946ef,
    metalness: 0.84,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.6,
    roughness: 0.42
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x22d3ee,
    metalness: 0.15,
    roughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.78,
    transparent: true,
    opacity: isSoftwareGl ? 0.6 : 0.92
  });
  const neonCyanMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.9,
    roughness: 0.2
  });
  const neonRedMat = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    emissive: 0xf43f5e,
    emissiveIntensity: 2.3,
    roughness: 0.2
  });

  // 1. Sleek Extruded Wedge Silhouette Body
  const profile = new THREE.Shape();
  profile.moveTo(-2.15, 0.16);
  profile.lineTo(-1.35, 0.42);
  profile.lineTo(-0.4, 0.48);
  profile.lineTo(0.25, 0.72);
  profile.lineTo(1.15, 0.66);
  profile.lineTo(1.85, 0.56);
  profile.lineTo(1.82, 0.18);
  profile.closePath();

  const wedgeGeo = new THREE.ExtrudeGeometry(profile, {
    depth: 1.56,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 2
  });
  wedgeGeo.center();
  // Orient profile X -> -Z (nose forward), extrude Z -> X
  wedgeGeo.rotateY(-Math.PI / 2);
  const chassis = new THREE.Mesh(wedgeGeo, bodyMat);
  chassis.position.set(0, 0.42, -0.05);
  chassis.castShadow = !isSoftwareGl;
  group.add(chassis);

  // 2. Sculpted Rounded Canopy Cabin
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.26, 0.34, 1.55, 3, 0.12), glassMat);
  cabin.position.set(0, 0.68, -0.05);
  group.add(cabin);

  // 3. Front Carbon Splitter
  const splitter = new THREE.Mesh(new RoundedBoxGeometry(1.74, 0.08, 0.55, 2, 0.03), trimMat);
  splitter.position.set(0, 0.16, -1.96);
  group.add(splitter);

  // 4. Outrun Rear Wing & Struts
  const wing = new THREE.Mesh(new RoundedBoxGeometry(1.84, 0.07, 0.4, 2, 0.025), trimMat);
  wing.position.set(0, 0.88, 1.62);
  wing.castShadow = !isSoftwareGl;
  group.add(wing);

  const strutL = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.32, 0.24, 2, 0.02), trimMat);
  strutL.position.set(-0.72, 0.72, 1.6);
  const strutR = strutL.clone();
  strutR.position.x = 0.72;
  group.add(strutL, strutR);

  // 5. HDR Emissive Tail-Light Strip, Headlights & Side Neon Underglow
  const tailBar = new THREE.Mesh(new RoundedBoxGeometry(1.58, 0.09, 0.08, 2, 0.025), neonRedMat);
  tailBar.position.set(0, 0.46, 1.88);
  group.add(tailBar);

  const headStrip = new THREE.Mesh(new RoundedBoxGeometry(1.48, 0.06, 0.08, 2, 0.02), neonCyanMat);
  headStrip.position.set(0, 0.28, -2.14);
  group.add(headStrip);

  const sideStripL = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.06, 3.25, 2, 0.02), neonCyanMat);
  sideStripL.position.set(-0.88, 0.22, 0.02);
  const sideStripR = sideStripL.clone();
  sideStripR.position.x = 0.88;
  group.add(sideStripL, sideStripR);

  // 6. Four Wheels with glowing rim accents
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.29, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.8 });
  const positions: [number, number, number][] = [
    [-0.9, 0.32, -1.12],
    [0.9, 0.32, -1.12],
    [-0.93, 0.32, 1.15],
    [0.93, 0.32, 1.15]
  ];
  for (const [wx, wy, wz] of positions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    w.castShadow = !isSoftwareGl;
    const rim = new THREE.Mesh(rimGeo, neonCyanMat);
    w.add(rim);
    group.add(w);
    wheels.push(w);
  }

  // 7. Twin Plasma Afterburners
  const flameGeo = new THREE.ConeGeometry(0.16, 0.9, 10);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.5,
    roughness: 0.1
  });
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.4, 0.3, 2.25);
  flameL.visible = false;
  const flameR = flameL.clone();
  flameR.position.x = 0.4;
  flameR.visible = false;
  group.add(flameL, flameR);

  // 8. Synth Shield Energy Dome
  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(2.15, 20, 16),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      wireframe: true,
      transparent: true,
      opacity: 0.38
    })
  );
  shieldDome.position.y = 0.5;
  shieldDome.visible = false;
  group.add(shieldDome);

  return { group, wheels, flameL, flameR, shieldDome };
}

function buildTrafficVehicle(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(1.58, 0.42, 3.15, 2, 0.1),
    new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.68, roughness: 0.28 })
  );
  body.position.y = 0.4;
  body.castShadow = true;
  g.add(body);

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(1.24, 0.34, 1.52, 2, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.18, metalness: 0.85 })
  );
  top.position.set(0, 0.74, 0.1);
  g.add(top);

  const tail = new THREE.Mesh(
    new RoundedBoxGeometry(1.42, 0.09, 0.08, 2, 0.02),
    new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xef4444,
      emissiveIntensity: 2.0,
      roughness: 0.2
    })
  );
  tail.position.set(0, 0.46, 1.58);
  g.add(tail);

  return g;
}

export default function VaporwaveRacerGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const {
    gameState,
    score,
    updateScore,
    triggerGameOver,
    startWithCountdown,
    resumeGame,
    countdown,
    gameStateRef,
    scoreRef
  } = useGameEngine({
    gameId: 'vaporwave-racer',
    onGameOver,
    onScoreUpdate
  });

  const [boostEnergy, setBoostEnergy] = useState(100);
  const [combo, setCombo] = useState(1);
  const [shields, setShields] = useState(1);
  const [speedKmh, setSpeedKmh] = useState(180);
  const [cameraView, setCameraView] = useState<CameraView>('chase');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const cameraViewRef = useRef<CameraView>('chase');
  const toastTimerRef = useRef<number | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const lastBoostShownRef = useRef(100);
  const lastSpeedShownRef = useRef(180);

  const raceStateRef = useRef({
    laneIdx: 1,
    visualX: 0,
    rollAngle: 0,
    camRoll: 0,
    isBoosting: false,
    boostEnergy: 100,
    shields: 1,
    invulnTimer: 0,
    combo: 1,
    baseSpeed: 38,
    distanceAcc: 0,
    resetRequested: true
  });

  useEffect(() => {
    cameraViewRef.current = cameraView;
  }, [cameraView]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 1200);
  }, []);

  const steerLeft = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (raceStateRef.current.laneIdx > 0) {
      raceStateRef.current.laneIdx -= 1;
      audioController.playLaser();
      inputManager.vibrateGamepad(25, 0.2);
    }
  }, [gameStateRef]);

  const steerRight = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (raceStateRef.current.laneIdx < 2) {
      raceStateRef.current.laneIdx += 1;
      audioController.playLaser();
      inputManager.vibrateGamepad(25, 0.2);
    }
  }, [gameStateRef]);

  const startGame = useCallback(() => {
    updateScore(0);
    lastBoostShownRef.current = 100;
    lastSpeedShownRef.current = 180;
    setBoostEnergy(100);
    setCombo(1);
    setShields(1);
    setSpeedKmh(180);

    raceStateRef.current = {
      laneIdx: 1,
      visualX: 0,
      rollAngle: 0,
      camRoll: 0,
      isBoosting: false,
      boostEnergy: 100,
      shields: 1,
      invulnTimer: 0,
      combo: 1,
      baseSpeed: 40,
      distanceAcc: 0,
      resetRequested: true
    };

    startWithCountdown(() => {
      audioController.playClick();
    });
  }, [startWithCountdown, updateScore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        setCameraView((prev) => (prev === 'chase' ? 'cockpit' : prev === 'cockpit' ? 'aerial' : 'chase'));
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (gameStateRef.current !== 'playing') return;
        if (action === 'LEFT') steerLeft();
        else if (action === 'RIGHT') steerRight();
        else if (action === 'UP' || action === 'PRIMARY' || action === 'ACTION_PRIMARY') {
          raceStateRef.current.isBoosting = true;
        }
      },
      onActionUp: (action) => {
        if (action === 'UP' || action === 'PRIMARY' || action === 'ACTION_PRIMARY') {
          raceStateRef.current.isBoosting = false;
        }
      }
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsub();
    };
  }, [gameStateRef, steerLeft, steerRight]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container: mount,
        backgroundColor: 0x0b0418,
        fogColor: 0x16072c,
        fogDensity: 0.011,
        fov: 66,
        near: 0.1,
        far: 260,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 16,
        toneMappingExposure: 1.15,
        bloom: {
          enabled: true,
          strength: 0.58,
          radius: 0.45,
          threshold: 0.78
        }
      });
    } catch {
      return;
    }

    const { scene, camera, renderer, isSoftwareGl } = stage;
    camera.position.set(0, 2.8, 6.2);

    // Synthwave Lighting Rig
    stage.hemiLight.color.setHex(0xf472b6);
    stage.hemiLight.groundColor.setHex(0x090414);
    stage.hemiLight.intensity = 0.9;

    stage.keyLight.color.setHex(0xfef08a);
    stage.keyLight.intensity = 1.65;
    stage.keyLight.position.set(0, 22, -45);

    stage.rimLight.color.setHex(0x22d3ee);
    stage.rimLight.intensity = 1.05;
    stage.rimLight.position.set(10, 8, 12);

    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const roadTex = createSynthwaveRoadTexture(maxAniso);
    const wetMaps = createWetAsphaltMaps(renderer, {
      baseColor: '#0a0616',
      puddleIntensity: 0.8,
      repeatX: 1,
      repeatY: 14
    });
    const sunTex = createRetroSunTexture();

    // Retro Sun Disc + Bloom Halo on Horizon
    const sunDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(76, 76),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false })
    );
    sunDisc.position.set(0, 22, -185);
    scene.add(sunDisc);

    // Wet Asphalt Neon Highway Plane
    const roadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(12.2, 260),
      new THREE.MeshStandardMaterial({
        map: roadTex,
        emissiveMap: roadTex,
        emissive: new THREE.Color(0xd946ef),
        emissiveIntensity: 0.45,
        roughnessMap: wetMaps.roughnessMap,
        bumpMap: wetMaps.bumpMap,
        bumpScale: 0.035,
        roughness: 0.9,
        metalness: 0.45
      })
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.z = -110;
    roadMesh.receiveShadow = !isSoftwareGl;
    scene.add(roadMesh);

    // Glowing Neon Guardrails
    const railGeo = new THREE.BoxGeometry(0.16, 0.22, 260);
    const leftRailMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xec4899,
      emissiveIntensity: 1.75,
      roughness: 0.2
    });
    const rightRailMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.75,
      roughness: 0.2
    });
    const leftRail = new THREE.Mesh(railGeo, leftRailMat);
    leftRail.position.set(-6.25, 0.25, -110);
    const rightRail = new THREE.Mesh(railGeo, rightRailMat);
    rightRail.position.set(6.25, 0.25, -110);
    scene.add(leftRail, rightRail);

    // Flanking Outrun Mountains (Instanced)
    const mountainGeo = new THREE.ConeGeometry(9, 18, 4);
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x1e0936,
      emissive: 0x701a75,
      emissiveIntensity: 0.32,
      roughness: 0.5,
      metalness: 0.3,
      flatShading: true
    });
    const mountainCount = 28;
    const mountainInst = new THREE.InstancedMesh(mountainGeo, mountainMat, mountainCount);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < mountainCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const zPos = -i * 9.5 + 10;
      const xPos = side * (16 + (i % 3) * 4);
      const scaleY = 0.7 + ((i * 7) % 5) * 0.25;
      dummy.position.set(xPos, 7 * scaleY, zPos);
      dummy.rotation.y = i * 0.8;
      dummy.scale.set(1.1, scaleY, 1.1);
      dummy.updateMatrix();
      mountainInst.setMatrixAt(i, dummy.matrix);
    }
    mountainInst.computeBoundingSphere();
    scene.add(mountainInst);

    // Player Car
    const playerCar = buildSynthSupercar(isSoftwareGl);
    scene.add(playerCar.group);

    // Instanced Boost & Drift Trail Particles
    const trailCap = isSoftwareGl ? 36 : 96;
    const trailGeo = new THREE.BoxGeometry(0.14, 0.08, 0.65);
    const trailMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.9,
      roughness: 0.2
    });
    const trailMesh = new THREE.InstancedMesh(trailGeo, trailMat, trailCap);
    trailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    trailMesh.frustumCulled = false;
    const trailSlots: TrailSlot[] = Array.from({ length: trailCap }, () => ({
      active: false,
      x: 0,
      y: -99,
      z: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 0.4,
      r: 0.2,
      g: 0.85,
      b: 1.0
    }));
    let trailCursor = 0;
    _trailDummy.position.set(0, -99, 0);
    _trailDummy.scale.set(0, 0, 0);
    _trailDummy.updateMatrix();
    _trailColor.setHex(0x22d3ee);
    for (let i = 0; i < trailCap; i++) {
      trailMesh.setMatrixAt(i, _trailDummy.matrix);
      trailMesh.setColorAt(i, _trailColor);
    }
    trailMesh.instanceMatrix.needsUpdate = true;
    if (trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;
    scene.add(trailMesh);

    const spawnTrailPair = (carX: number, boost: boolean, lean: number) => {
      const offsets = [-0.88, 0.88];
      for (const ox of offsets) {
        const slot = trailSlots[trailCursor];
        trailCursor = (trailCursor + 1) % trailCap;
        slot.active = true;
        slot.x = carX + ox;
        slot.y = 0.16;
        slot.z = 1.65;
        slot.vx = lean * 1.4 + (Math.random() - 0.5) * 0.6;
        slot.vy = boost ? 0.8 + Math.random() * 0.6 : 0.25;
        slot.maxLife = boost ? 0.34 : 0.22;
        slot.life = slot.maxLife;
        if (boost) {
          slot.r = 0.22;
          slot.g = 0.88;
          slot.b = 1.0;
        } else {
          slot.r = 0.96;
          slot.g = 0.28;
          slot.b = 0.72;
        }
      }
    };

    // Traffic Pool (6 vehicles)
    const trafficColors = [0x38bdf8, 0xfbbf24, 0xf43f5e, 0xa855f7, 0x10b981, 0xec4899];
    const trafficPool: TrafficCar3D[] = [];
    for (let i = 0; i < 6; i++) {
      const mesh = buildTrafficVehicle(trafficColors[i % trafficColors.length]);
      const lane = i % 3;
      const z = -40 - i * 32;
      mesh.position.set(LANES_X[lane], 0, z);
      scene.add(mesh);
      trafficPool.push({
        mesh,
        lane,
        z,
        speed: 18 + (i % 3) * 4,
        scoredNearMiss: false
      });
    }

    // Power-up Pickups (2 items: Shield & Turbo)
    const pickups: PickupOrb3D[] = [0, 1].map((idx) => {
      const type = idx === 0 ? 'shield' : 'turbo';
      const g = new THREE.Group();
      const coreColor = type === 'shield' ? 0x22d3ee : 0xf59e0b;
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({
          color: coreColor,
          emissive: coreColor,
          emissiveIntensity: 1.85,
          roughness: 0.15
        })
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.06, 8, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: coreColor,
          emissiveIntensity: 1.3
        })
      );
      g.add(core, ring);
      g.position.set(LANES_X[idx], 0.9, -95 - idx * 70);
      scene.add(g);
      return { mesh: g, lane: idx, z: -95 - idx * 70, type, active: true };
    });

    let hudSyncTimer = 0;
    let trailSpawnAcc = 0;

    stage.startLoop((dt, elapsed) => {
      const delta = Math.min(dt, 0.05);
      const st = raceStateRef.current;

      if (st.resetRequested) {
        st.resetRequested = false;
        trafficPool.forEach((tc, idx) => {
          tc.lane = idx % 3;
          tc.z = -45 - idx * 34;
          tc.scoredNearMiss = false;
          tc.mesh.position.set(LANES_X[tc.lane], 0, tc.z);
        });
      }

      const activelyBoosting = st.isBoosting && st.boostEnergy > 1;
      const worldSpeed = st.baseSpeed * (activelyBoosting ? 1.65 : 1.0);
      const targetX = LANES_X[st.laneIdx];
      const diffX = targetX - st.visualX;

      if (gameStateRef.current === 'playing') {
        if (st.invulnTimer > 0) st.invulnTimer -= delta;

        if (activelyBoosting) {
          st.boostEnergy = Math.max(0, st.boostEnergy - 28 * delta);
        } else {
          st.boostEnergy = Math.min(100, st.boostEnergy + 12 * delta);
        }

        st.baseSpeed = Math.min(72, 40 + scoreRef.current * 0.008);

        const uvScroll = worldSpeed * 0.018 * delta;
        roadTex.offset.y -= uvScroll;
        wetMaps.roughnessMap.offset.y -= uvScroll;
        wetMaps.bumpMap.offset.y -= uvScroll;

        st.visualX = THREE.MathUtils.damp(st.visualX, targetX, 14, delta);
        st.rollAngle = THREE.MathUtils.damp(st.rollAngle, -diffX * 0.085, 12, delta);
        st.camRoll = THREE.MathUtils.damp(st.camRoll, -diffX * 0.028, 10, delta);

        playerCar.group.position.x = st.visualX;
        playerCar.group.rotation.z = st.rollAngle;
        playerCar.group.rotation.y = -diffX * 0.05;
        playerCar.flameL.visible = activelyBoosting;
        playerCar.flameR.visible = activelyBoosting;
        if (activelyBoosting) {
          const fScale = 0.9 + Math.sin(elapsed * 32) * 0.2;
          playerCar.flameL.scale.set(1, fScale, 1);
          playerCar.flameR.scale.set(1, fScale, 1);
        }
        playerCar.shieldDome.visible = st.shields > 0;
        playerCar.shieldDome.rotation.y = elapsed * 1.5;

        playerCar.wheels.forEach((w) => {
          w.rotation.x -= worldSpeed * 0.35 * delta;
        });

        // Spawn instanced trail streaks on boost or lane change
        if (activelyBoosting || Math.abs(diffX) > 0.25) {
          trailSpawnAcc += delta;
          if (trailSpawnAcc >= 0.025) {
            trailSpawnAcc = 0;
            spawnTrailPair(st.visualX, activelyBoosting, diffX);
          }
        }

        st.distanceAcc += worldSpeed * delta * 0.45;
        if (st.distanceAcc >= 5) {
          const add = Math.floor(st.distanceAcc);
          st.distanceAcc -= add;
          updateScore(scoreRef.current + add);
        }

        for (const p of pickups) {
          p.z += worldSpeed * delta;
          p.mesh.position.set(LANES_X[p.lane], 0.9 + Math.sin(elapsed * 4) * 0.15, p.z);
          p.mesh.rotation.y = elapsed * 2.5;

          if (p.active && Math.abs(p.z) < 2.2 && Math.abs(st.visualX - LANES_X[p.lane]) < 1.3) {
            p.active = false;
            p.mesh.visible = false;
            if (p.type === 'shield') {
              st.shields = Math.min(3, st.shields + 1);
              setShields(st.shields);
              audioController.playShield();
              showToast('SYNTH SHIELD AKTIF!');
            } else {
              st.boostEnergy = 100;
              lastBoostShownRef.current = 100;
              setBoostEnergy(100);
              stage.cameraRig.kickFov(6);
              audioController.playPowerup();
              showToast('TURBO CELL +100%!');
            }
          }

          if (p.z > 12) {
            p.z = -160 - Math.random() * 80;
            p.lane = Math.floor(Math.random() * 3);
            p.active = true;
            p.mesh.visible = true;
          }
        }

        for (const tc of trafficPool) {
          tc.z += (worldSpeed - tc.speed) * delta;
          tc.mesh.position.set(LANES_X[tc.lane], 0, tc.z);

          const dx = Math.abs(st.visualX - LANES_X[tc.lane]);
          const dz = Math.abs(tc.z);

          if (st.invulnTimer <= 0 && dz < 2.65 && dx < 1.35) {
            stage.cameraRig.addTrauma(0.65);
            stage.particles.burst(st.visualX, 0.7, 0, isSoftwareGl ? 10 : 28, 0xf43f5e, 7, 1.2, 12);
            if (st.shields > 0) {
              st.shields -= 1;
              st.invulnTimer = 1.5;
              setShields(st.shields);
              audioController.playExplosion();
              screenShake.trigger('medium');
              showToast('PERISAI MENAHAN BENTURAN!');
              tc.z = -190;
            } else {
              audioController.playExplosion();
              audioController.playGameOver();
              screenShake.trigger('heavy');
              inputManager.vibrateGamepad(300, 0.9);
              triggerGameOver(scoreRef.current);
              break;
            }
          }

          if (!tc.scoredNearMiss && tc.z > 2.2) {
            tc.scoredNearMiss = true;
            st.combo = Math.min(8, st.combo + 1);
            setCombo(st.combo);
            const pts = (activelyBoosting ? 35 : 20) * st.combo;
            updateScore(scoreRef.current + pts);
            if (dx < 2.6) {
              audioController.playNearMiss();
              showToast(`OVERTAKE DEKAT! +${pts} (x${st.combo})`);
            } else {
              audioController.playScore();
            }
          }

          if (tc.z > 14) {
            tc.z = -180 - Math.random() * 60;
            tc.lane = Math.floor(Math.random() * 3);
            tc.scoredNearMiss = false;
          }
        }

        hudSyncTimer += delta;
        if (hudSyncTimer > 0.12) {
          hudSyncTimer = 0;
          const nextBoost = Math.round(st.boostEnergy);
          if (nextBoost !== lastBoostShownRef.current) {
            lastBoostShownRef.current = nextBoost;
            setBoostEnergy(nextBoost);
          }
          const nextSpeed = Math.round(worldSpeed * 4.5);
          if (nextSpeed !== lastSpeedShownRef.current) {
            lastSpeedShownRef.current = nextSpeed;
            setSpeedKmh(nextSpeed);
          }
        }
      }

      // Step instanced drift/boost trail particles
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
        s.z += worldSpeed * delta * 0.9;
        const ratio = s.life / s.maxLife;
        _trailDummy.position.set(s.x, s.y, s.z);
        _trailDummy.scale.set(ratio * 1.1, ratio * 1.1, 0.7 + (1 - ratio) * 1.2);
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
      const speedRatio = Math.max(0, (worldSpeed - 38) / 78);
      stage.cameraRig.updateDynamicFov(camera, 66, speedRatio + (activelyBoosting ? 0.35 : 0), delta, 16);

      const view = cameraViewRef.current;
      if (view === 'chase') {
        _camPos.set(st.visualX * 0.65, 2.65, 6.2 + (activelyBoosting ? 0.55 : 0));
        _camTarget.set(st.visualX * 0.8, 1.1, -18);
      } else if (view === 'cockpit') {
        _camPos.set(st.visualX, 0.95, -0.5);
        _camTarget.set(st.visualX, 0.9, -30);
      } else {
        _camPos.set(st.visualX * 0.35, 11.5, 8.5);
        _camTarget.set(st.visualX * 0.4, 0, -16);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camPos.x, 10, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camPos.y, 10, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camPos.z, 10, delta);
      stage.cameraRig.applyTraumaToCamera(camera, camera.position.clone(), delta, 0.42);
      camera.lookAt(_camTarget);
      if (view !== 'aerial') {
        camera.rotateZ(st.camRoll);
      }
    });

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      roadTex.dispose();
      wetMaps.dispose();
      sunTex.dispose();
      stage.dispose();
    };
  }, [gameStateRef, scoreRef, showToast, triggerGameOver, updateScore]);

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[480px] flex flex-col items-center justify-center bg-[#0b0418] overflow-hidden select-none touch-none">
      {/* Dedicated WebGL Mount */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full touch-none"
        onPointerDown={(e) => {
          swipeStartXRef.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (swipeStartXRef.current === null) return;
          const dx = e.clientX - swipeStartXRef.current;
          swipeStartXRef.current = null;
          if (dx < -28) steerLeft();
          else if (dx > 28) steerRight();
        }}
        onPointerCancel={() => {
          swipeStartXRef.current = null;
        }}
      />

      {/* Top HUD */}
      <div className="absolute top-3 left-3 right-3 sm:left-4 sm:right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-950/90 border border-white/10 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-fuchsia-400 font-semibold flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5" />
            {speedKmh} KM/H
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-cyan-400 font-semibold flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            {shields}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            x{combo}
          </span>
        </div>

        <div className="bg-slate-950/90 border border-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-slate-400 mr-2">SKOR</span>
          <span className="text-white font-bold text-sm sm:text-base">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-fuchsia-500/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-fuchsia-300 tracking-wide shadow-lg whitespace-nowrap">
          {toastMsg}
        </div>
      )}

      {/* Mobile Touch Steering Bar */}
      {gameState === 'playing' && (
        <div className="absolute bottom-24 sm:bottom-20 left-3 right-3 z-10 flex gap-2 md:hidden pointer-events-auto touch-none pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              steerLeft();
            }}
            className="flex-1 min-h-[44px] py-2.5 bg-slate-950/90 border border-fuchsia-500/40 rounded-xl text-white font-bold text-xs tracking-wider active:bg-fuchsia-600 touch-none whitespace-nowrap"
          >
            ◀ Kiri
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              raceStateRef.current.isBoosting = true;
            }}
            onPointerUp={() => {
              raceStateRef.current.isBoosting = false;
            }}
            onPointerLeave={() => {
              raceStateRef.current.isBoosting = false;
            }}
            onPointerCancel={() => {
              raceStateRef.current.isBoosting = false;
            }}
            className="min-h-[44px] px-5 py-2.5 bg-cyan-600 active:bg-cyan-500 rounded-xl text-slate-950 font-bold text-xs tracking-wider touch-none whitespace-nowrap"
          >
            Boost
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              steerRight();
            }}
            className="flex-1 min-h-[44px] py-2.5 bg-slate-950/90 border border-fuchsia-500/40 rounded-xl text-white font-bold text-xs tracking-wider active:bg-fuchsia-600 touch-none whitespace-nowrap"
          >
            Kanan ▶
          </button>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-[640px] transition-transform duration-200 pointer-events-auto pb-[env(safe-area-inset-bottom)]"
        style={{ transform: `translate(-50%, ${dockCollapsed ? 'calc(100% - 28px)' : '0px'})` }}
      >
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="min-h-[36px] sm:min-h-0 px-3 py-1 rounded-t-lg bg-slate-950/90 border border-b-0 border-white/10 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {dockCollapsed ? 'Tampilkan Kontrol' : 'Sembunyikan Kontrol'}
          </button>
        </div>

        <div className="bg-slate-950/95 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Eye className="w-4 h-4 text-fuchsia-400 shrink-0" />
            {(['chase', 'cockpit', 'aerial'] as CameraView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setCameraView(view)}
                className={`min-h-[40px] sm:min-h-0 px-2.5 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                  cameraView === view
                    ? 'bg-fuchsia-500 text-white font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 tabular-nums">
            <Flame className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 font-mono">TURBO</span>
            <div className="w-20 sm:w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all duration-100"
                style={{ width: `${boostEnergy}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        countdown={countdown}
        onStart={startGame}
        onRestart={startGame}
        onResume={resumeGame}
        gameTitle="VAPORWAVE RACER 3D"
        instructions="Kemudikan supercar synthwave 3D melintasi jalan raya neon! Gunakan A/D atau Panah Kiri/Kanan untuk pindah jalur, dan tahan SPASI untuk Turbo Afterburner."
      />
    </div>
  );
}
