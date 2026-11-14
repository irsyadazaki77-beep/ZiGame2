import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { audioController, useGameEngine } from '../../sdk';
import { inputManager } from '../../services/inputService';
import {
  ThreeStageController,
  createStoneCathedralMaps,
  createEmissiveGridTexture,
  followDirectionalShadow
} from '../../utils/threeStage';
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

interface PendingEffect {
  type: 'bump' | 'break' | 'orb' | 'phase' | 'goal';
  x: number;
  z: number;
}

const MAX_WALL_INSTANCES = 170;
const _camTargetPos = new THREE.Vector3(0, 9.5, 7.5);
const _camSmoothPos = new THREE.Vector3(0, 9.5, 7.5);
const _camLookAt = new THREE.Vector3(0, 0, 0);
const _dummy = new THREE.Object3D();
const _lampOffset = new THREE.Vector3(8, 16, 10);

function buildExplorerDrone(isSoftwareGl: boolean): {
  group: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshStandardMaterial;
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
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.85,
    metalness: 0.7,
    roughness: 0.25
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.95,
    roughness: 0.12,
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
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.036, 10, 28), ringMat);
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

  // 5. Glowing HDR Energy Core
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), coreMat);
  core.position.set(0, 0.66, 0);
  group.add(core);

  // 6. Local Drone Torch PointLight illuminating bump-mapped stone corridor
  const torchLight = new THREE.PointLight(0x22d3ee, 2.4, 5.5, 1.4);
  torchLight.position.set(0, 0.85, 0);
  group.add(torchLight);

  return { group, ring, ringMat, core };
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
  const timeLeftRef = useRef(45);
  const lastTimeShownRef = useRef(45);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const bannerTimerRef = useRef<number | null>(null);

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
    fxQueue: PendingEffect[];
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
    rebuildRequested: true,
    fxQueue: []
  });

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const showBanner = useCallback((msg: string) => {
    setStatusBanner(msg);
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setStatusBanner(null);
      bannerTimerRef.current = null;
    }, 1300);
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
      rebuildRequested: true,
      fxQueue: mazeStateRef.current.fxQueue
    };
  }, []);

  const startNewGame = useCallback(() => {
    updateScore(0);
    setLevel(1);
    levelRef.current = 1;
    timeLeftRef.current = 45;
    lastTimeShownRef.current = 45;
    setTimeLeft(45);
    setCombo(1);
    comboRef.current = 1;
    setPhaseCharges(1);
    phaseChargesRef.current = 1;
    setPhaseActive(false);
    phaseActiveRef.current = false;
    setupLevel(1);

    startWithCountdown(() => {
      audioController.playClick();
    });
  }, [setupLevel, startWithCountdown, updateScore]);

  const activatePhaseMode = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (phaseChargesRef.current <= 0 || phaseActiveRef.current) return;
    phaseActiveRef.current = true;
    setPhaseActive(true);
    audioController.playLaser();
    showBanner('PHASE BREAKER SIAP: TEMBUS 1 DINDING!');
  }, [gameStateRef, showBanner]);

  const movePlayer = useCallback(
    (dr: number, dc: number) => {
      if (gameStateRef.current !== 'playing') return;
      const st = mazeStateRef.current;
      const half = (st.size - 1) / 2;
      const nr = st.playerR + dr;
      const nc = st.playerC + dc;
      st.facingDr = dr;
      st.facingDc = dc;
      st.targetYaw = Math.atan2(dc, dr);

      if (nr <= 0 || nr >= st.size - 1 || nc <= 0 || nc >= st.size - 1) {
        audioController.playHit();
        screenShake.trigger('light');
        st.fxQueue.push({ type: 'bump', x: nc - half, z: nr - half });
        return;
      }

      const cell = st.grid[nr][nc];

      if (cell === 'wall') {
        if (phaseActiveRef.current && phaseChargesRef.current > 0) {
          phaseActiveRef.current = false;
          phaseChargesRef.current -= 1;
          setPhaseActive(false);
          setPhaseCharges(phaseChargesRef.current);
          st.grid[nr][nc] = 'path';
          st.playerR = nr;
          st.playerC = nc;
          st.rebuildRequested = true;
          st.fxQueue.push({ type: 'break', x: nc - half, z: nr - half });
          audioController.playExplosion();
          screenShake.trigger('medium');
          addScore(40 * comboRef.current);
          showBanner('DINDING DITEMBUS! +40');
        } else {
          audioController.playHit();
          screenShake.trigger('light');
          st.fxQueue.push({ type: 'bump', x: nc - half, z: nr - half });
          comboRef.current = 1;
          setCombo(1);
        }
        return;
      }

      audioController.playClick();
      st.playerR = nr;
      st.playerC = nc;

      if (cell === 'orb') {
        st.grid[nr][nc] = 'path';
        st.rebuildRequested = true;
        st.fxQueue.push({ type: 'orb', x: nc - half, z: nr - half });
        audioController.playPowerup();
        comboRef.current = Math.min(8, comboRef.current + 1);
        setCombo(comboRef.current);
        const pts = 50 * comboRef.current;
        addScore(pts);
        timeLeftRef.current = Math.min(60, timeLeftRef.current + 6);
        const nextSec = Math.ceil(timeLeftRef.current);
        lastTimeShownRef.current = nextSec;
        setTimeLeft(nextSec);
        showBanner(`CHRONO ORB +6 DETIK · x${comboRef.current} KOMBO!`);
      } else if (cell === 'phase') {
        st.grid[nr][nc] = 'path';
        st.rebuildRequested = true;
        st.fxQueue.push({ type: 'phase', x: nc - half, z: nr - half });
        audioController.playLevelUp();
        phaseChargesRef.current = Math.min(3, phaseChargesRef.current + 1);
        setPhaseCharges(phaseChargesRef.current);
        addScore(35 * comboRef.current);
        showBanner('PHASE CHARGE DITEMUKAN!');
      } else if (cell === 'goal') {
        audioController.playWin();
        screenShake.trigger('medium');
        st.fxQueue.push({ type: 'goal', x: nc - half, z: nr - half });
        const nextLvl = levelRef.current + 1;
        const clearBonus = (120 + levelRef.current * 30) * comboRef.current;
        addScore(clearBonus);
        comboRef.current = Math.min(8, comboRef.current + 1);
        setCombo(comboRef.current);
        levelRef.current = nextLvl;
        setLevel(nextLvl);
        timeLeftRef.current = Math.min(60, timeLeftRef.current + 12);
        const nextSec = Math.ceil(timeLeftRef.current);
        lastTimeShownRef.current = nextSec;
        setTimeLeft(nextSec);
        showBanner(`SEKTOR ${nextLvl - 1} SELESAI! +${clearBonus}`);
        setupLevel(nextLvl);
      }
    },
    [addScore, gameStateRef, setupLevel, showBanner]
  );

  // Keyboard & InputManager controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        setCameraPreset((prev) => (prev === 'chase' ? 'isometric' : prev === 'isometric' ? 'overhead' : 'chase'));
      }
    };

    const unsubInput = inputManager.subscribe({
      onActionDown: (action) => {
        if (gameStateRef.current !== 'playing') return;
        if (action === 'UP') movePlayer(-1, 0);
        else if (action === 'DOWN') movePlayer(1, 0);
        else if (action === 'LEFT') movePlayer(0, -1);
        else if (action === 'RIGHT') movePlayer(0, 1);
        else if (
          action === 'PRIMARY' ||
          action === 'ACTION_PRIMARY' ||
          action === 'SECONDARY' ||
          action === 'ACTION_SECONDARY'
        ) {
          activatePhaseMode();
        }
      }
    });

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      unsubInput();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activatePhaseMode, gameStateRef, movePlayer]);

  // Unified ThreeStageController WebGL Maze Lifecycle
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container: mount,
        backgroundColor: 0x050811,
        fogColor: 0x050811,
        fogDensity: 0.04,
        fov: 56,
        near: 0.1,
        far: 120,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 10,
        toneMappingExposure: 1.12,
        bloom: {
          enabled: true,
          strength: 0.54,
          radius: 0.4,
          threshold: 0.8
        }
      });
    } catch {
      return;
    }

    const { scene, camera, renderer } = stage;
    camera.position.set(0, 9.5, 7.5);
    stage.rimLight.color.setHex(0xa855f7);
    stage.rimLight.position.set(-10, 8, -10);

    // Procedural PBR Stone Cathedral Maps for Maze Walls + Emissive Cyber Grid for Floor
    const wallMaps = createStoneCathedralMaps(renderer, {
      baseColor: '#1e293b',
      mortarColor: '#090d16',
      tileRows: 2,
      tileCols: 2,
      repeatX: 1,
      repeatY: 1
    });
    const floorTex = createEmissiveGridTexture(renderer, {
      primaryHex: '#06b6d4',
      secondaryHex: 'rgba(56, 189, 248, 0.14)',
      backgroundHex: '#070b14',
      subdivisions: 4
    });

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.42,
      metalness: 0.28
    });
    const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !stage.isSoftwareGl;
    scene.add(floorMesh);

    // InstancedMesh Maze Walls + Neon Caps (Max 169 walls in 2 draw calls!)
    const wallGeo = new RoundedBoxGeometry(0.94, 0.88, 0.94, 2, 0.06);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallMaps.map,
      roughnessMap: wallMaps.roughnessMap,
      bumpMap: wallMaps.bumpMap,
      bumpScale: 0.04,
      metalness: 0.35,
      roughness: 0.58
    });
    const wallInst = new THREE.InstancedMesh(wallGeo, wallMat, MAX_WALL_INSTANCES);
    wallInst.castShadow = !stage.isSoftwareGl;
    wallInst.receiveShadow = !stage.isSoftwareGl;
    wallInst.frustumCulled = false;
    scene.add(wallInst);

    const wallCapGeo = new THREE.BoxGeometry(0.82, 0.05, 0.82);
    const wallCapMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.25,
      roughness: 0.2,
      metalness: 0.5
    });
    const wallCapInst = new THREE.InstancedMesh(wallCapGeo, wallCapMat, MAX_WALL_INSTANCES);
    wallCapInst.frustumCulled = false;
    scene.add(wallCapInst);

    const itemsGroup = new THREE.Group();
    scene.add(itemsGroup);

    const orbGeo = new THREE.OctahedronGeometry(0.24, 0);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.95,
      roughness: 0.15,
      metalness: 0.2
    });

    const phaseGeo = new THREE.TorusGeometry(0.22, 0.06, 10, 20);
    const phaseMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xec4899,
      emissiveIntensity: 1.9,
      roughness: 0.15,
      metalness: 0.4
    });

    const goalGroup = new THREE.Group();
    const portalOuter = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.06, 12, 32),
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0xa855f7,
        emissiveIntensity: 2.05,
        roughness: 0.15
      })
    );
    portalOuter.position.y = 0.5;
    const portalInner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf0abfc,
        emissive: 0xe879f9,
        emissiveIntensity: 1.65,
        transparent: true,
        opacity: 0.82
      })
    );
    portalInner.rotation.x = Math.PI / 2;
    portalInner.position.y = 0.5;
    goalGroup.add(portalOuter, portalInner);
    scene.add(goalGroup);

    const drone = buildExplorerDrone(stage.isSoftwareGl);
    scene.add(drone.group);

    let animatedItems: { mesh: THREE.Object3D; type: 'orb' | 'phase' }[] = [];

    const rebuildMazeMeshes = () => {
      while (itemsGroup.children.length > 0) {
        itemsGroup.remove(itemsGroup.children[0]);
      }
      animatedItems = [];

      const st = mazeStateRef.current;
      const half = (st.size - 1) / 2;

      floorMesh.scale.set(st.size + 0.4, st.size + 0.4, 1);
      floorTex.repeat.set(st.size, st.size);

      let wallCount = 0;

      for (let r = 0; r < st.size; r++) {
        for (let c = 0; c < st.size; c++) {
          const cell = st.grid[r][c];
          const wx = c - half;
          const wz = r - half;

          if (cell === 'wall' && wallCount < MAX_WALL_INSTANCES) {
            _dummy.position.set(wx, 0.44, wz);
            _dummy.rotation.set(0, 0, 0);
            _dummy.scale.setScalar(1);
            _dummy.updateMatrix();
            wallInst.setMatrixAt(wallCount, _dummy.matrix);

            _dummy.position.set(wx, 0.89, wz);
            _dummy.updateMatrix();
            wallCapInst.setMatrixAt(wallCount, _dummy.matrix);
            wallCount++;
          } else if (cell === 'orb') {
            const oMesh = new THREE.Mesh(orbGeo, orbMat);
            oMesh.position.set(wx, 0.45, wz);
            itemsGroup.add(oMesh);
            animatedItems.push({ mesh: oMesh, type: 'orb' });
          } else if (cell === 'phase') {
            const pMesh = new THREE.Mesh(phaseGeo, phaseMat);
            pMesh.position.set(wx, 0.45, wz);
            itemsGroup.add(pMesh);
            animatedItems.push({ mesh: pMesh, type: 'phase' });
          } else if (cell === 'goal') {
            goalGroup.position.set(wx, 0.02, wz);
          }
        }
      }

      wallInst.count = wallCount;
      wallCapInst.count = wallCount;
      wallInst.instanceMatrix.needsUpdate = true;
      wallCapInst.instanceMatrix.needsUpdate = true;
      st.rebuildRequested = false;
    };

    rebuildMazeMeshes();
    _camSmoothPos.set(0, 9.5, 7.5);

    stage.startLoop((dt, elapsed) => {
      const delta = Math.min(dt, 0.05);
      const st = mazeStateRef.current;

      if (gameStateRef.current === 'playing') {
        timeLeftRef.current = Math.max(0, timeLeftRef.current - delta);
        const sec = Math.ceil(timeLeftRef.current);
        if (sec !== lastTimeShownRef.current) {
          lastTimeShownRef.current = sec;
          setTimeLeft(sec);
        }
        if (timeLeftRef.current <= 0) {
          audioController.playGameOver();
          triggerGameOver(scoreRef.current);
          return;
        }
      }

      if (st.rebuildRequested) {
        rebuildMazeMeshes();
      }

      while (st.fxQueue.length > 0) {
        const fx = st.fxQueue.shift()!;
        if (fx.type === 'bump') {
          stage.cameraRig.addTrauma(0.28);
          stage.particles.burst(fx.x, 0.45, fx.z, 8, 0xf43f5e, 4.5);
        } else if (fx.type === 'break') {
          stage.cameraRig.addTrauma(0.55);
          stage.particles.burst(fx.x, 0.5, fx.z, 26, 0xec4899, 8.5);
        } else if (fx.type === 'orb') {
          stage.particles.burst(fx.x, 0.5, fx.z, 18, 0xfacc15, 6);
        } else if (fx.type === 'phase') {
          stage.particles.burst(fx.x, 0.5, fx.z, 18, 0xec4899, 6);
        } else if (fx.type === 'goal') {
          stage.cameraRig.addTrauma(0.42);
          stage.particles.burst(fx.x, 0.6, fx.z, 32, 0xa855f7, 9);
          stage.cameraRig.kickFov(6);
        }
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

      if (phaseActiveRef.current) {
        drone.ringMat.emissive.setHex(0xec4899);
        drone.ringMat.emissiveIntensity = 1.9;
      } else {
        drone.ringMat.emissive.setHex(0x06b6d4);
        drone.ringMat.emissiveIntensity = 0.85;
      }

      portalOuter.rotation.y = elapsed * 2.2;
      portalInner.scale.setScalar(0.9 + Math.sin(elapsed * 5) * 0.1);

      for (const item of animatedItems) {
        item.mesh.rotation.y = elapsed * 2.4;
        item.mesh.position.y = 0.44 + Math.sin(elapsed * 3.5 + item.mesh.position.x) * 0.08;
      }

      followDirectionalShadow(stage.keyLight, drone.group.position, 10, true, _lampOffset);

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

      _camSmoothPos.x = THREE.MathUtils.damp(_camSmoothPos.x, _camTargetPos.x, 7, delta);
      _camSmoothPos.y = THREE.MathUtils.damp(_camSmoothPos.y, _camTargetPos.y, 7, delta);
      _camSmoothPos.z = THREE.MathUtils.damp(_camSmoothPos.z, _camTargetPos.z, 7, delta);

      stage.cameraRig.stepFovRecovery(camera, 56, delta);
      stage.cameraRig.applyTraumaToCamera(camera, _camSmoothPos, delta, 0.38);
      camera.lookAt(_camLookAt);
    });

    return () => {
      wallMaps.dispose();
      floorTex.dispose();
      stage.dispose();
    };
  }, [gameStateRef, scoreRef, triggerGameOver]);

  return (
    <div
      onPointerDown={(e) => {
        swipeStartRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const start = swipeStartRef.current;
        swipeStartRef.current = null;
        if (!start || gameStateRef.current !== 'playing') return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) < 22) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          movePlayer(0, dx > 0 ? 1 : -1);
        } else {
          movePlayer(dy > 0 ? 1 : -1, 0);
        }
      }}
      onPointerCancel={() => {
        swipeStartRef.current = null;
      }}
      className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[480px] flex flex-col items-center justify-center bg-[#050811] overflow-hidden select-none touch-none"
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Top Semantic HUD */}
      <div className="absolute top-2.5 inset-x-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-950/90 border border-white/10 px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-mono tabular-nums">
          <span className="text-cyan-400 font-semibold">SEKTOR {level}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className={timeLeft <= 10 ? 'text-red-400 font-bold' : 'text-slate-200'}>
            <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5 text-amber-400" />
            {timeLeft}s
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold">x{combo}</span>
        </div>

        <div className="bg-slate-950/90 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-mono tabular-nums">
          <span className="text-slate-400 mr-1.5 sm:mr-2">SKOR</span>
          <span className="text-white font-bold text-sm sm:text-base">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Status Notification Toast */}
      {statusBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-cyan-500/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-cyan-300 tracking-wide shadow-lg whitespace-nowrap">
          {statusBanner}
        </div>
      )}

      {/* Mobile Touch D-Pad (Bottom-Left on touch screens, clear of bottom dock) */}
      {gameState === 'playing' && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          className={`absolute ${dockCollapsed ? 'bottom-12' : 'bottom-28 sm:bottom-24'} left-3 z-10 flex flex-col items-center gap-1 md:hidden pointer-events-auto touch-none transition-all`}
        >
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              movePlayer(-1, 0);
            }}
            className="w-11 h-11 rounded-lg bg-slate-900/90 border border-white/15 flex items-center justify-center text-white active:bg-cyan-600 touch-none"
            aria-label="Gerak Atas"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                movePlayer(0, -1);
              }}
              className="w-11 h-11 rounded-lg bg-slate-900/90 border border-white/15 flex items-center justify-center text-white active:bg-cyan-600 touch-none"
              aria-label="Gerak Kiri"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                movePlayer(1, 0);
              }}
              className="w-11 h-11 rounded-lg bg-slate-900/90 border border-white/15 flex items-center justify-center text-white active:bg-cyan-600 touch-none"
              aria-label="Gerak Bawah"
            >
              <ArrowDown className="w-5 h-5" />
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                movePlayer(0, 1);
              }}
              className="w-11 h-11 rounded-lg bg-slate-900/90 border border-white/15 flex items-center justify-center text-white active:bg-cyan-600 touch-none"
              aria-label="Gerak Kanan"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-[640px] transition-transform duration-200 pointer-events-auto pb-[env(safe-area-inset-bottom)]"
        style={{ transform: `translate(-50%, ${dockCollapsed ? 'calc(100% - 28px)' : '0px'})` }}
      >
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="px-3 min-h-[36px] sm:min-h-0 py-1 rounded-t-lg bg-slate-950/90 border border-b-0 border-white/10 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 whitespace-nowrap"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {dockCollapsed ? 'Tampilkan Kontrol' : 'Sembunyikan Kontrol'}
          </button>
        </div>

        <div className="bg-slate-950/95 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-slate-400 hidden sm:inline">Kamera:</span>
            {(['chase', 'isometric', 'overhead'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  audioController.playClick();
                  setCameraPreset(preset);
                }}
                className={`px-2.5 min-h-[44px] sm:min-h-0 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
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
            className={`px-3 min-h-[44px] sm:min-h-0 py-1.5 rounded-lg font-mono font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              phaseActive
                ? 'bg-pink-500 text-white'
                : phaseCharges > 0
                ? 'bg-slate-900 hover:bg-slate-800 text-pink-400 border border-pink-500/40'
                : 'bg-slate-900/50 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Phase ({phaseCharges})</span>
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
