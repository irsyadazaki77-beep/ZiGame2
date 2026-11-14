import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { audioController, useGameEngine } from '../../sdk';
import { ThreeStageController, followDirectionalShadow } from '../../utils/threeStage';
import { screenShake } from '../../utils/screenShake';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Flag, Eye, Clock, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type GolfCamMode = 'follow' | 'overhead' | 'hole';

interface BumperObstacle {
  x: number;
  z: number;
  radius: number;
  mesh?: THREE.Object3D;
}

interface WallBlock {
  x: number;
  z: number;
  w: number;
  d: number;
}

interface HoleLayout {
  par: number;
  startX: number;
  startZ: number;
  holeX: number;
  holeZ: number;
  bumpers: BumperObstacle[];
  walls: WallBlock[];
  hasWindmill: boolean;
  windmillZ: number;
  boostPad?: { x: number; z: number; w: number; d: number; dirZ: number };
}

interface TrailSlot {
  active: boolean;
  x: number;
  z: number;
  life: number;
  maxLife: number;
}

const COURSE_W = 8.4;
const COURSE_D = 14.0;
const BALL_RADIUS = 0.26;
const CUP_RADIUS = 0.48;
const BALL_TRAIL_CAPACITY = 64;

const _camTargetPos = new THREE.Vector3(0, 9.5, 11.5);
const _camSmoothPos = new THREE.Vector3(0, 9.5, 11.5);
const _camLook = new THREE.Vector3(0, 0, 0);
const _trailDummy = new THREE.Object3D();
const _lampOffset = new THREE.Vector3(8, 16, 10);

function buildHoleLayout(level: number): HoleLayout {
  const idx = (level - 1) % 5;
  if (idx === 0) {
    return {
      par: 2,
      startX: 0,
      startZ: 5.2,
      holeX: 0,
      holeZ: -5.0,
      bumpers: [{ x: 0, z: 0, radius: 0.65 }],
      walls: [],
      hasWindmill: false,
      windmillZ: 0
    };
  }
  if (idx === 1) {
    return {
      par: 3,
      startX: -2.2,
      startZ: 5.4,
      holeX: 2.2,
      holeZ: -5.2,
      bumpers: [
        { x: -1.4, z: 1.2, radius: 0.55 },
        { x: 1.4, z: -1.2, radius: 0.55 }
      ],
      walls: [{ x: 0, z: 0, w: 2.6, d: 0.5 }],
      hasWindmill: true,
      windmillZ: -2.6
    };
  }
  if (idx === 2) {
    return {
      par: 3,
      startX: 0,
      startZ: 5.5,
      holeX: 0,
      holeZ: -5.4,
      bumpers: [
        { x: -1.9, z: -1.5, radius: 0.6 },
        { x: 1.9, z: -1.5, radius: 0.6 },
        { x: 0, z: 1.8, radius: 0.65 }
      ],
      walls: [],
      hasWindmill: false,
      windmillZ: 0,
      boostPad: { x: 0, z: -0.2, w: 1.8, d: 2.2, dirZ: -1 }
    };
  }
  if (idx === 3) {
    return {
      par: 3,
      startX: 2.4,
      startZ: 5.4,
      holeX: -2.4,
      holeZ: -5.2,
      bumpers: [{ x: 0, z: 0, radius: 0.75 }],
      walls: [
        { x: -1.8, z: 1.8, w: 3.2, d: 0.45 },
        { x: 1.8, z: -1.8, w: 3.2, d: 0.45 }
      ],
      hasWindmill: true,
      windmillZ: 0
    };
  }
  return {
    par: 4,
    startX: 0,
    startZ: 5.6,
    holeX: 0,
    holeZ: -5.5,
    bumpers: [
      { x: -1.8, z: 2.2, radius: 0.55 },
      { x: 1.8, z: 2.2, radius: 0.55 },
      { x: -1.5, z: -2.5, radius: 0.55 },
      { x: 1.5, z: -2.5, radius: 0.55 }
    ],
    walls: [{ x: 0, z: 0.2, w: 3.0, d: 0.5 }],
    hasWindmill: true,
    windmillZ: -2.8,
    boostPad: { x: -2.6, z: 0.2, w: 1.4, d: 2.4, dirZ: -1 }
  };
}

function createTurfTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 64) {
      const even = ((x / 64) + (y / 64)) % 2 === 0;
      ctx.fillStyle = even ? '#064e3b' : '#065f46';
      ctx.fillRect(x, y, 64, 64);
    }
  }

  ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 508, 508);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export default function PixelGolfGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
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
    gameId: 'pixelgolf',
    onGameOver,
    onScoreUpdate
  });

  const [holeNum, setHoleNum] = useState(1);
  const [strokes, setStrokes] = useState(0);
  const [par, setPar] = useState(2);
  const [timeLeft, setTimeLeft] = useState(75);
  const [powerPct, setPowerPct] = useState(0);
  const [camMode, setCamMode] = useState<GolfCamMode>('follow');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const camModeRef = useRef<GolfCamMode>('follow');
  const strokesRef = useRef(0);
  const holeNumRef = useRef(1);
  const timeLeftRef = useRef(75);
  const lastTimeShownRef = useRef(75);
  const lastPowerPctRef = useRef(0);
  const bannerTimerRef = useRef<number | null>(null);

  const golfStateRef = useRef<{
    layout: HoleLayout;
    ballX: number;
    ballZ: number;
    vx: number;
    vz: number;
    isMoving: boolean;
    isAiming: boolean;
    dragStartX: number;
    dragStartY: number;
    aimDx: number;
    aimDz: number;
    aimPower: number;
    windmillAngle: number;
    rebuildRequested: boolean;
  }>({
    layout: buildHoleLayout(1),
    ballX: 0,
    ballZ: 5.2,
    vx: 0,
    vz: 0,
    isMoving: false,
    isAiming: false,
    dragStartX: 0,
    dragStartY: 0,
    aimDx: 0,
    aimDz: -1,
    aimPower: 0,
    windmillAngle: 0,
    rebuildRequested: true
  });

  useEffect(() => {
    camModeRef.current = camMode;
  }, [camMode]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const showBanner = useCallback((msg: string) => {
    setBannerMsg(msg);
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setBannerMsg(null);
      bannerTimerRef.current = null;
    }, 1400);
  }, []);

  const loadHole = useCallback((lvl: number) => {
    const layout = buildHoleLayout(lvl);
    golfStateRef.current.layout = layout;
    golfStateRef.current.ballX = layout.startX;
    golfStateRef.current.ballZ = layout.startZ;
    golfStateRef.current.vx = 0;
    golfStateRef.current.vz = 0;
    golfStateRef.current.isMoving = false;
    golfStateRef.current.isAiming = false;
    golfStateRef.current.rebuildRequested = true;
    strokesRef.current = 0;
    setStrokes(0);
    setPar(layout.par);
    lastPowerPctRef.current = 0;
    setPowerPct(0);
  }, []);

  const startGame = useCallback(() => {
    updateScore(0);
    holeNumRef.current = 1;
    setHoleNum(1);
    timeLeftRef.current = 75;
    lastTimeShownRef.current = 75;
    setTimeLeft(75);
    loadHole(1);

    startWithCountdown(() => {
      audioController.playClick();
    });
  }, [loadHole, startWithCountdown, updateScore]);

  const resetBallToTee = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const st = golfStateRef.current;
    st.ballX = st.layout.startX;
    st.ballZ = st.layout.startZ;
    st.vx = 0;
    st.vz = 0;
    st.isMoving = false;
    audioController.playHit();
  }, [gameStateRef]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameStateRef.current !== 'playing') return;
    const st = golfStateRef.current;
    if (st.isMoving) return;
    st.isAiming = true;
    st.dragStartX = e.clientX;
    st.dragStartY = e.clientY;
    st.aimDx = 0;
    st.aimDz = -1;
    st.aimPower = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = golfStateRef.current;
    if (!st.isAiming) return;
    const dx = (st.dragStartX - e.clientX) * 0.08;
    const dz = (st.dragStartY - e.clientY) * 0.08;
    const rawLen = Math.hypot(dx, dz);
    const maxPull = 14;
    const clamped = Math.min(maxPull, rawLen);
    if (rawLen > 0.1) {
      st.aimDx = dx / rawLen;
      st.aimDz = dz / rawLen;
      st.aimPower = clamped;
      const nextPct = Math.round((clamped / maxPull) * 100);
      if (nextPct !== lastPowerPctRef.current) {
        lastPowerPctRef.current = nextPct;
        setPowerPct(nextPct);
      }
    } else {
      st.aimPower = 0;
      if (lastPowerPctRef.current !== 0) {
        lastPowerPctRef.current = 0;
        setPowerPct(0);
      }
    }
  };

  const handlePointerUp = () => {
    const st = golfStateRef.current;
    if (!st.isAiming) return;
    st.isAiming = false;

    if (st.aimPower > 0.8) {
      st.vx = st.aimDx * st.aimPower * 1.35;
      st.vz = st.aimDz * st.aimPower * 1.35;
      st.isMoving = true;
      strokesRef.current += 1;
      setStrokes(strokesRef.current);
      lastPowerPctRef.current = 0;
      setPowerPct(0);
      audioController.playJump();
    } else if (lastPowerPctRef.current !== 0) {
      lastPowerPctRef.current = 0;
      setPowerPct(0);
    }
  };

  // Unified ThreeStageController WebGL Mini-Golf Course
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container: mount,
        backgroundColor: 0x050b14,
        fogColor: 0x050b14,
        fogDensity: 0.024,
        fov: 50,
        near: 0.1,
        far: 120,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 10,
        toneMappingExposure: 1.12,
        bloom: {
          enabled: true,
          strength: 0.48,
          radius: 0.36,
          threshold: 0.82
        }
      });
    } catch {
      return;
    }

    const { scene, camera, renderer } = stage;
    camera.position.set(0, 9.5, 11.5);
    stage.hemiLight.color.setHex(0x6ee7b7);
    stage.rimLight.color.setHex(0x38bdf8);
    stage.rimLight.position.set(-10, 9, -10);

    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const turfTex = createTurfTexture(maxAniso);

    // Fairway Base & Sculpted Rounded Rails
    const courseGroup = new THREE.Group();
    scene.add(courseGroup);

    const turfMesh = new THREE.Mesh(
      new THREE.BoxGeometry(COURSE_W, 0.4, COURSE_D),
      new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.65, metalness: 0.1 })
    );
    turfMesh.position.y = -0.2;
    turfMesh.receiveShadow = !stage.isSoftwareGl;
    courseGroup.add(turfMesh);

    const railMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      metalness: 0.7,
      roughness: 0.25,
      clearcoat: 0.6
    });
    const sideRailGeo = new RoundedBoxGeometry(0.4, 0.55, COURSE_D + 0.8, 2, 0.06);
    const leftRail = new THREE.Mesh(sideRailGeo, railMat);
    leftRail.position.set(-COURSE_W / 2 - 0.2, 0.18, 0);
    leftRail.castShadow = !stage.isSoftwareGl;
    const rightRail = leftRail.clone();
    rightRail.position.x = COURSE_W / 2 + 0.2;

    const endRailGeo = new RoundedBoxGeometry(COURSE_W, 0.55, 0.4, 2, 0.06);
    const topRail = new THREE.Mesh(endRailGeo, railMat);
    topRail.position.set(0, 0.18, -COURSE_D / 2 - 0.2);
    topRail.castShadow = !stage.isSoftwareGl;
    const bottomRail = topRail.clone();
    bottomRail.position.z = COURSE_D / 2 + 0.2;
    courseGroup.add(leftRail, rightRail, topRail, bottomRail);

    const dynamicPropsGroup = new THREE.Group();
    scene.add(dynamicPropsGroup);

    // Composite Flagstick & Glowing Cup
    const flagGroup = new THREE.Group();
    const cupMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(CUP_RADIUS, CUP_RADIUS, 0.05, 24),
      new THREE.MeshBasicMaterial({ color: 0x020617 })
    );
    cupMesh.position.y = 0.01;
    const cupRim = new THREE.Mesh(
      new THREE.TorusGeometry(CUP_RADIUS, 0.042, 10, 28),
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0xa855f7,
        emissiveIntensity: 1.95,
        roughness: 0.15
      })
    );
    cupRim.rotation.x = Math.PI / 2;
    cupRim.position.y = 0.02;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 2.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.8, roughness: 0.2 })
    );
    pole.position.y = 1.1;
    const pennant = new THREE.Mesh(
      new THREE.ConeGeometry(0.35, 0.75, 3),
      new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        emissive: 0xf43f5e,
        emissiveIntensity: 1.15
      })
    );
    pennant.rotation.z = -Math.PI / 2;
    pennant.position.set(0.32, 1.95, 0);
    flagGroup.add(cupMesh, cupRim, pole, pennant);
    scene.add(flagGroup);

    // Golf Ball Mesh
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 24, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.1,
        clearcoat: 1.0
      })
    );
    ballMesh.castShadow = !stage.isSoftwareGl;
    scene.add(ballMesh);

    // Instanced Rolling Ball Trail Pool
    const trailInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x6ee7b7,
        emissive: 0x10b981,
        emissiveIntensity: 1.75,
        roughness: 0.15
      }),
      BALL_TRAIL_CAPACITY
    );
    trailInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    trailInst.frustumCulled = false;
    const trailSlots: TrailSlot[] = Array.from({ length: BALL_TRAIL_CAPACITY }, () => ({
      active: false,
      x: 0,
      z: 0,
      life: 0,
      maxLife: 0.45
    }));
    let trailCursor = 0;

    _trailDummy.position.set(0, -99, 0);
    _trailDummy.scale.setScalar(0);
    _trailDummy.updateMatrix();
    for (let i = 0; i < BALL_TRAIL_CAPACITY; i++) {
      trailInst.setMatrixAt(i, _trailDummy.matrix);
    }
    trailInst.instanceMatrix.needsUpdate = true;
    scene.add(trailInst);

    const spawnBallTrail = (x: number, z: number) => {
      const s = trailSlots[trailCursor];
      trailCursor = (trailCursor + 1) % BALL_TRAIL_CAPACITY;
      s.active = true;
      s.x = x;
      s.z = z;
      s.maxLife = 0.42;
      s.life = s.maxLife;
    };

    // 3D HDR Aiming Guide Line
    const aimDotMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xfbbf24,
      emissiveIntensity: 1.85,
      roughness: 0.15
    });
    const aimPoints = Array.from({ length: 12 }, () => new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      aimDotMat
    ));
    aimPoints.forEach((pt) => {
      pt.visible = false;
      scene.add(pt);
    });

    let windmillBlades: THREE.Group | null = null;

    const rebuildHoleProps = () => {
      while (dynamicPropsGroup.children.length > 0) {
        dynamicPropsGroup.remove(dynamicPropsGroup.children[0]);
      }
      windmillBlades = null;

      const st = golfStateRef.current;
      const lay = st.layout;

      flagGroup.position.set(lay.holeX, 0, lay.holeZ);

      for (const b of lay.bumpers) {
        const bGroup = new THREE.Group();
        const cyl = new THREE.Mesh(
          new THREE.CylinderGeometry(b.radius, b.radius, 0.5, 24),
          new THREE.MeshPhysicalMaterial({
            color: 0x06b6d4,
            metalness: 0.6,
            roughness: 0.2,
            clearcoat: 0.8
          })
        );
        cyl.position.y = 0.25;
        cyl.castShadow = !stage.isSoftwareGl;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(b.radius + 0.03, 0.052, 10, 24),
          new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfacc15,
            emissiveIntensity: 1.85,
            roughness: 0.15
          })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.35;
        bGroup.add(cyl, ring);
        bGroup.position.set(b.x, 0, b.z);
        dynamicPropsGroup.add(bGroup);
      }

      for (const w of lay.walls) {
        const wMesh = new THREE.Mesh(
          new RoundedBoxGeometry(w.w, 0.55, w.d, 2, 0.06),
          new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 })
        );
        wMesh.position.set(w.x, 0.275, w.z);
        wMesh.castShadow = !stage.isSoftwareGl;
        dynamicPropsGroup.add(wMesh);
      }

      if (lay.boostPad) {
        const bp = lay.boostPad;
        const pad = new THREE.Mesh(
          new THREE.PlaneGeometry(bp.w, bp.d),
          new THREE.MeshStandardMaterial({
            color: 0x34d399,
            emissive: 0x10b981,
            emissiveIntensity: 1.55,
            transparent: true,
            opacity: 0.68
          })
        );
        pad.rotation.x = -Math.PI / 2;
        pad.position.set(bp.x, 0.02, bp.z);
        dynamicPropsGroup.add(pad);
      }

      if (lay.hasWindmill) {
        const wmGroup = new THREE.Group();
        const tower = new THREE.Mesh(
          new THREE.ConeGeometry(0.85, 2.4, 6),
          new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.35, metalness: 0.4 })
        );
        tower.position.y = 1.2;
        tower.castShadow = !stage.isSoftwareGl;
        wmGroup.add(tower);

        const blades = new THREE.Group();
        blades.position.set(0, 1.35, 0.65);
        const bladeGeo = new RoundedBoxGeometry(3.2, 0.28, 0.08, 2, 0.02);
        const bladeMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xd97706,
          emissiveIntensity: 0.9
        });
        const b1 = new THREE.Mesh(bladeGeo, bladeMat);
        const b2 = new THREE.Mesh(bladeGeo, bladeMat);
        b2.rotation.z = Math.PI / 2;
        blades.add(b1, b2);
        wmGroup.add(blades);
        wmGroup.position.set(0, 0, lay.windmillZ);
        dynamicPropsGroup.add(wmGroup);
        windmillBlades = blades;
      }

      st.rebuildRequested = false;
    };

    rebuildHoleProps();

    let trailTimer = 0;
    _camSmoothPos.set(0, 9.5, 11.5);

    stage.startLoop((dt) => {
      const delta = Math.min(dt, 0.05);
      const st = golfStateRef.current;

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
        rebuildHoleProps();
      }

      st.windmillAngle += delta * 2.1;
      if (windmillBlades) {
        windmillBlades.rotation.z = st.windmillAngle;
      }

      if (gameStateRef.current === 'playing' && st.isMoving) {
        trailTimer += delta;
        if (trailTimer >= 0.025) {
          trailTimer = 0;
          spawnBallTrail(st.ballX, st.ballZ);
        }

        const subSteps = 3;
        const stepDt = delta / subSteps;

        for (let s = 0; s < subSteps; s++) {
          st.ballX += st.vx * stepDt;
          st.ballZ += st.vz * stepDt;

          const damping = Math.exp(-1.55 * stepDt);
          st.vx *= damping;
          st.vz *= damping;

          if (st.layout.boostPad) {
            const bp = st.layout.boostPad;
            if (
              Math.abs(st.ballX - bp.x) < bp.w / 2 &&
              Math.abs(st.ballZ - bp.z) < bp.d / 2
            ) {
              st.vz += bp.dirZ * 14 * stepDt;
            }
          }

          const halfW = COURSE_W / 2 - BALL_RADIUS;
          const halfD = COURSE_D / 2 - BALL_RADIUS;
          if (st.ballX < -halfW) {
            st.ballX = -halfW;
            st.vx = Math.abs(st.vx) * 0.82;
            audioController.playHit();
            stage.cameraRig.addTrauma(0.14);
          } else if (st.ballX > halfW) {
            st.ballX = halfW;
            st.vx = -Math.abs(st.vx) * 0.82;
            audioController.playHit();
            stage.cameraRig.addTrauma(0.14);
          }
          if (st.ballZ < -halfD) {
            st.ballZ = -halfD;
            st.vz = Math.abs(st.vz) * 0.82;
            audioController.playHit();
            stage.cameraRig.addTrauma(0.14);
          } else if (st.ballZ > halfD) {
            st.ballZ = halfD;
            st.vz = -Math.abs(st.vz) * 0.82;
            audioController.playHit();
            stage.cameraRig.addTrauma(0.14);
          }

          for (const b of st.layout.bumpers) {
            const dx = st.ballX - b.x;
            const dz = st.ballZ - b.z;
            const dist = Math.hypot(dx, dz);
            const minDist = BALL_RADIUS + b.radius;
            if (dist < minDist && dist > 0.001) {
              const nx = dx / dist;
              const nz = dz / dist;
              st.ballX = b.x + nx * minDist;
              st.ballZ = b.z + nz * minDist;
              const dot = st.vx * nx + st.vz * nz;
              st.vx = (st.vx - 2 * dot * nx) * 1.05;
              st.vz = (st.vz - 2 * dot * nz) * 1.05;
              audioController.playScore();
              screenShake.trigger('light');
              stage.cameraRig.addTrauma(0.32);
              stage.particles.burst(st.ballX, 0.35, st.ballZ, 12, 0xfacc15, 5.5);
            }
          }

          for (const w of st.layout.walls) {
            const halfWW = w.w / 2 + BALL_RADIUS;
            const halfWD = w.d / 2 + BALL_RADIUS;
            const dx = st.ballX - w.x;
            const dz = st.ballZ - w.z;
            if (Math.abs(dx) < halfWW && Math.abs(dz) < halfWD) {
              if (halfWW - Math.abs(dx) < halfWD - Math.abs(dz)) {
                st.ballX = w.x + Math.sign(dx) * halfWW;
                st.vx *= -0.8;
              } else {
                st.ballZ = w.z + Math.sign(dz) * halfWD;
                st.vz *= -0.8;
              }
              audioController.playHit();
              stage.cameraRig.addTrauma(0.16);
            }
          }

          const distCup = Math.hypot(st.ballX - st.layout.holeX, st.ballZ - st.layout.holeZ);
          const speed = Math.hypot(st.vx, st.vz);
          if (distCup < CUP_RADIUS && speed < 10.5) {
            audioController.playWin();
            screenShake.trigger('medium');
            stage.cameraRig.addTrauma(0.45);
            stage.cameraRig.kickFov(4);
            stage.particles.burst(st.layout.holeX, 0.35, st.layout.holeZ, 30, 0xa855f7, 8);
            const diff = strokesRef.current - st.layout.par;
            const label =
              strokesRef.current === 1
                ? 'HOLE IN ONE! +300'
                : diff < 0
                ? 'BIRDIE! +200'
                : diff === 0
                ? 'PAR! +140'
                : 'BOGEY +90';
            const pts =
              strokesRef.current === 1 ? 300 : diff < 0 ? 200 : diff === 0 ? 140 : 90;
            addScore(pts);
            timeLeftRef.current = Math.min(90, timeLeftRef.current + 10);
            const nextSec = Math.ceil(timeLeftRef.current);
            lastTimeShownRef.current = nextSec;
            setTimeLeft(nextSec);
            showBanner(label);

            const nextHole = holeNumRef.current + 1;
            holeNumRef.current = nextHole;
            setHoleNum(nextHole);
            loadHole(nextHole);
            break;
          }
        }

        if (Math.hypot(st.vx, st.vz) < 0.18) {
          st.vx = 0;
          st.vz = 0;
          st.isMoving = false;
        }
      }

      ballMesh.position.set(st.ballX, BALL_RADIUS, st.ballZ);

      // Update Instanced Ball Trail
      let trailDirty = false;
      for (let i = 0; i < BALL_TRAIL_CAPACITY; i++) {
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
          const s = ts.life / ts.maxLife;
          _trailDummy.position.set(ts.x, 0.12, ts.z);
          _trailDummy.scale.setScalar(s);
          _trailDummy.updateMatrix();
          trailInst.setMatrixAt(i, _trailDummy.matrix);
        }
      }
      if (trailDirty) {
        trailInst.instanceMatrix.needsUpdate = true;
      }

      // Tight dynamic directional shadow around ball
      followDirectionalShadow(stage.keyLight, ballMesh.position, 10, true, _lampOffset);

      if (st.isAiming && st.aimPower > 0.5) {
        for (let i = 0; i < aimPoints.length; i++) {
          const pt = aimPoints[i];
          const stepDist = (i + 1) * (st.aimPower * 0.045);
          pt.position.set(
            st.ballX + st.aimDx * stepDist,
            0.15,
            st.ballZ + st.aimDz * stepDist
          );
          pt.visible = true;
        }
      } else {
        for (const pt of aimPoints) pt.visible = false;
      }

      const mode = camModeRef.current;
      if (mode === 'follow') {
        _camTargetPos.set(st.ballX * 0.6, 7.2, st.ballZ + 6.4);
        _camLook.set(st.ballX * 0.4, 0, st.ballZ - 2.2);
      } else if (mode === 'overhead') {
        _camTargetPos.set(0, 16.5, 0.01);
        _camLook.set(0, 0, 0);
      } else {
        _camTargetPos.set(st.layout.holeX, 4.5, st.layout.holeZ + 4.8);
        _camLook.set(st.layout.holeX, 0.3, st.layout.holeZ);
      }

      _camSmoothPos.x = THREE.MathUtils.damp(_camSmoothPos.x, _camTargetPos.x, 7, delta);
      _camSmoothPos.y = THREE.MathUtils.damp(_camSmoothPos.y, _camTargetPos.y, 7, delta);
      _camSmoothPos.z = THREE.MathUtils.damp(_camSmoothPos.z, _camTargetPos.z, 7, delta);

      stage.cameraRig.stepFovRecovery(camera, 50, delta);
      stage.cameraRig.applyTraumaToCamera(camera, _camSmoothPos, delta, 0.3);
      camera.lookAt(_camLook);
    });

    return () => {
      turfTex.dispose();
      stage.dispose();
    };
  }, [addScore, gameStateRef, loadHole, scoreRef, showBanner, triggerGameOver]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[480px] flex flex-col items-center justify-center bg-[#050b14] overflow-hidden select-none cursor-crosshair touch-none"
    >
      {/* Dedicated WebGL Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Top HUD */}
      <div className="absolute top-2.5 inset-x-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-10">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-950/90 border border-white/10 px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-mono tabular-nums">
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <Flag className="w-3.5 h-3.5" />
            HOLE {holeNum} (PAR {par})
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-200">PUKUL {strokes}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className={timeLeft <= 10 ? 'text-red-400 font-bold' : 'text-amber-400'}>
            <Clock className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            {timeLeft}s
          </span>
        </div>

        <div className="bg-slate-950/90 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-mono tabular-nums">
          <span className="text-slate-400 mr-1.5 sm:mr-2">SKOR</span>
          <span className="text-white font-bold text-sm sm:text-base">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Shot Result Banner */}
      {bannerMsg && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-emerald-500/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-emerald-300 tracking-wide shadow-lg whitespace-nowrap">
          {bannerMsg}
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
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
            <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
            {(['follow', 'overhead', 'hole'] as GolfCamMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  audioController.playClick();
                  setCamMode(m);
                }}
                className={`px-2.5 min-h-[44px] sm:min-h-0 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                  camMode === m
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400">POWER</span>
              <div className="w-16 sm:w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500"
                  style={{ width: `${powerPct}%` }}
                />
              </div>
              <span className="text-white w-8 text-right tabular-nums">{powerPct}%</span>
            </div>

            <button
              onClick={resetBallToTee}
              className="px-2.5 min-h-[44px] sm:min-h-0 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Tee</span>
            </button>
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
        gameTitle="PIXEL GOLF 3D"
        instructions="Tarik dan lepaskan di layar untuk mengarahkan pukulan bola golf 3D! Manfaatkan bumper pantul, hindari kincir berputar, dan raih Hole-in-One!"
      />
    </div>
  );
}
