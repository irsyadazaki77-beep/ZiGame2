import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { audioController } from '../../sdk/audioController';
import { useGameEngine } from '../../sdk';
import { inputManager } from '../../services/inputService';
import { ThreeStageController, followDirectionalShadow } from '../../utils/threeStage';
import { screenShake } from '../../utils/screenShake';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Layers, Sparkles, Eye, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface NeonStackerGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type CameraAngle = 'isometric' | 'front' | 'orbit';

interface FallingCutPiece {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  life: number;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  scale: number;
  opacity: number;
}

const SLAB_HEIGHT = 0.52;
const INITIAL_SIZE = 3.2;
const SLIDE_BOUNDS = 4.4;
const PERFECT_TOLERANCE = 0.15;

const PALETTE_HEX = [
  0x06b6d4, 0x3b82f6, 0x6366f1, 0x8b5cf6, 0xa855f7, 0xd946ef,
  0xec4899, 0xf43f5e, 0xf97316, 0xf59e0b, 0x10b981, 0x14b8a6
];

const _camTargetPos = new THREE.Vector3(7.5, 8.5, 7.5);
const _camSmoothPos = new THREE.Vector3(7.5, 8.5, 7.5);
const _camLookAt = new THREE.Vector3(0, 0, 0);
const _shadowFocus = new THREE.Vector3(0, 0, 0);
const _lampOffset = new THREE.Vector3(8, 16, 10);

export default function NeonStackerGame({ onGameOver, onScoreUpdate, highScore }: NeonStackerGameProps) {
  const {
    gameState,
    score,
    updateScore,
    addScore,
    triggerGameOver,
    startWithCountdown,
    resumeGame,
    countdown,
    gameStateRef
  } = useGameEngine({
    gameId: 'neonstacker',
    onGameOver,
    onScoreUpdate
  });

  const [levelCount, setLevelCount] = useState(0);
  const [combo, setCombo] = useState(1);
  const [slowMoCharges, setSlowMoCharges] = useState(1);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [cameraAngle, setCameraAngle] = useState<CameraAngle>('isometric');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [bannerText, setBannerText] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const cameraAngleRef = useRef<CameraAngle>('isometric');
  const slowMoActiveRef = useRef(false);
  const slowMoTimerRef = useRef(0);
  const slowMoChargesRef = useRef(1);
  const bannerTimerRef = useRef<number | null>(null);

  const stackStateRef = useRef<{
    rowIdx: number;
    axis: 'x' | 'z';
    dir: number;
    speed: number;
    activeX: number;
    activeZ: number;
    activeW: number;
    activeD: number;
    prevX: number;
    prevZ: number;
    prevW: number;
    prevD: number;
    perfectStreak: number;
    resetRequested: boolean;
    traumaToTrigger: number;
    sliceQueue: {
      x: number;
      y: number;
      z: number;
      w: number;
      d: number;
      colorHex: number;
      vx: number;
      vz: number;
    }[];
    placedQueue: {
      x: number;
      y: number;
      z: number;
      w: number;
      d: number;
      colorHex: number;
      isPerfect: boolean;
    }[];
  }>({
    rowIdx: 0,
    axis: 'x',
    dir: 1,
    speed: 4.2,
    activeX: -SLIDE_BOUNDS,
    activeZ: 0,
    activeW: INITIAL_SIZE,
    activeD: INITIAL_SIZE,
    prevX: 0,
    prevZ: 0,
    prevW: INITIAL_SIZE,
    prevD: INITIAL_SIZE,
    perfectStreak: 0,
    resetRequested: true,
    traumaToTrigger: 0,
    sliceQueue: [],
    placedQueue: []
  });

  useEffect(() => {
    cameraAngleRef.current = cameraAngle;
  }, [cameraAngle]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const triggerBanner = useCallback((msg: string) => {
    setBannerText(msg);
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setBannerText(null);
      bannerTimerRef.current = null;
    }, 1100);
  }, []);

  const activateSlowMo = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (slowMoChargesRef.current <= 0 || slowMoActiveRef.current) return;
    slowMoChargesRef.current -= 1;
    slowMoActiveRef.current = true;
    slowMoTimerRef.current = 4.5;
    setSlowMoCharges(slowMoChargesRef.current);
    setSlowMoActive(true);
    audioController.playLaser();
    triggerBanner('CHRONO STABILIZER AKTIF (KECEPATAN 50%)');
  }, [gameStateRef, triggerBanner]);

  const startGame = useCallback(() => {
    updateScore(0);
    setLevelCount(0);
    setCombo(1);
    setSlowMoCharges(1);
    slowMoChargesRef.current = 1;
    setSlowMoActive(false);
    slowMoActiveRef.current = false;

    stackStateRef.current = {
      rowIdx: 0,
      axis: 'x',
      dir: 1,
      speed: 4.4,
      activeX: -SLIDE_BOUNDS,
      activeZ: 0,
      activeW: INITIAL_SIZE,
      activeD: INITIAL_SIZE,
      prevX: 0,
      prevZ: 0,
      prevW: INITIAL_SIZE,
      prevD: INITIAL_SIZE,
      perfectStreak: 0,
      resetRequested: true,
      traumaToTrigger: 0,
      sliceQueue: [],
      placedQueue: []
    };

    startWithCountdown(() => {
      audioController.playClick();
    });
  }, [startWithCountdown, updateScore]);

  const handleStack = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    const st = stackStateRef.current;
    const colorHex = PALETTE_HEX[st.rowIdx % PALETTE_HEX.length];
    const yPos = (st.rowIdx + 0.5) * SLAB_HEIGHT;

    const deltaX = st.activeX - st.prevX;
    const deltaZ = st.activeZ - st.prevZ;
    const absDx = Math.abs(deltaX);
    const absDz = Math.abs(deltaZ);

    if (st.axis === 'x' && absDx >= st.activeW) {
      st.sliceQueue.push({
        x: st.activeX,
        y: yPos,
        z: st.activeZ,
        w: st.activeW,
        d: st.activeD,
        colorHex: 0xef4444,
        vx: st.dir * 2.5,
        vz: 0
      });
      st.traumaToTrigger = 0.8;
      audioController.playGameOver();
      screenShake.trigger('heavy');
      triggerGameOver();
      return;
    }

    if (st.axis === 'z' && absDz >= st.activeD) {
      st.sliceQueue.push({
        x: st.activeX,
        y: yPos,
        z: st.activeZ,
        w: st.activeW,
        d: st.activeD,
        colorHex: 0xef4444,
        vx: 0,
        vz: st.dir * 2.5
      });
      st.traumaToTrigger = 0.8;
      audioController.playGameOver();
      screenShake.trigger('heavy');
      triggerGameOver();
      return;
    }

    const isPerfect =
      (st.axis === 'x' && absDx <= PERFECT_TOLERANCE) ||
      (st.axis === 'z' && absDz <= PERFECT_TOLERANCE);

    let nextW = st.activeW;
    let nextD = st.activeD;
    let nextX = st.prevX;
    let nextZ = st.prevZ;

    if (isPerfect) {
      st.perfectStreak += 1;
      st.traumaToTrigger = Math.max(st.traumaToTrigger, 0.32);
      audioController.playPowerup();
      screenShake.trigger('medium');

      if (st.perfectStreak >= 3) {
        nextW = Math.min(INITIAL_SIZE, st.activeW + 0.22);
        nextD = Math.min(INITIAL_SIZE, st.activeD + 0.22);
        if (st.perfectStreak % 3 === 0) {
          slowMoChargesRef.current = Math.min(3, slowMoChargesRef.current + 1);
          setSlowMoCharges(slowMoChargesRef.current);
        }
        triggerBanner(`PERFECT EXPAND! KOMBO x${st.perfectStreak + 1}`);
      } else {
        triggerBanner(`PERFECT DROP! x${st.perfectStreak + 1}`);
      }
    } else {
      st.perfectStreak = 0;
      st.traumaToTrigger = Math.max(st.traumaToTrigger, 0.18);
      audioController.playScore();
      screenShake.trigger('light');

      if (st.axis === 'x') {
        nextW = st.activeW - absDx;
        nextX = st.prevX + deltaX / 2;
        const cutW = absDx;
        const cutX = deltaX > 0 ? nextX + nextW / 2 + cutW / 2 : nextX - nextW / 2 - cutW / 2;
        st.sliceQueue.push({
          x: cutX,
          y: yPos,
          z: st.activeZ,
          w: cutW,
          d: st.activeD,
          colorHex,
          vx: Math.sign(deltaX) * 2.2,
          vz: 0
        });
      } else {
        nextD = st.activeD - absDz;
        nextZ = st.prevZ + deltaZ / 2;
        const cutD = absDz;
        const cutZ = deltaZ > 0 ? nextZ + nextD / 2 + cutD / 2 : nextZ - nextD / 2 - cutD / 2;
        st.sliceQueue.push({
          x: st.activeX,
          y: yPos,
          z: cutZ,
          w: st.activeW,
          d: cutD,
          colorHex,
          vx: 0,
          vz: Math.sign(deltaZ) * 2.2
        });
      }
    }

    st.placedQueue.push({
      x: nextX,
      y: yPos,
      z: nextZ,
      w: nextW,
      d: nextD,
      colorHex,
      isPerfect
    });

    const newCombo = Math.min(8, st.perfectStreak + 1);
    setCombo(newCombo);

    const pts = (25 + st.rowIdx * 5) * newCombo;
    addScore(pts);

    st.prevX = nextX;
    st.prevZ = nextZ;
    st.prevW = nextW;
    st.prevD = nextD;
    st.activeW = nextW;
    st.activeD = nextD;
    st.rowIdx += 1;
    setLevelCount(st.rowIdx);

    st.axis = st.rowIdx % 2 === 0 ? 'x' : 'z';
    st.dir = Math.random() > 0.5 ? 1 : -1;
    st.speed = Math.min(9.5, 4.4 + st.rowIdx * 0.14);

    if (st.axis === 'x') {
      st.activeX = -st.dir * SLIDE_BOUNDS;
      st.activeZ = nextZ;
    } else {
      st.activeX = nextX;
      st.activeZ = -st.dir * SLIDE_BOUNDS;
    }
  }, [addScore, gameStateRef, triggerBanner, triggerGameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        setCameraAngle((prev) => (prev === 'isometric' ? 'front' : prev === 'front' ? 'orbit' : 'isometric'));
        return;
      }
      if (gameStateRef.current !== 'playing') return;
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        handleStack();
      } else if (e.key === 's' || e.key === 'S' || e.key === 'Shift') {
        e.preventDefault();
        activateSlowMo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'PRIMARY' || action === 'ACTION_PRIMARY' || action === 'UP') {
          handleStack();
        } else if (action === 'DOWN') {
          activateSlowMo();
        }
      }
    });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsub();
    };
  }, [activateSlowMo, gameStateRef, handleStack]);

  // Unified ThreeStageController WebGL Studio Scene
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container: mount,
        backgroundColor: 0x060913,
        fogColor: 0x060913,
        fogDensity: 0.022,
        fov: 45,
        near: 0.1,
        far: 150,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 10,
        toneMappingExposure: 1.15,
        bloom: {
          enabled: true,
          strength: 0.56,
          radius: 0.42,
          threshold: 0.8
        }
      });
    } catch {
      return;
    }

    const { scene, camera } = stage;
    camera.position.set(7.5, 8.5, 7.5);
    stage.rimLight.color.setHex(0xec4899);
    stage.rimLight.position.set(-9, 10, -8);

    // Composite Studio Foundation Pedestal
    const pedestalGroup = new THREE.Group();
    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 1.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.72, roughness: 0.28 })
    );
    basePlinth.position.y = -1.2;
    pedestalGroup.add(basePlinth);

    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.25, 0.065, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.75,
        roughness: 0.15
      })
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = -0.52;
    pedestalGroup.add(baseRing);

    const foundationSlab = new THREE.Mesh(
      new RoundedBoxGeometry(INITIAL_SIZE, SLAB_HEIGHT, INITIAL_SIZE, 2, 0.06),
      new THREE.MeshPhysicalMaterial({
        color: 0x1e293b,
        metalness: 0.65,
        roughness: 0.2,
        clearcoat: 0.8
      })
    );
    foundationSlab.position.y = -SLAB_HEIGHT / 2;
    foundationSlab.receiveShadow = !stage.isSoftwareGl;
    pedestalGroup.add(foundationSlab);
    scene.add(pedestalGroup);

    const towerGroup = new THREE.Group();
    scene.add(towerGroup);

    const activeSlabMat = new THREE.MeshPhysicalMaterial({
      color: PALETTE_HEX[0],
      emissive: PALETTE_HEX[0],
      emissiveIntensity: 0.45,
      metalness: 0.45,
      roughness: 0.18,
      clearcoat: 1.0
    });
    const activeSlabMesh = new THREE.Mesh(
      new RoundedBoxGeometry(1, SLAB_HEIGHT, 1, 2, 0.04),
      activeSlabMat
    );
    activeSlabMesh.castShadow = !stage.isSoftwareGl;
    scene.add(activeSlabMesh);

    const fallingPieces: FallingCutPiece[] = [];
    const shockwaves: ShockwaveRing[] = [];

    const clearTower = () => {
      while (towerGroup.children.length > 0) {
        const obj = towerGroup.children[0] as THREE.Mesh;
        obj.geometry?.dispose();
        (obj.material as THREE.Material)?.dispose();
        towerGroup.remove(obj);
      }
      fallingPieces.forEach((f) => {
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        scene.remove(f.mesh);
      });
      fallingPieces.length = 0;
      shockwaves.forEach((s) => {
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
        scene.remove(s.mesh);
      });
      shockwaves.length = 0;
    };

    _camSmoothPos.set(7.5, 8.5, 7.5);

    stage.startLoop((dt, elapsed) => {
      const delta = Math.min(dt, 0.05);
      const st = stackStateRef.current;

      if (st.resetRequested) {
        clearTower();
        st.resetRequested = false;
      }

      if (st.traumaToTrigger > 0) {
        stage.cameraRig.addTrauma(st.traumaToTrigger);
        st.traumaToTrigger = 0;
      }

      // Process newly placed slabs with RoundedBoxGeometry & HDR perfect glow
      while (st.placedQueue.length > 0) {
        const item = st.placedQueue.shift()!;
        const mat = new THREE.MeshPhysicalMaterial({
          color: item.colorHex,
          metalness: 0.45,
          roughness: 0.2,
          clearcoat: 0.9,
          emissive: item.colorHex,
          emissiveIntensity: item.isPerfect ? 1.35 : 0.28
        });
        const radius = Math.min(0.055, item.w * 0.18, item.d * 0.18);
        const mesh = new THREE.Mesh(
          new RoundedBoxGeometry(item.w, SLAB_HEIGHT, item.d, 2, radius),
          mat
        );
        mesh.position.set(item.x, item.y, item.z);
        mesh.castShadow = !stage.isSoftwareGl;
        mesh.receiveShadow = !stage.isSoftwareGl;
        towerGroup.add(mesh);

        if (item.isPerfect) {
          stage.particles.burst(item.x, item.y, item.z, 22, item.colorHex, 6.5);
          stage.cameraRig.kickFov(2.2);
          const ringGeo = new THREE.RingGeometry(
            Math.max(item.w, item.d) * 0.65,
            Math.max(item.w, item.d) * 0.8,
            32
          );
          ringGeo.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfbbf24,
            emissiveIntensity: 2.0,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.position.set(item.x, item.y - SLAB_HEIGHT / 2 + 0.02, item.z);
          scene.add(ringMesh);
          shockwaves.push({ mesh: ringMesh, scale: 1, opacity: 0.95 });
        } else {
          stage.particles.burst(item.x, item.y, item.z, 8, item.colorHex, 4);
        }
      }

      // Process sliced overhanging pieces
      while (st.sliceQueue.length > 0) {
        const cut = st.sliceQueue.shift()!;
        const cutMat = new THREE.MeshStandardMaterial({
          color: cut.colorHex,
          emissive: cut.colorHex,
          emissiveIntensity: 0.35,
          metalness: 0.35,
          roughness: 0.35
        });
        const radius = Math.min(0.045, cut.w * 0.18, cut.d * 0.18);
        const cutMesh = new THREE.Mesh(
          new RoundedBoxGeometry(cut.w, SLAB_HEIGHT, cut.d, 2, radius),
          cutMat
        );
        cutMesh.position.set(cut.x, cut.y, cut.z);
        scene.add(cutMesh);
        stage.particles.burst(cut.x, cut.y, cut.z, 10, cut.colorHex, 5);
        fallingPieces.push({
          mesh: cutMesh,
          vx: cut.vx,
          vy: 0.5,
          vz: cut.vz,
          rx: (Math.random() - 0.5) * 4,
          rz: (Math.random() - 0.5) * 4,
          life: 2.2
        });
      }

      // Update slow-mo timer
      if (slowMoActiveRef.current) {
        slowMoTimerRef.current -= delta;
        if (slowMoTimerRef.current <= 0) {
          slowMoActiveRef.current = false;
          setSlowMoActive(false);
        }
      }

      // Slide active slab when playing
      if (gameStateRef.current === 'playing') {
        const speedMul = slowMoActiveRef.current ? 0.48 : 1.0;
        const step = st.speed * speedMul * delta * st.dir;
        if (st.axis === 'x') {
          st.activeX += step;
          if (st.activeX > SLIDE_BOUNDS) {
            st.activeX = SLIDE_BOUNDS;
            st.dir = -1;
          } else if (st.activeX < -SLIDE_BOUNDS) {
            st.activeX = -SLIDE_BOUNDS;
            st.dir = 1;
          }
        } else {
          st.activeZ += step;
          if (st.activeZ > SLIDE_BOUNDS) {
            st.activeZ = SLIDE_BOUNDS;
            st.dir = -1;
          } else if (st.activeZ < -SLIDE_BOUNDS) {
            st.activeZ = -SLIDE_BOUNDS;
            st.dir = 1;
          }
        }
      }

      const activeY = (st.rowIdx + 0.5) * SLAB_HEIGHT;
      const curHex = PALETTE_HEX[st.rowIdx % PALETTE_HEX.length];
      activeSlabMesh.visible = gameStateRef.current === 'playing';
      activeSlabMesh.scale.set(st.activeW, 1, st.activeD);
      activeSlabMesh.position.set(st.activeX, activeY, st.activeZ);
      activeSlabMat.color.setHex(curHex);
      activeSlabMat.emissive.setHex(curHex);

      // Update falling sliced pieces
      for (let i = fallingPieces.length - 1; i >= 0; i--) {
        const fp = fallingPieces[i];
        fp.vy -= 18 * delta;
        fp.mesh.position.x += fp.vx * delta;
        fp.mesh.position.y += fp.vy * delta;
        fp.mesh.position.z += fp.vz * delta;
        fp.mesh.rotation.x += fp.rx * delta;
        fp.mesh.rotation.z += fp.rz * delta;
        fp.life -= delta;
        if (fp.life <= 0) {
          fp.mesh.geometry.dispose();
          (fp.mesh.material as THREE.Material).dispose();
          scene.remove(fp.mesh);
          fallingPieces.splice(i, 1);
        }
      }

      // Update expanding shockwaves
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.scale += delta * 2.2;
        sw.opacity -= delta * 1.6;
        sw.mesh.scale.setScalar(sw.scale);
        (sw.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, sw.opacity);
        if (sw.opacity <= 0) {
          sw.mesh.geometry.dispose();
          (sw.mesh.material as THREE.Material).dispose();
          scene.remove(sw.mesh);
          shockwaves.splice(i, 1);
        }
      }

      // Smooth camera tracking tower height + followDirectionalShadow + trauma shake
      const towerTopY = st.rowIdx * SLAB_HEIGHT;
      _shadowFocus.set(0, towerTopY, 0);
      followDirectionalShadow(stage.keyLight, _shadowFocus, 10, true, _lampOffset);

      const mode = cameraAngleRef.current;
      if (mode === 'isometric') {
        _camTargetPos.set(7.2, towerTopY + 6.2, 7.2);
      } else if (mode === 'front') {
        _camTargetPos.set(0, towerTopY + 5.2, 9.8);
      } else {
        const orbAngle = elapsed * 0.45;
        _camTargetPos.set(Math.cos(orbAngle) * 8.8, towerTopY + 6.0, Math.sin(orbAngle) * 8.8);
      }
      _camLookAt.set(0, Math.max(0, towerTopY - 0.8), 0);

      _camSmoothPos.x = THREE.MathUtils.damp(_camSmoothPos.x, _camTargetPos.x, 6, delta);
      _camSmoothPos.y = THREE.MathUtils.damp(_camSmoothPos.y, _camTargetPos.y, 6, delta);
      _camSmoothPos.z = THREE.MathUtils.damp(_camSmoothPos.z, _camTargetPos.z, 6, delta);

      stage.cameraRig.stepFovRecovery(camera, 45, delta);
      stage.cameraRig.applyTraumaToCamera(camera, _camSmoothPos, delta, 0.36);
      camera.lookAt(_camLookAt);
    });

    return () => {
      clearTower();
      stage.dispose();
    };
  }, [gameStateRef]);

  return (
    <div
      onPointerDown={handleStack}
      className="relative w-full h-full min-h-[260px] sm:min-h-[380px] lg:min-h-[480px] flex flex-col items-center justify-center bg-[#060913] overflow-hidden select-none cursor-pointer touch-none"
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 bg-slate-950/90 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            LANTAI {levelCount}
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

      {/* Perfect / Combo Banner */}
      {bannerText && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-amber-400/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-amber-300 tracking-wide shadow-lg">
          {bannerText}
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
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
            <Eye className="w-4 h-4 text-cyan-400 shrink-0" />
            {(['isometric', 'front', 'orbit'] as CameraAngle[]).map((angle) => (
              <button
                key={angle}
                onClick={() => setCameraAngle(angle)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                  cameraAngle === angle
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {angle}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={activateSlowMo}
              disabled={slowMoCharges <= 0 || slowMoActive}
              className={`min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg font-mono font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                slowMoActive
                  ? 'bg-amber-500 text-slate-950'
                  : slowMoCharges > 0
                  ? 'bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/40'
                  : 'bg-slate-900/50 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Slow-Mo ({slowMoCharges})</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.stopPropagation();
                handleStack();
              }}
              className="min-h-[44px] sm:min-h-[34px] px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-semibold tracking-wide whitespace-nowrap touch-none"
            >
              Tumpuk Balok
            </button>
          </div>
        </div>
      </div>

      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        onStart={startGame}
        onRestart={startGame}
        onResume={resumeGame}
        countdown={countdown}
        gameTitle="NEON STACKER 3D"
        instructions="Ketuk layar atau tekan SPASI untuk menjatuhkan balok 3D tepat di atas menara. 3x Perfect Drop beruntun akan memperlebar ukuran balok kembali!"
      />
    </div>
  );
}
