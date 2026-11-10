import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useGameEngine } from '../../hooks/useGameEngine';
import { disposeThreeScene } from '../../utils/threeCleanup';
import { audio } from '../../utils/audio';
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

const LANES_X = [-3.6, 0, 3.6];
const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

function createSynthwaveRoadTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090614';
  ctx.fillRect(0, 0, 512, 512);

  // Outer magenta neon shoulders
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(0, 0, 16, 512);
  ctx.fillRect(512 - 16, 0, 16, 512);

  // Horizontal synth grid lines
  ctx.strokeStyle = 'rgba(217, 70, 239, 0.26)';
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
  grad.addColorStop(0, '#fef08a');
  grad.addColorStop(0.45, '#f97316');
  grad.addColorStop(0.85, '#ec4899');
  grad.addColorStop(1, '#7e22ce');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(256, 256, 240, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal retro scanline cutouts in lower half
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
    metalness: 0.8,
    roughness: 0.2,
    clearcoat: 1.0
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.5,
    roughness: 0.45
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x22d3ee,
    metalness: 0.1,
    roughness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.8,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.92
  });
  const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const neonRedMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });

  // 1. Main Wedge Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.34, 3.5), bodyMat);
  chassis.position.y = 0.36;
  chassis.castShadow = !isSoftwareGl;
  group.add(chassis);

  // 2. Slanted Front Nose
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.22, 0.9), bodyMat);
  nose.position.set(0, 0.28, -1.9);
  group.add(nose);

  // 3. Canopy Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.38, 1.65), glassMat);
  cabin.position.set(0, 0.66, -0.15);
  group.add(cabin);

  // 4. Outrun Rear Wing
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.07, 0.38), trimMat);
  wing.position.set(0, 0.82, 1.58);
  group.add(wing);

  const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.25), trimMat);
  strutL.position.set(-0.75, 0.65, 1.58);
  const strutR = strutL.clone();
  strutR.position.x = 0.75;
  group.add(strutL, strutR);

  // 5. Taillight Bar & Side Neon Strips
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.08), neonRedMat);
  tailBar.position.set(0, 0.44, 1.76);
  group.add(tailBar);

  const sideStripL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 3.2), neonCyanMat);
  sideStripL.position.set(-0.87, 0.24, 0);
  const sideStripR = sideStripL.clone();
  sideStripR.position.x = 0.87;
  group.add(sideStripL, sideStripR);

  // 6. Four Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.26, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.8 });
  const positions: [number, number, number][] = [
    [-0.9, 0.32, -1.1],
    [0.9, 0.32, -1.1],
    [-0.92, 0.32, 1.15],
    [0.92, 0.32, 1.15]
  ];
  for (const [wx, wy, wz] of positions) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, wy, wz);
    group.add(w);
    wheels.push(w);
  }

  // 7. Twin Plasma Afterburners
  const flameGeo = new THREE.ConeGeometry(0.16, 0.85, 8);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.4, 0.3, 2.15);
  flameL.visible = false;
  const flameR = flameL.clone();
  flameR.position.x = 0.4;
  flameR.visible = false;
  group.add(flameL, flameR);

  // 8. Synth Shield Energy Dome
  const shieldDome = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 20, 16),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      wireframe: true,
      transparent: true,
      opacity: 0.35
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
    new THREE.BoxGeometry(1.55, 0.42, 3.1),
    new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.65, roughness: 0.3 })
  );
  body.position.y = 0.4;
  g.add(body);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.35, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2, metalness: 0.8 })
  );
  top.position.set(0, 0.75, 0.1);
  g.add(top);

  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.09, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  tail.position.set(0, 0.46, 1.56);
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

  const raceStateRef = useRef({
    laneIdx: 1,
    visualX: 0,
    rollAngle: 0,
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
    const t = window.setTimeout(() => setToastMsg(null), 1200);
    return () => clearTimeout(t);
  }, []);

  const steerLeft = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (raceStateRef.current.laneIdx > 0) {
      raceStateRef.current.laneIdx -= 1;
      audio.playLaser();
      inputManager.vibrateGamepad(25, 0.2);
    }
  }, [gameStateRef]);

  const steerRight = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (raceStateRef.current.laneIdx < 2) {
      raceStateRef.current.laneIdx += 1;
      audio.playLaser();
      inputManager.vibrateGamepad(25, 0.2);
    }
  }, [gameStateRef]);

  const startGame = useCallback(() => {
    updateScore(0);
    setBoostEnergy(100);
    setCombo(1);
    setShields(1);
    setSpeedKmh(180);

    raceStateRef.current = {
      laneIdx: 1,
      visualX: 0,
      rollAngle: 0,
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
      audio.playClick();
    });
  }, [startWithCountdown, updateScore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        setCameraView((prev) => (prev === 'chase' ? 'cockpit' : prev === 'cockpit' ? 'aerial' : 'chase'));
        return;
      }
      if (gameStateRef.current !== 'playing') return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        steerLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        steerRight();
      } else if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        raceStateRef.current.isBoosting = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        raceStateRef.current.isBoosting = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStateRef, steerLeft, steerRight]);

  // Isolated Three.js Synthwave World
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = mount.clientWidth || 640;
    const height = mount.clientHeight || 480;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0418);
    scene.fog = new THREE.FogExp2(0x16072c, 0.012);

    const camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 260);
    camera.position.set(0, 2.8, 6.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xf472b6, 0x090414, 0.9);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfef08a, 1.5);
    sunLight.position.set(0, 24, -120);
    sunLight.castShadow = !isSoftwareGl;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 0.9);
    rimLight.position.set(10, 8, 12);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const roadTex = createSynthwaveRoadTexture(maxAniso);
    const sunTex = createRetroSunTexture();

    // Retro Sun Disc on Horizon
    const sunDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(76, 76),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false })
    );
    sunDisc.position.set(0, 22, -185);
    scene.add(sunDisc);

    // Highway Plane
    const roadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(12.2, 260),
      new THREE.MeshStandardMaterial({
        map: roadTex,
        roughness: 0.35,
        metalness: 0.4
      })
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.z = -110;
    roadMesh.receiveShadow = !isSoftwareGl;
    scene.add(roadMesh);

    // Flanking Outrun Mountains (Instanced)
    const mountainGeo = new THREE.ConeGeometry(9, 18, 4);
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x1e0936,
      emissive: 0x701a75,
      emissiveIntensity: 0.25,
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
      dummy.rotation.y = (i * 0.8);
      dummy.scale.set(1.1, scaleY, 1.1);
      dummy.updateMatrix();
      mountainInst.setMatrixAt(i, dummy.matrix);
    }
    mountainInst.computeBoundingSphere();
    scene.add(mountainInst);

    // Player Car
    const playerCar = buildSynthSupercar(isSoftwareGl);
    scene.add(playerCar.group);

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
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshBasicMaterial({ color: type === 'shield' ? 0x22d3ee : 0xf59e0b })
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.06, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      g.add(core, ring);
      g.position.set(LANES_X[idx], 0.9, -95 - idx * 70);
      scene.add(g);
      return { mesh: g, lane: idx, z: -95 - idx * 70, type, active: true };
    });

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let hudSyncTimer = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
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

      if (gameStateRef.current === 'playing') {
        if (st.invulnTimer > 0) st.invulnTimer -= delta;

        const activelyBoosting = st.isBoosting && st.boostEnergy > 1;
        if (activelyBoosting) {
          st.boostEnergy = Math.max(0, st.boostEnergy - 28 * delta);
        } else {
          st.boostEnergy = Math.min(100, st.boostEnergy + 12 * delta);
        }

        st.baseSpeed = Math.min(72, 40 + scoreRef.current * 0.008);
        const worldSpeed = st.baseSpeed * (activelyBoosting ? 1.65 : 1.0);

        roadTex.offset.y -= worldSpeed * 0.018 * delta;

        // Smooth lane interpolation
        const targetX = LANES_X[st.laneIdx];
        const diffX = targetX - st.visualX;
        st.visualX = THREE.MathUtils.damp(st.visualX, targetX, 14, delta);
        st.rollAngle = THREE.MathUtils.damp(st.rollAngle, -diffX * 0.08, 12, delta);

        playerCar.group.position.x = st.visualX;
        playerCar.group.rotation.z = st.rollAngle;
        playerCar.group.rotation.y = -diffX * 0.05;
        playerCar.flameL.visible = activelyBoosting;
        playerCar.flameR.visible = activelyBoosting;
        playerCar.shieldDome.visible = st.shields > 0;
        playerCar.shieldDome.rotation.y = elapsed * 1.5;

        playerCar.wheels.forEach((w) => {
          w.rotation.x -= worldSpeed * 0.35 * delta;
        });

        // Passive distance score
        st.distanceAcc += worldSpeed * delta * 0.45;
        if (st.distanceAcc >= 5) {
          const add = Math.floor(st.distanceAcc);
          st.distanceAcc -= add;
          updateScore(scoreRef.current + add);
        }

        // Update Pickups
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
              audio.playLevelUp();
              showToast('SYNTH SHIELD AKTIF!');
            } else {
              st.boostEnergy = 100;
              setBoostEnergy(100);
              audio.playCoin();
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

        // Update Traffic & Collisions
        for (const tc of trafficPool) {
          tc.z += (worldSpeed - tc.speed) * delta;
          tc.mesh.position.set(LANES_X[tc.lane], 0, tc.z);

          const dx = Math.abs(st.visualX - LANES_X[tc.lane]);
          const dz = Math.abs(tc.z);

          // Collision Check
          if (st.invulnTimer <= 0 && dz < 2.65 && dx < 1.35) {
            if (st.shields > 0) {
              st.shields -= 1;
              st.invulnTimer = 1.5;
              setShields(st.shields);
              audio.playExplosion();
              screenShake.trigger('medium');
              showToast('PERISAI MENAHAN BENTURAN!');
              tc.z = -190;
            } else {
              audio.playExplosion();
              screenShake.trigger('heavy');
              inputManager.vibrateGamepad(300, 0.9);
              triggerGameOver(scoreRef.current);
              break;
            }
          }

          // Near-miss / Overtake Check
          if (!tc.scoredNearMiss && tc.z > 2.2) {
            tc.scoredNearMiss = true;
            st.combo = Math.min(8, st.combo + 1);
            setCombo(st.combo);
            const pts = (activelyBoosting ? 35 : 20) * st.combo;
            updateScore(scoreRef.current + pts);
            audio.playScore();
            if (dx < 2.6) {
              showToast(`OVERTAKE DEKAT! +${pts} (x${st.combo})`);
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
          setBoostEnergy(Math.round(st.boostEnergy));
          setSpeedKmh(Math.round(worldSpeed * 4.5));
        }
      }

      // Camera Choreography
      const activelyBoosting = st.isBoosting && st.boostEnergy > 1;
      const targetFov = activelyBoosting ? 82 : 66;
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 6, delta);
      camera.updateProjectionMatrix();

      const view = cameraViewRef.current;
      if (view === 'chase') {
        _camPos.set(st.visualX * 0.65, 2.65, 6.2 + (activelyBoosting ? 0.6 : 0));
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
      camera.lookAt(_camTarget);

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      roadTex.dispose();
      sunTex.dispose();
      disposeThreeScene(scene, renderer);
    };
  }, [gameStateRef, scoreRef, showToast, triggerGameOver, updateScore]);

  return (
    <div className="relative w-full h-full min-h-[480px] flex flex-col items-center justify-center bg-[#0b0418] overflow-hidden select-none">
      {/* Dedicated WebGL Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 bg-slate-950/90 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-mono tabular-nums">
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

        <div className="bg-slate-950/90 border border-white/10 px-4 py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-slate-400 mr-2">SKOR</span>
          <span className="text-white font-bold text-base">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-fuchsia-500/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-fuchsia-300 tracking-wide shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* Mobile Touch Steering Bar */}
      {gameState === 'playing' && (
        <div className="absolute bottom-20 left-4 right-4 z-10 flex gap-2 md:hidden pointer-events-auto">
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              steerLeft();
            }}
            onClick={steerLeft}
            className="flex-1 py-3 bg-slate-950/90 border border-fuchsia-500/40 rounded-xl text-white font-bold text-xs uppercase tracking-wider active:bg-fuchsia-600"
          >
            ◀ Jalur Kiri
          </button>
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              raceStateRef.current.isBoosting = true;
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              raceStateRef.current.isBoosting = false;
            }}
            className="px-5 py-3 bg-cyan-600 active:bg-cyan-500 rounded-xl text-slate-950 font-bold text-xs uppercase tracking-wider"
          >
            Boost
          </button>
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              steerRight();
            }}
            onClick={steerRight}
            className="flex-1 py-3 bg-slate-950/90 border border-fuchsia-500/40 rounded-xl text-white font-bold text-xs uppercase tracking-wider active:bg-fuchsia-600"
          >
            Jalur Kanan ▶
          </button>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-[640px] transition-transform duration-200 pointer-events-auto"
        style={{ transform: `translate(-50%, ${dockCollapsed ? 'calc(100% - 28px)' : '0px'})` }}
      >
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="px-3 py-1 rounded-t-lg bg-slate-950/90 border border-b-0 border-white/10 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {dockCollapsed ? 'Tampilkan Kontrol' : 'Sembunyikan Kontrol'}
          </button>
        </div>

        <div className="bg-slate-950/95 border border-white/10 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-fuchsia-400 shrink-0" />
            {(['chase', 'cockpit', 'aerial'] as CameraView[]).map((view) => (
              <button
                key={view}
                onClick={() => setCameraView(view)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                  cameraView === view
                    ? 'bg-fuchsia-500 text-white font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {view}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 font-mono">TURBO</span>
            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
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
