import React, { useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameComponentProps } from '../../types';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../sdk';
import { disposeThreeScene } from '../../utils/threeCleanup';
import { screenShake } from '../../utils/screenShake';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Shield, Zap, Sparkles, Eye, ChevronDown, ChevronUp } from 'lucide-react';

type SpaceCamView = 'chase' | 'cockpit' | 'tactical';

interface SpaceHazard3D {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  speed: number;
  type: 'asteroid' | 'star' | 'shield' | 'laserRing';
  radius: number;
  rotSpeed: THREE.Vector3;
}

const BOUNDS_X = 5.4;
const BOUNDS_Y = 3.2;

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

function buildStarfighter(isSoftwareGl: boolean): {
  group: THREE.Group;
  shieldMesh: THREE.Mesh;
  thrusterL: THREE.Mesh;
  thrusterR: THREE.Mesh;
} {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.75,
    roughness: 0.22,
    clearcoat: 0.9
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    metalness: 0.65,
    roughness: 0.28
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.5,
    roughness: 0.5
  });
  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    metalness: 0.1,
    roughness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.85,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.95
  });

  // 1. Sleek Fuselage Cone
  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.5, 8), hullMat);
  fuselage.rotation.x = -Math.PI / 2;
  fuselage.scale.set(1, 1, 0.55);
  group.add(fuselage);

  // 2. Cockpit Canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), canopyMat);
  canopy.scale.set(0.85, 0.55, 1.8);
  canopy.position.set(0, 0.18, -0.1);
  group.add(canopy);

  // 3. Swept Delta Wings
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.06, 0.85), wingMat);
  wing.position.set(0, 0, 0.35);
  group.add(wing);

  // 4. Vertical Stabilizer Fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 0.65), wingMat);
  fin.position.set(0, 0.28, 0.62);
  group.add(fin);

  // 5. Wingtip Laser Pods
  const podGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8);
  podGeo.rotateX(Math.PI / 2);
  const podL = new THREE.Mesh(podGeo, darkMat);
  podL.position.set(-1.15, 0, 0.25);
  const podR = podL.clone();
  podR.position.x = 1.15;
  group.add(podL, podR);

  // 6. Twin Plasma Thruster Flames
  const flameGeo = new THREE.ConeGeometry(0.14, 0.75, 8);
  flameGeo.rotateX(Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const thrusterL = new THREE.Mesh(flameGeo, flameMat);
  thrusterL.position.set(-0.24, 0, 1.45);
  const thrusterR = thrusterL.clone();
  thrusterR.position.x = 0.24;
  group.add(thrusterL, thrusterR);

  // 7. Energy Shield Sphere
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.45, 1),
    new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      wireframe: true,
      transparent: true,
      opacity: 0.32
    })
  );
  group.add(shieldMesh);

  return { group, shieldMesh, thrusterL, thrusterR };
}

function buildHazardMesh(type: SpaceHazard3D['type']): THREE.Group {
  const g = new THREE.Group();
  if (type === 'asteroid') {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.88, 1),
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.75,
        metalness: 0.2,
        flatShading: true
      })
    );
    const core = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.9, 0),
      new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true })
    );
    g.add(rock, core);
  } else if (type === 'star') {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.9,
        roughness: 0.15
      })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    g.add(star, halo);
  } else if (type === 'shield') {
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.52, 1),
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.85
      })
    );
    g.add(orb);
  } else {
    // Laser hazard ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.14, 10, 24),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.85
      })
    );
    g.add(ring);
  }
  return g;
}

export default function CosmicDodgeGame({ onScoreUpdate, onGameOver, highScore }: GameComponentProps) {
  const {
    gameState,
    score,
    triggerGameOver,
    updateScore,
    startWithCountdown,
    resumeGame,
    countdown,
    startLoop,
    stopLoop,
    gameStateRef,
    scoreRef
  } = useGameEngine({
    gameId: 'cosmicdodge',
    onScoreUpdate,
    onGameOver
  });

  const [shields, setShields] = useState(1);
  const [combo, setCombo] = useState(1);
  const [warpCharge, setWarpCharge] = useState(100);
  const [camView, setCamView] = useState<SpaceCamView>('chase');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [bannerText, setBannerText] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const camViewRef = useRef<SpaceCamView>('chase');
  const keysRef = useRef<Record<string, boolean>>({});
  const lastWarpPctRef = useRef(100);
  const bannerTimerRef = useRef<number | null>(null);

  const shipStateRef = useRef({
    targetX: 0,
    targetY: 0,
    x: 0,
    y: 0,
    shields: 1,
    invulnTimer: 0,
    combo: 1,
    warpEnergy: 100,
    isWarping: false,
    resetRequested: true
  });

  useEffect(() => {
    camViewRef.current = camView;
  }, [camView]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        clearTimeout(bannerTimerRef.current);
      }
    };
  }, []);

  const showBanner = useCallback((msg: string) => {
    setBannerText(msg);
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setBannerText(null);
      bannerTimerRef.current = null;
    }, 1200);
  }, []);

  const handleStart = useCallback(() => {
    updateScore(0);
    setShields(1);
    setCombo(1);
    setWarpCharge(100);

    shipStateRef.current = {
      targetX: 0,
      targetY: 0,
      x: 0,
      y: 0,
      shields: 1,
      invulnTimer: 0,
      combo: 1,
      warpEnergy: 100,
      isWarping: false,
      resetRequested: true
    };

    startWithCountdown(() => {
      audio.playClick();
    });
  }, [startWithCountdown, updateScore]);

  // Pointer drag navigation in 3D plane
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameStateRef.current !== 'playing') return;
    const mount = canvasMountRef.current;
    if (!mount) return;
    const rect = mount.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    shipStateRef.current.targetX = THREE.MathUtils.clamp(nx * BOUNDS_X, -BOUNDS_X, BOUNDS_X);
    shipStateRef.current.targetY = THREE.MathUtils.clamp(ny * BOUNDS_Y, -BOUNDS_Y, BOUNDS_Y);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        setCamView((prev) => (prev === 'chase' ? 'cockpit' : prev === 'cockpit' ? 'tactical' : 'chase'));
        return;
      }
      keysRef.current[e.key.toLowerCase()] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        shipStateRef.current.isWarping = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      if (e.code === 'Space') {
        shipStateRef.current.isWarping = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Three.js 3D Deep Space Tunnel
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
    const height = mount.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030611);
    scene.fog = new THREE.FogExp2(0x030611, 0.015);

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 180);
    camera.position.set(0, 1.8, 6.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.7);
    keyLight.position.set(10, 16, 12);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf43f5e, 0.9);
    rimLight.position.set(-10, -8, -20);
    scene.add(rimLight);

    // Instanced Starfield Tunnel (100 stars)
    const starCount = 100;
    const starInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, 0.08, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x7dd3fc }),
      starCount
    );
    starInst.frustumCulled = false;
    const starPositions: { x: number; y: number; z: number }[] = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < starCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 8 + Math.random() * 14;
      const sx = Math.cos(ang) * rad;
      const sy = Math.sin(ang) * rad;
      const sz = -Math.random() * 140;
      starPositions.push({ x: sx, y: sy, z: sz });
      dummy.position.set(sx, sy, sz);
      dummy.updateMatrix();
      starInst.setMatrixAt(i, dummy.matrix);
    }
    scene.add(starInst);

    const fighter = buildStarfighter(isSoftwareGl);
    scene.add(fighter.group);

    // Hazard & Collectible Pool (14 items)
    const hazardPool: SpaceHazard3D[] = [];
    const types: SpaceHazard3D['type'][] = [
      'asteroid', 'asteroid', 'asteroid', 'star', 'star',
      'asteroid', 'laserRing', 'asteroid', 'star', 'shield',
      'asteroid', 'asteroid', 'star', 'laserRing'
    ];

    types.forEach((t, idx) => {
      const mesh = buildHazardMesh(t);
      const x = (Math.random() - 0.5) * BOUNDS_X * 2;
      const y = (Math.random() - 0.5) * BOUNDS_Y * 2;
      const z = -22 - idx * 9.5;
      mesh.position.set(x, y, z);
      scene.add(mesh);
      hazardPool.push({
        mesh,
        x,
        y,
        z,
        speed: 24 + (idx % 4) * 3,
        type: t,
        radius: t === 'laserRing' ? 1.2 : t === 'asteroid' ? 0.92 : 0.72,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5
        )
      });
    });

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 640;
      const h = mount.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);
    window.addEventListener('resize', handleResize);

    let elapsed = 0;
    let uiTimer = 0;
    let swRenderAcc = 0;
    let hasRenderedInitial = false;

    startLoop((_timestamp, deltaTimeMs) => {
      const delta = Math.min(deltaTimeMs / 1000, 0.05);
      elapsed += delta;
      const st = shipStateRef.current;

      if (st.resetRequested) {
        st.resetRequested = false;
        hazardPool.forEach((h, idx) => {
          h.x = (Math.random() - 0.5) * BOUNDS_X * 1.9;
          h.y = (Math.random() - 0.5) * BOUNDS_Y * 1.9;
          h.z = -24 - idx * 9.5;
          h.mesh.position.set(h.x, h.y, h.z);
        });
      }

      if (gameStateRef.current === 'playing') {
        if (st.invulnTimer > 0) st.invulnTimer -= delta;

        const k = keysRef.current;
        const moveSpd = 9.5 * delta;
        if (k['arrowleft'] || k['a']) st.targetX = Math.max(-BOUNDS_X, st.targetX - moveSpd);
        if (k['arrowright'] || k['d']) st.targetX = Math.min(BOUNDS_X, st.targetX + moveSpd);
        if (k['arrowup'] || k['w']) st.targetY = Math.min(BOUNDS_Y, st.targetY + moveSpd);
        if (k['arrowdown'] || k['s']) st.targetY = Math.max(-BOUNDS_Y, st.targetY - moveSpd);

        const wantsWarp = st.isWarping && st.warpEnergy > 1;
        if (wantsWarp) {
          st.warpEnergy = Math.max(0, st.warpEnergy - 32 * delta);
        } else {
          st.warpEnergy = Math.min(100, st.warpEnergy + 14 * delta);
        }

        const speedScale = (1 + scoreRef.current * 0.0012) * (wantsWarp ? 1.85 : 1.0);

        const dx = st.targetX - st.x;
        const dy = st.targetY - st.y;
        st.x = THREE.MathUtils.damp(st.x, st.targetX, 14, delta);
        st.y = THREE.MathUtils.damp(st.y, st.targetY, 14, delta);

        fighter.group.position.set(st.x, st.y, 0);
        fighter.group.rotation.z = THREE.MathUtils.clamp(-dx * 0.28, -0.65, 0.65);
        fighter.group.rotation.x = THREE.MathUtils.clamp(dy * 0.22, -0.45, 0.45);
        fighter.shieldMesh.visible = st.shields > 0 || wantsWarp;
        fighter.shieldMesh.rotation.y = elapsed * 1.8;
        fighter.thrusterL.scale.setScalar(wantsWarp ? 1.5 : 0.9 + Math.sin(elapsed * 20) * 0.15);
        fighter.thrusterR.scale.setScalar(wantsWarp ? 1.5 : 0.9 + Math.cos(elapsed * 20) * 0.15);

        // Animate Starfield
        for (let i = 0; i < starCount; i++) {
          const sp = starPositions[i];
          sp.z += 55 * speedScale * delta;
          if (sp.z > 8) sp.z = -135;
          dummy.position.set(sp.x, sp.y, sp.z);
          dummy.scale.set(1, 1, wantsWarp ? 3.2 : 1);
          dummy.updateMatrix();
          starInst.setMatrixAt(i, dummy.matrix);
        }
        starInst.instanceMatrix.needsUpdate = true;

        // Update Hazards & Collectibles
        for (const h of hazardPool) {
          h.z += h.speed * speedScale * delta;
          h.mesh.position.set(h.x, h.y, h.z);
          h.mesh.rotation.x += h.rotSpeed.x * delta;
          h.mesh.rotation.y += h.rotSpeed.y * delta;

          if (Math.abs(h.z) < 1.15) {
            const dist = Math.hypot(h.x - st.x, h.y - st.y);
            if (dist < h.radius + 0.55) {
              if (h.type === 'star') {
                audio.playCoin();
                st.combo = Math.min(8, st.combo + 1);
                setCombo(st.combo);
                const pts = 20 * st.combo;
                updateScore(scoreRef.current + pts);
                showBanner(`HYPER STAR +${pts} (x${st.combo})`);
                h.z = -125 - Math.random() * 25;
                h.x = (Math.random() - 0.5) * BOUNDS_X * 1.9;
                h.y = (Math.random() - 0.5) * BOUNDS_Y * 1.9;
              } else if (h.type === 'shield') {
                audio.playLevelUp();
                st.shields = Math.min(3, st.shields + 1);
                setShields(st.shields);
                showBanner('PERISAI PLASMA +1!');
                h.z = -140;
              } else if (!wantsWarp && st.invulnTimer <= 0) {
                if (st.shields > 0) {
                  st.shields -= 1;
                  st.invulnTimer = 1.4;
                  st.combo = 1;
                  setShields(st.shields);
                  setCombo(1);
                  audio.playExplosion();
                  screenShake.trigger('medium');
                  showBanner('PERISAI MENAHAN METEOR!');
                  h.z = -130;
                } else {
                  audio.playExplosion();
                  screenShake.trigger('heavy');
                  triggerGameOver(scoreRef.current);
                  break;
                }
              }
            }
          }

          if (h.z > 8) {
            h.z = -120 - Math.random() * 30;
            h.x = (Math.random() - 0.5) * BOUNDS_X * 1.9;
            h.y = (Math.random() - 0.5) * BOUNDS_Y * 1.9;
          }
        }

        uiTimer += delta;
        if (uiTimer > 0.12) {
          uiTimer = 0;
          const nextWarp = Math.round(st.warpEnergy);
          if (nextWarp !== lastWarpPctRef.current) {
            lastWarpPctRef.current = nextWarp;
            setWarpCharge(nextWarp);
          }
        }
      }

      // Camera Choreography
      const view = camViewRef.current;
      if (view === 'chase') {
        _camPos.set(st.x * 0.55, st.y * 0.55 + 1.65, 6.4);
        _camLook.set(st.x * 0.7, st.y * 0.7, -18);
      } else if (view === 'cockpit') {
        _camPos.set(st.x, st.y + 0.35, -0.4);
        _camLook.set(st.x, st.y, -25);
      } else {
        _camPos.set(0, 9.5, 9.5);
        _camLook.set(0, 0, -14);
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, _camPos.x, 9, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, _camPos.y, 9, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, _camPos.z, 9, delta);
      camera.lookAt(_camLook);

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
      disposeThreeScene(scene, renderer);
    };
  }, [gameStateRef, scoreRef, showBanner, startLoop, stopLoop, triggerGameOver, updateScore]);

  return (
    <div
      onPointerDown={handlePointerMove}
      onPointerMove={handlePointerMove}
      className="relative w-full h-full min-h-[480px] flex flex-col items-center justify-center bg-[#030611] overflow-hidden select-none touch-none"
    >
      {/* Dedicated WebGL Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 bg-slate-950/90 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-cyan-400 font-semibold flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" />
            PERISAI {shields}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            x{combo}
          </span>
        </div>

        <div className="bg-slate-950/90 border border-white/10 px-4 py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-slate-400 mr-2">WARP SKOR</span>
          <span className="text-white font-bold text-base">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Status Banner */}
      {bannerText && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-cyan-500/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-cyan-300 tracking-wide shadow-lg">
          {bannerText}
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
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
            {(['chase', 'cockpit', 'tactical'] as SpaceCamView[]).map((v) => (
              <button
                key={v}
                onClick={() => setCamView(v)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                  camView === v
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-mono">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-amber-400"
                  style={{ width: `${warpCharge}%` }}
                />
              </div>
            </div>

            <button
              onPointerDown={() => {
                shipStateRef.current.isWarping = true;
              }}
              onPointerUp={() => {
                shipStateRef.current.isWarping = false;
              }}
              onPointerLeave={() => {
                shipStateRef.current.isWarping = false;
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold whitespace-nowrap"
            >
              Hyper-Warp
            </button>
          </div>
        </div>
      </div>

      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        onStart={handleStart}
        onRestart={handleStart}
        onResume={resumeGame}
        countdown={countdown}
        gameTitle="COSMIC DODGE 3D"
        instructions="Navigasikan pesawat tempur 3D dengan WASD/Panah atau geser kursor/jari! Kumpulkan kristal bintang emas, ambil perisai biru, dan tahan SPASI untuk Hyper-Warp!"
      />
    </div>
  );
}
