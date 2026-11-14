import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../sdk';
import { disposeThreeScene } from '../../utils/threeCleanup';
import { screenShake } from '../../utils/screenShake';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Layers, Sparkles, Eye, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface NeonStackerGameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type CameraAngle = 'isometric' | 'front' | 'orbit';

interface PlacedSlab {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  width: number;
  depth: number;
  y: number;
}

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

const _camPos = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

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
    startLoop,
    stopLoop,
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
    sliceQueue: [],
    placedQueue: []
  });

  useEffect(() => {
    cameraAngleRef.current = cameraAngle;
  }, [cameraAngle]);

  const triggerBanner = useCallback((msg: string) => {
    setBannerText(msg);
    const t = window.setTimeout(() => setBannerText(null), 1100);
    return () => clearTimeout(t);
  }, []);

  const activateSlowMo = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    if (slowMoChargesRef.current <= 0 || slowMoActiveRef.current) return;
    slowMoChargesRef.current -= 1;
    slowMoActiveRef.current = true;
    slowMoTimerRef.current = 4.5;
    setSlowMoCharges(slowMoChargesRef.current);
    setSlowMoActive(true);
    audio.playLaser();
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
      sliceQueue: [],
      placedQueue: []
    };

    startWithCountdown(() => {
      audio.playClick();
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
      // Missed completely!
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
      audio.playExplosion();
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
      audio.playExplosion();
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
      audio.playLevelUp();
      screenShake.trigger('medium');

      // Expand slab slightly after 3 consecutive perfect drops
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
      audio.playScore();
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

  // Keyboard listener
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activateSlowMo, gameStateRef, handleStack]);

  // Three.js WebGL Studio Scene (mounts once)
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

    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.025);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 150);
    camera.position.set(7.5, 8.5, 7.5);

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

    // 3-Point Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.8);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.7);
    keyLight.position.set(8, 18, 10);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xec4899, 0.9);
    rimLight.position.set(-9, 10, -8);
    scene.add(rimLight);

    // Composite Studio Foundation Pedestal (3 parts)
    const pedestalGroup = new THREE.Group();
    const basePlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.6, 1.4, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 })
    );
    basePlinth.position.y = -1.2;
    pedestalGroup.add(basePlinth);

    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.25, 0.06, 12, 48),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = -0.52;
    pedestalGroup.add(baseRing);

    const foundationSlab = new THREE.Mesh(
      new THREE.BoxGeometry(INITIAL_SIZE, SLAB_HEIGHT, INITIAL_SIZE),
      new THREE.MeshPhysicalMaterial({
        color: 0x1e293b,
        metalness: 0.65,
        roughness: 0.2,
        clearcoat: 0.8
      })
    );
    foundationSlab.position.y = -SLAB_HEIGHT / 2;
    foundationSlab.receiveShadow = !isSoftwareGl;
    pedestalGroup.add(foundationSlab);
    scene.add(pedestalGroup);

    const towerGroup = new THREE.Group();
    scene.add(towerGroup);

    const activeSlabMat = new THREE.MeshPhysicalMaterial({
      color: PALETTE_HEX[0],
      metalness: 0.45,
      roughness: 0.18,
      clearcoat: 1.0
    });
    const activeSlabMesh = new THREE.Mesh(new THREE.BoxGeometry(1, SLAB_HEIGHT, 1), activeSlabMat);
    activeSlabMesh.castShadow = !isSoftwareGl;
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

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 600;
      const h = mount.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    window.addEventListener('resize', handleResize);

    let elapsed = 0;
    let swRenderAcc = 0;
    let hasRenderedInitial = false;

    startLoop((_timestamp, deltaTimeMs) => {
      const delta = Math.min(deltaTimeMs / 1000, 0.05);
      elapsed += delta;
      const st = stackStateRef.current;

      if (st.resetRequested) {
        clearTower();
        st.resetRequested = false;
      }

      // Process newly placed slabs
      while (st.placedQueue.length > 0) {
        const item = st.placedQueue.shift()!;
        const mat = new THREE.MeshPhysicalMaterial({
          color: item.colorHex,
          metalness: 0.45,
          roughness: 0.2,
          clearcoat: 0.9,
          emissive: item.isPerfect ? item.colorHex : 0x000000,
          emissiveIntensity: item.isPerfect ? 0.35 : 0
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(item.w, SLAB_HEIGHT, item.d), mat);
        mesh.position.set(item.x, item.y, item.z);
        mesh.castShadow = !isSoftwareGl;
        mesh.receiveShadow = !isSoftwareGl;
        towerGroup.add(mesh);

        if (item.isPerfect) {
          const ringGeo = new THREE.RingGeometry(
            Math.max(item.w, item.d) * 0.65,
            Math.max(item.w, item.d) * 0.78,
            32
          );
          ringGeo.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          ringMesh.position.set(item.x, item.y - SLAB_HEIGHT / 2 + 0.02, item.z);
          scene.add(ringMesh);
          shockwaves.push({ mesh: ringMesh, scale: 1, opacity: 0.95 });
        }
      }

      // Process sliced overhanging pieces
      while (st.sliceQueue.length > 0) {
        const cut = st.sliceQueue.shift()!;
        const cutMat = new THREE.MeshStandardMaterial({
          color: cut.colorHex,
          metalness: 0.3,
          roughness: 0.4
        });
        const cutMesh = new THREE.Mesh(new THREE.BoxGeometry(cut.w, SLAB_HEIGHT, cut.d), cutMat);
        cutMesh.position.set(cut.x, cut.y, cut.z);
        scene.add(cutMesh);
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
      activeSlabMesh.visible = gameStateRef.current === 'playing';
      activeSlabMesh.scale.set(st.activeW, 1, st.activeD);
      activeSlabMesh.position.set(st.activeX, activeY, st.activeZ);
      activeSlabMat.color.setHex(PALETTE_HEX[st.rowIdx % PALETTE_HEX.length]);

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
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, sw.opacity);
        if (sw.opacity <= 0) {
          sw.mesh.geometry.dispose();
          (sw.mesh.material as THREE.Material).dispose();
          scene.remove(sw.mesh);
          shockwaves.splice(i, 1);
        }
      }

      // Smooth camera tracking tower height
      const towerTopY = st.rowIdx * SLAB_HEIGHT;
      const mode = cameraAngleRef.current;
      if (mode === 'isometric') {
        _camPos.set(7.2, towerTopY + 6.2, 7.2);
      } else if (mode === 'front') {
        _camPos.set(0, towerTopY + 5.2, 9.8);
      } else {
        const orbAngle = elapsed * 0.45;
        _camPos.set(Math.cos(orbAngle) * 8.8, towerTopY + 6.0, Math.sin(orbAngle) * 8.8);
      }
      _camTarget.set(0, Math.max(0, towerTopY - 0.8), 0);

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camPos.x, 6, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camPos.y, 6, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camPos.z, 6, delta);
      camera.lookAt(_camTarget);

      keyLight.position.y = towerTopY + 16;
      keyLight.target.position.set(0, towerTopY, 0);
      keyLight.target.updateMatrixWorld();

      if (!isSoftwareGl) {
        renderer.render(scene, camera);
      } else {
        swRenderAcc += delta;
        if (!hasRenderedInitial || swRenderAcc >= 0.06) {
          hasRenderedInitial = true;
          swRenderAcc = 0;
          renderer.render(scene, camera);
        }
      }
    });

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      clearTower();
      disposeThreeScene(scene, renderer);
    };
  }, [gameStateRef, startLoop, stopLoop]);

  return (
    <div
      onPointerDown={handleStack}
      className="relative w-full h-full min-h-[480px] flex flex-col items-center justify-center bg-[#060913] overflow-hidden select-none cursor-pointer touch-none"
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
              className={`px-3 py-1.5 rounded-lg font-mono font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
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
              className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-semibold tracking-wide whitespace-nowrap touch-none"
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
