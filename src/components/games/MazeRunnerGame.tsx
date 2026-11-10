import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../hooks/useGameEngine';
import { disposeThreeScene } from '../../utils/threeCleanup';
import { screenShake } from '../../utils/screenShake';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Eye, Zap, Clock, Compass, ChevronDown, ChevronUp, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type MazeCell = 'wall' | 'path' | 'start' | 'goal' | 'orb' | 'phase';
type CameraPreset = 'chase' | 'isometric' | 'overhead';

interface FallingWallFragment {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
}

const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();

function createFloorGridTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 504);

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 2;
  for (let i = 64; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function buildExplorerDrone(isSoftwareGl: boolean): {
  group: THREE.Group;
  ring: THREE.Mesh;
  core: THREE.Mesh;
} {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    metalness: 0.85,
    roughness: 0.2,
    clearcoat: 1.0
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.6,
    roughness: 0.45
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.9,
    roughness: 0.15,
    metalness: 0.2
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    metalness: 0.1,
    roughness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.95
  });

  // 1. Primary Chassis Hull
  const hull = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 1), hullMat);
  hull.scale.set(1, 0.55, 1.25);
  hull.position.y = 0.36;
  hull.castShadow = !isSoftwareGl;
  group.add(hull);

  // 2. Cockpit Canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), canopyMat);
  canopy.scale.set(0.9, 0.6, 1.1);
  canopy.position.set(0, 0.48, -0.05);
  group.add(canopy);

  // 3. Rotating Gyro Scanner Ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 28), trimMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.36;
  group.add(ring);

  // 4. Twin Side Thruster Pods
  const podGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.36, 12);
  podGeo.rotateX(Math.PI / 2);
  const podL = new THREE.Mesh(podGeo, trimMat);
  podL.position.set(-0.32, 0.34, 0.08);
  const podR = podL.clone();
  podR.position.x = 0.32;
  group.add(podL, podR);

  // 5. Glowing Energy Core
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), coreMat);
  core.position.set(0, 0.66, 0);
  group.add(core);

  return { group, ring, core };
}

function generateSolvableMaze(size: number): MazeCell[][] {
  const grid: MazeCell[][] = Array.from({ length: size }, () => Array(size).fill('wall'));

  const stack: [number, number][] = [[1, 1]];
  grid[1][1] = 'path';

  const dirs = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2]
  ];

  while (stack.length > 0) {
    const [cr, cc] = stack[stack.length - 1];
    const neighbors: [number, number, number, number][] = [];

    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr > 0 && nr < size - 1 && nc > 0 && nc < size - 1 && grid[nr][nc] === 'wall') {
        neighbors.push([nr, nc, cr + dr / 2, cc + dc / 2]);
      }
    }

    if (neighbors.length > 0) {
      const [nr, nc, wr, wc] = neighbors[Math.floor(Math.random() * neighbors.length)];
      grid[wr][wc] = 'path';
      grid[nr][nc] = 'path';
      stack.push([nr, nc]);
    } else {
      stack.pop();
    }
  }

  // Carve a few extra loops so the player has tactical routes
  for (let r = 2; r < size - 2; r++) {
    for (let c = 2; c < size - 2; c++) {
      if (grid[r][c] === 'wall' && Math.random() < 0.14) {
        grid[r][c] = 'path';
      }
    }
  }

  grid[1][1] = 'start';
  grid[size - 2][size - 2] = 'goal';
  grid[size - 2][size - 3] = 'path';
  grid[size - 3][size - 2] = 'path';

  // Place Chrono Orbs and Phase Crystals
  let orbsPlaced = 0;
  let phasePlaced = 0;
  for (let r = 1; r < size - 1; r++) {
    for (let c = 1; c < size - 1; c++) {
      if (grid[r][c] === 'path' && (r > 2 || c > 2)) {
        const roll = Math.random();
        if (roll < 0.1 && orbsPlaced < 3) {
          grid[r][c] = 'orb';
          orbsPlaced++;
        } else if (roll >= 0.1 && roll < 0.15 && phasePlaced < 2) {
          grid[r][c] = 'phase';
          phasePlaced++;
        }
      }
    }
  }

  return grid;
}

export default function MazeRunnerGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
  const {
    gameState,
    score,
    addScore,
    updateScore,
    startWithCountdown,
    countdown,
    triggerGameOver,
    resumeGame,
    gameStateRef,
    scoreRef
  } = useGameEngine({
    gameId: 'mazerunner',
    onGameOver,
    onScoreUpdate
  });

  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(45);
  const [combo, setCombo] = useState(1);
  const [phaseCharges, setPhaseCharges] = useState(1);
  const [phaseActive, setPhaseActive] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('chase');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const cameraPresetRef = useRef<CameraPreset>('chase');
  const phaseChargesRef = useRef(1);
  const phaseActiveRef = useRef(false);
  const comboRef = useRef(1);
  const levelRef = useRef(1);

  const mazeStateRef = useRef<{
    size: number;
    grid: MazeCell[][];
    playerR: number;
    playerC: number;
    visualX: number;
    visualZ: number;
    targetYaw: number;
    currentYaw: number;
    facingDr: number;
    facingDc: number;
    rebuildRequested: boolean;
  }>({
    size: 7,
    grid: generateSolvableMaze(7),
    playerR: 1,
    playerC: 1,
    visualX: 0,
    visualZ: 0,
    targetYaw: 0,
    currentYaw: 0,
    facingDr: 0,
    facingDc: 1,
    rebuildRequested: true
  });

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  const showBanner = useCallback((msg: string) => {
    setStatusBanner(msg);
    const t = window.setTimeout(() => setStatusBanner(null), 1300);
    return () => clearTimeout(t);
  }, []);

  const setupLevel = useCallback((lvl: number) => {
    const size = Math.min(13, 7 + Math.floor((lvl - 1) / 2) * 2);
    const newGrid = generateSolvableMaze(size);
    const half = (size - 1) / 2;
    mazeStateRef.current = {
      size,
      grid: newGrid,
      playerR: 1,
      playerC: 1,
      visualX: 1 - half,
      visualZ: 1 - half,
      targetYaw: 0,
      currentYaw: 0,
      facingDr: 0,
      facingDc: 1,
      rebuildRequested: true
    };
  }, []);

  const startNewGame = useCallback(() => {
    updateScore(0);
    setLevel(1);
    levelRef.current = 1;
    setTimeLeft(45);
    setCombo(1);
    comboRef.current = 1;
    setPhaseCharges(1);
    phaseChargesRef.current = 1;
    setPhaseActive(false);
    phaseActiveRef.current = false;
    setupLevel(1);

    startWithCountdown(() => {
      audio.playClick();
    });
  }, [setupLevel, startWithCountdown, updateScore]);

  const activatePhaseMode = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (phaseChargesRef.current <= 0 || phaseActiveRef.current) return;
    phaseActiveRef.current = true;
    setPhaseActive(true);
    audio.playLaser();
    showBanner('PHASE BREAKER SIAP: TEMBUS 1 DINDING!');
  }, [gameStateRef, showBanner]);

  const movePlayer = useCallback(
    (dr: number, dc: number) => {
      if (gameStateRef.current !== 'playing') return;
      const st = mazeStateRef.current;
      const nr = st.playerR + dr;
      const nc = st.playerC + dc;
      st.facingDr = dr;
      st.facingDc = dc;
      st.targetYaw = Math.atan2(dc, dr);

      if (nr <= 0 || nr >= st.size - 1 || nc <= 0 || nc >= st.size - 1) {
        audio.playHit();
        screenShake.trigger('light');
        return;
      }

      const cell = st.grid[nr][nc];

      if (cell === 'wall') {
        if (phaseActiveRef.current && phaseChargesRef.current > 0) {
          // Break through the wall!
          phaseActiveRef.current = false;
          phaseChargesRef.current -= 1;
          setPhaseActive(false);
          setPhaseCharges(phaseChargesRef.current);
          st.grid[nr][nc] = 'path';
          st.playerR = nr;
          st.playerC = nc;
          st.rebuildRequested = true;
          audio.playExplosion();
          screenShake.trigger('medium');
          addScore(40 * comboRef.current);
          showBanner('DINDING DITEMBUS! +40');
        } else {
          audio.playHit();
          screenShake.trigger('light');
          comboRef.current = 1;
          setCombo(1);
        }
        return;
      }

      // Move onto path/item/goal
      audio.playClick();
      st.playerR = nr;
      st.playerC = nc;

      if (cell === 'orb') {
        st.grid[nr][nc] = 'path';
        st.rebuildRequested = true;
        audio.playCoin();
        comboRef.current = Math.min(8, comboRef.current + 1);
        setCombo(comboRef.current);
        const pts = 50 * comboRef.current;
        addScore(pts);
        setTimeLeft((prev) => Math.min(60, prev + 6));
        showBanner(`CHRONO ORB +6 DETIK · x${comboRef.current} KOMBO!`);
      } else if (cell === 'phase') {
        st.grid[nr][nc] = 'path';
        st.rebuildRequested = true;
        audio.playLevelUp();
        phaseChargesRef.current = Math.min(3, phaseChargesRef.current + 1);
        setPhaseCharges(phaseChargesRef.current);
        addScore(35 * comboRef.current);
        showBanner('PHASE CHARGE DITEMUKAN!');
      } else if (cell === 'goal') {
        audio.playLevelUp();
        screenShake.trigger('medium');
        const nextLvl = levelRef.current + 1;
        const clearBonus = (120 + levelRef.current * 30) * comboRef.current;
        addScore(clearBonus);
        comboRef.current = Math.min(8, comboRef.current + 1);
        setCombo(comboRef.current);
        levelRef.current = nextLvl;
        setLevel(nextLvl);
        setTimeLeft((prev) => Math.min(60, prev + 12));
        showBanner(`SEKTOR ${nextLvl - 1} SELESAI! +${clearBonus}`);
        setupLevel(nextLvl);
      }
    },
    [addScore, gameStateRef, setupLevel, showBanner]
  );

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        setCameraPreset((prev) => (prev === 'chase' ? 'isometric' : prev === 'isometric' ? 'overhead' : 'chase'));
        return;
      }
      if (gameStateRef.current !== 'playing') return;

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        movePlayer(-1, 0);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        movePlayer(1, 0);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        movePlayer(0, -1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        movePlayer(0, 1);
      } else if (e.key === ' ' || e.key === 'Shift') {
        e.preventDefault();
        activatePhaseMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activatePhaseMode, gameStateRef, movePlayer]);

  // Countdown game timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          triggerGameOver(scoreRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, scoreRef, triggerGameOver]);

  // Isolated Three.js WebGL Lifecycle (mounts once)
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
    const height = mount.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050811);
    scene.fog = new THREE.FogExp2(0x050811, 0.045);

    const camera = new THREE.PerspectiveCamera(56, width / height, 0.1, 120);
    camera.position.set(0, 9.5, 7.5);

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
    mount.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
    keyLight.position.set(8, 16, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    const d = 10;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.85);
    rimLight.position.set(-10, 8, -10);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const floorTex = createFloorGridTexture(maxAniso);

    const levelGroup = new THREE.Group();
    scene.add(levelGroup);

    const wallGeo = new THREE.BoxGeometry(0.94, 0.88, 0.94);
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.25,
      clearcoat: 0.6
    });
    const wallCapGeo = new THREE.BoxGeometry(0.96, 0.06, 0.96);
    const wallCapMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.5
    });

    const orbGeo = new THREE.OctahedronGeometry(0.24, 0);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.3
    });

    const phaseGeo = new THREE.TorusGeometry(0.22, 0.06, 10, 20);
    const phaseMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xdb2777,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.5
    });

    const goalGroup = new THREE.Group();
    const portalOuter = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.055, 12, 32),
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 1.0,
        roughness: 0.15
      })
    );
    portalOuter.position.y = 0.5;
    const portalInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24),
      new THREE.MeshBasicMaterial({ color: 0xe879f9, transparent: true, opacity: 0.75 })
    );
    portalInner.rotation.x = Math.PI / 2;
    portalInner.position.y = 0.5;
    goalGroup.add(portalOuter, portalInner);
    scene.add(goalGroup);

    const drone = buildExplorerDrone(isSoftwareGl);
    scene.add(drone.group);

    let animatedItems: { mesh: THREE.Object3D; type: 'orb' | 'phase' }[] = [];

    const rebuildMazeMeshes = () => {
      while (levelGroup.children.length > 0) {
        levelGroup.remove(levelGroup.children[0]);
      }
      animatedItems = [];

      const st = mazeStateRef.current;
      const half = (st.size - 1) / 2;

      floorTex.repeat.set(st.size, st.size);
      const floorMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(st.size + 0.4, st.size + 0.4),
        new THREE.MeshStandardMaterial({
          map: floorTex,
          roughness: 0.45,
          metalness: 0.3
        })
      );
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.receiveShadow = !isSoftwareGl;
      levelGroup.add(floorMesh);

      for (let r = 0; r < st.size; r++) {
        for (let c = 0; c < st.size; c++) {
          const cell = st.grid[r][c];
          const wx = c - half;
          const wz = r - half;

          if (cell === 'wall') {
            const wMesh = new THREE.Mesh(wallGeo, wallMat);
            wMesh.position.set(wx, 0.44, wz);
            wMesh.castShadow = !isSoftwareGl;
            wMesh.receiveShadow = !isSoftwareGl;
            levelGroup.add(wMesh);

            const capMesh = new THREE.Mesh(wallCapGeo, wallCapMat);
            capMesh.position.set(wx, 0.89, wz);
            levelGroup.add(capMesh);
          } else if (cell === 'orb') {
            const oMesh = new THREE.Mesh(orbGeo, orbMat);
            oMesh.position.set(wx, 0.45, wz);
            levelGroup.add(oMesh);
            animatedItems.push({ mesh: oMesh, type: 'orb' });
          } else if (cell === 'phase') {
            const pMesh = new THREE.Mesh(phaseGeo, phaseMat);
            pMesh.position.set(wx, 0.45, wz);
            levelGroup.add(pMesh);
            animatedItems.push({ mesh: pMesh, type: 'phase' });
          } else if (cell === 'goal') {
            goalGroup.position.set(wx, 0.02, wz);
          }
        }
      }
      st.rebuildRequested = false;
    };

    rebuildMazeMeshes();

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const clock = new THREE.Clock();
    let frameId = 0;

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
      const st = mazeStateRef.current;

      if (st.rebuildRequested) {
        rebuildMazeMeshes();
      }

      const half = (st.size - 1) / 2;
      const targetX = st.playerC - half;
      const targetZ = st.playerR - half;

      st.visualX = THREE.MathUtils.damp(st.visualX, targetX, 14, delta);
      st.visualZ = THREE.MathUtils.damp(st.visualZ, targetZ, 14, delta);
      st.currentYaw = THREE.MathUtils.damp(st.currentYaw, st.targetYaw, 12, delta);

      drone.group.position.set(st.visualX, 0.02 + Math.sin(elapsed * 4.5) * 0.04, st.visualZ);
      drone.group.rotation.y = st.currentYaw;
      drone.ring.rotation.z = elapsed * 2.8;
      drone.core.rotation.y = elapsed * 3.5;

      // Highlight drone ring when Phase Mode is active
      (drone.ring.material as THREE.MeshStandardMaterial).emissive.setHex(
        phaseActiveRef.current ? 0xec4899 : 0x000000
      );

      portalOuter.rotation.y = elapsed * 2.2;
      portalInner.scale.setScalar(0.9 + Math.sin(elapsed * 5) * 0.1);

      for (const item of animatedItems) {
        item.mesh.rotation.y = elapsed * 2.4;
        item.mesh.position.y = 0.44 + Math.sin(elapsed * 3.5 + item.mesh.position.x) * 0.08;
      }

      const preset = cameraPresetRef.current;
      if (preset === 'chase') {
        _camTargetPos.set(st.visualX, 6.2 + st.size * 0.25, st.visualZ + 4.8);
        _camLookAt.set(st.visualX, 0.3, st.visualZ - 0.5);
      } else if (preset === 'isometric') {
        _camTargetPos.set(st.visualX + 5.2, 7.8 + st.size * 0.25, st.visualZ + 5.2);
        _camLookAt.set(st.visualX, 0.2, st.visualZ);
      } else {
        _camTargetPos.set(0, st.size * 1.15 + 2.5, 0.01);
        _camLookAt.set(0, 0, 0);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camTargetPos.x, 7, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camTargetPos.y, 7, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camTargetPos.z, 7, delta);
      camera.lookAt(_camLookAt);

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      floorTex.dispose();
      disposeThreeScene(scene, renderer);
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[480px] flex flex-col items-center justify-center bg-[#050811] overflow-hidden select-none">
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Top Semantic HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 bg-slate-950/90 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-cyan-400 font-semibold">SEKTOR {level}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className={timeLeft <= 10 ? 'text-red-400 font-bold' : 'text-slate-200'}>
            <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-amber-400" />
            {timeLeft}s
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold">x{combo}</span>
        </div>

        <div className="bg-slate-950/90 border border-white/10 px-4 py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-slate-400 mr-2">SKOR</span>
          <span className="text-white font-bold text-base">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Status Notification Toast */}
      {statusBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-cyan-500/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-cyan-300 tracking-wide shadow-lg">
          {statusBanner}
        </div>
      )}

      {/* Mobile Touch D-Pad (Bottom-Left on touch screens) */}
      {gameState === 'playing' && (
        <div className="absolute bottom-20 left-4 z-10 flex flex-col items-center gap-1 md:hidden pointer-events-auto">
          <button
            onClick={() => movePlayer(-1, 0)}
            className="w-11 h-11 rounded-lg bg-slate-900/90 border border-white/15 flex items-center justify-center text-white active:bg-cyan-600"
            aria-label="Gerak Atas"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => movePlayer(0, -1)}
              className="w-11 h-11 rounded-lg bg-slate-900/90 border border-white/15 flex items-center justify-center text-white active:bg-cyan-600"
              aria-label="Gerak Kiri"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => movePlayer(1, 0)}
              className="w-11 h-11 rounded-lg bg-slate-900/90 border border-white/15 flex items-center justify-center text-white active:bg-cyan-600"
              aria-label="Gerak Bawah"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
            <button
              onClick={() => movePlayer(0, 1)}
              className="w-11 h-11 rounded-lg bg-slate-900/90 border border-white/15 flex items-center justify-center text-white active:bg-cyan-600"
              aria-label="Gerak Kanan"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
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
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-400 hidden sm:inline">Kamera:</span>
            {(['chase', 'isometric', 'overhead'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setCameraPreset(preset)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                  cameraPreset === preset
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <button
            onClick={activatePhaseMode}
            disabled={phaseCharges <= 0 || phaseActive}
            className={`px-3 py-1.5 rounded-lg font-mono font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              phaseActive
                ? 'bg-pink-500 text-white'
                : phaseCharges > 0
                ? 'bg-slate-900 hover:bg-slate-800 text-pink-400 border border-pink-500/40'
                : 'bg-slate-900/50 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Phase Breaker ({phaseCharges})</span>
          </button>
        </div>
      </div>

      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        onStart={startNewGame}
        onRestart={startNewGame}
        onResume={resumeGame}
        countdown={countdown}
        gameTitle="MAZE RUNNER 3D"
        instructions="Arahkan kapsul siber 3D melintasi labirin menuju portal ungu! Ambil Chrono Orb emas (+6 detik) dan gunakan Phase Breaker (SPASI) untuk menembus dinding."
      />
    </div>
  );
}
