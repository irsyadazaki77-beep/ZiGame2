import React, { useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GameComponentProps } from '../../types';
import { audioController } from '../../sdk/audioController';
import { useGameEngine } from '../../sdk';
import { inputManager } from '../../services/inputService';
import { ThreeStageController } from '../../utils/threeStage';
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

interface ExhaustSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vz: number;
  life: number;
  maxLife: number;
  warp: boolean;
}

const BOUNDS_X = 5.4;
const BOUNDS_Y = 3.2;
const EXHAUST_CAPACITY = 90;

const _camTargetPos = new THREE.Vector3(0, 1.8, 6.8);
const _camSmoothPos = new THREE.Vector3(0, 1.8, 6.8);
const _camLook = new THREE.Vector3(0, 0, -18);
const _dummy = new THREE.Object3D();

function buildStarfighter(isSoftwareGl: boolean): {
  group: THREE.Group;
  shieldMesh: THREE.Mesh;
  thrusterL: THREE.Mesh;
  thrusterR: THREE.Mesh;
} {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    metalness: 0.78,
    roughness: 0.2,
    clearcoat: 0.9
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    metalness: 0.68,
    roughness: 0.26
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.55,
    roughness: 0.45
  });
  const tipGlowMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.9,
    roughness: 0.15
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
  const fuselage = new THREE.Mesh(new THREE.ConeGeometry(0.42, 2.5, 10), hullMat);
  fuselage.rotation.x = -Math.PI / 2;
  fuselage.scale.set(1, 1, 0.55);
  group.add(fuselage);

  // 2. Cockpit Canopy
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), canopyMat);
  canopy.scale.set(0.85, 0.55, 1.8);
  canopy.position.set(0, 0.18, -0.1);
  group.add(canopy);

  // 3. Sculpted Swept Delta Wings (RoundedBoxGeometry)
  const wing = new THREE.Mesh(new RoundedBoxGeometry(2.38, 0.08, 0.88, 2, 0.025), wingMat);
  wing.position.set(0, 0, 0.35);
  group.add(wing);

  // 4. Vertical Stabilizer Fin
  const fin = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.54, 0.66, 2, 0.02), wingMat);
  fin.position.set(0, 0.28, 0.62);
  group.add(fin);

  // 5. Wingtip Laser Pods + HDR Emitters
  const podGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.9, 10);
  podGeo.rotateX(Math.PI / 2);
  const podL = new THREE.Mesh(podGeo, darkMat);
  podL.position.set(-1.15, 0, 0.25);
  const podR = podL.clone();
  podR.position.x = 1.15;

  const emitterGeo = new THREE.SphereGeometry(0.055, 8, 8);
  const emitterL = new THREE.Mesh(emitterGeo, tipGlowMat);
  emitterL.position.set(-1.15, 0, -0.22);
  const emitterR = emitterL.clone();
  emitterR.position.x = 1.15;
  group.add(podL, podR, emitterL, emitterR);

  // 6. Twin HDR Plasma Thruster Flames
  const flameGeo = new THREE.ConeGeometry(0.15, 0.78, 10);
  flameGeo.rotateX(Math.PI / 2);
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xfdba74,
    emissive: 0xf97316,
    emissiveIntensity: 2.4,
    roughness: 0.1
  });
  const thrusterL = new THREE.Mesh(flameGeo, flameMat);
  thrusterL.position.set(-0.24, 0, 1.45);
  const thrusterR = thrusterL.clone();
  thrusterR.position.x = 0.24;
  group.add(thrusterL, thrusterR);

  // 7. Energy Shield Sphere
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.45, 1),
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.45,
      wireframe: true,
      transparent: true,
      opacity: 0.42
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
        color: 0x475569,
        roughness: 0.78,
        metalness: 0.25,
        flatShading: true
      })
    );
    const core = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.91, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf87171,
        emissive: 0xef4444,
        emissiveIntensity: 1.65,
        wireframe: true
      })
    );
    g.add(rock, core);
  } else if (type === 'star') {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 2.0,
        roughness: 0.15
      })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.045, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.85,
        roughness: 0.2
      })
    );
    g.add(star, halo);
  } else if (type === 'shield') {
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.52, 1),
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.9,
        roughness: 0.12
      })
    );
    g.add(orb);
  } else {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.14, 10, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfb7185,
        emissive: 0xf43f5e,
        emissiveIntensity: 2.1,
        roughness: 0.15
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
      audioController.playClick();
    });
  }, [startWithCountdown, updateScore]);

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
    const unsub = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = true;
        if (action === 'RIGHT') keysRef.current['arrowright'] = true;
        if (action === 'UP') keysRef.current['arrowup'] = true;
        if (action === 'DOWN') keysRef.current['arrowdown'] = true;
        if (action === 'PRIMARY' || action === 'ACTION_PRIMARY') shipStateRef.current.isWarping = true;
      },
      onActionUp: (action) => {
        if (action === 'LEFT') keysRef.current['arrowleft'] = false;
        if (action === 'RIGHT') keysRef.current['arrowright'] = false;
        if (action === 'UP') keysRef.current['arrowup'] = false;
        if (action === 'DOWN') keysRef.current['arrowdown'] = false;
        if (action === 'PRIMARY' || action === 'ACTION_PRIMARY') shipStateRef.current.isWarping = false;
      }
    });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      unsub();
    };
  }, []);

  // Unified ThreeStageController 3D Deep Space Tunnel
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container: mount,
        backgroundColor: 0x030611,
        fogColor: 0x030611,
        fogDensity: 0.015,
        fov: 62,
        near: 0.1,
        far: 180,
        manualCamera: true,
        enableGridFloor: false,
        enableShadows: false,
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

    const { scene, camera } = stage;
    camera.position.set(0, 1.8, 6.8);
    stage.rimLight.color.setHex(0xf43f5e);
    stage.rimLight.position.set(-10, -8, -20);

    // Instanced HDR Starfield Tunnel (120 stars)
    const starCount = 120;
    const starInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, 0.08, 1.7),
      new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.8,
        roughness: 0.15
      }),
      starCount
    );
    starInst.frustumCulled = false;
    const starPositions: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < starCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 8 + Math.random() * 14;
      const sx = Math.cos(ang) * rad;
      const sy = Math.sin(ang) * rad;
      const sz = -Math.random() * 140;
      starPositions.push({ x: sx, y: sy, z: sz });
      _dummy.position.set(sx, sy, sz);
      _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix();
      starInst.setMatrixAt(i, _dummy.matrix);
    }
    scene.add(starInst);

    const fighter = buildStarfighter(stage.isSoftwareGl);
    scene.add(fighter.group);

    // Instanced Twin Thruster Exhaust Pool
    const exhaustInst = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.08, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfdba74,
        emissive: 0xf97316,
        emissiveIntensity: 2.2,
        roughness: 0.1
      }),
      EXHAUST_CAPACITY
    );
    exhaustInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    exhaustInst.frustumCulled = false;
    const exhaustSlots: ExhaustSlot[] = Array.from({ length: EXHAUST_CAPACITY }, () => ({
      active: false,
      x: 0,
      y: -99,
      z: 0,
      vz: 12,
      life: 0,
      maxLife: 0.3,
      warp: false
    }));
    let exhaustCursor = 0;

    _dummy.position.set(0, -99, 0);
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    for (let i = 0; i < EXHAUST_CAPACITY; i++) {
      exhaustInst.setMatrixAt(i, _dummy.matrix);
    }
    exhaustInst.instanceMatrix.needsUpdate = true;
    scene.add(exhaustInst);

    const emitExhaust = (x: number, y: number, warp: boolean) => {
      for (const offsetX of [-0.24, 0.24]) {
        const slot = exhaustSlots[exhaustCursor];
        exhaustCursor = (exhaustCursor + 1) % EXHAUST_CAPACITY;
        slot.active = true;
        slot.x = x + offsetX + (Math.random() - 0.5) * 0.06;
        slot.y = y + (Math.random() - 0.5) * 0.06;
        slot.z = 1.6;
        slot.vz = warp ? 28 : 15;
        slot.maxLife = warp ? 0.36 : 0.24;
        slot.life = slot.maxLife;
        slot.warp = warp;
      }
    };

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

    let uiTimer = 0;
    let exhaustTimer = 0;
    _camSmoothPos.set(0, 1.8, 6.8);

    stage.startLoop((dt, elapsed) => {
      const delta = Math.min(dt, 0.05);
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

      const wantsWarp = gameStateRef.current === 'playing' && st.isWarping && st.warpEnergy > 1;

      if (gameStateRef.current === 'playing') {
        if (st.invulnTimer > 0) st.invulnTimer -= delta;

        const k = keysRef.current;
        const moveSpd = 9.5 * delta;
        if (k['arrowleft'] || k['a']) st.targetX = Math.max(-BOUNDS_X, st.targetX - moveSpd);
        if (k['arrowright'] || k['d']) st.targetX = Math.min(BOUNDS_X, st.targetX + moveSpd);
        if (k['arrowup'] || k['w']) st.targetY = Math.min(BOUNDS_Y, st.targetY + moveSpd);
        if (k['arrowdown'] || k['s']) st.targetY = Math.max(-BOUNDS_Y, st.targetY - moveSpd);

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
        fighter.thrusterL.scale.setScalar(wantsWarp ? 1.65 : 0.9 + Math.sin(elapsed * 20) * 0.15);
        fighter.thrusterR.scale.setScalar(wantsWarp ? 1.65 : 0.9 + Math.cos(elapsed * 20) * 0.15);

        exhaustTimer += delta;
        if (exhaustTimer >= (wantsWarp ? 0.018 : 0.036)) {
          exhaustTimer = 0;
          emitExhaust(st.x, st.y, wantsWarp);
        }

        // Animate Starfield
        for (let i = 0; i < starCount; i++) {
          const sp = starPositions[i];
          sp.z += 55 * speedScale * delta;
          if (sp.z > 8) sp.z = -135;
          _dummy.position.set(sp.x, sp.y, sp.z);
          _dummy.scale.set(1, 1, wantsWarp ? 3.5 : 1);
          _dummy.updateMatrix();
          starInst.setMatrixAt(i, _dummy.matrix);
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
                st.combo = Math.min(8, st.combo + 1);
                setCombo(st.combo);
                if (st.combo > 1) {
                  audioController.playCombo(st.combo);
                } else {
                  audioController.playScore();
                }
                const pts = 20 * st.combo;
                updateScore(scoreRef.current + pts);
                stage.particles.burst(h.x, h.y, 0, 18, 0xfacc15, 7);
                stage.cameraRig.kickFov(2.5);
                showBanner(`HYPER STAR +${pts} (x${st.combo})`);
                h.z = -125 - Math.random() * 25;
                h.x = (Math.random() - 0.5) * BOUNDS_X * 1.9;
                h.y = (Math.random() - 0.5) * BOUNDS_Y * 1.9;
              } else if (h.type === 'shield') {
                audioController.playPowerup();
                st.shields = Math.min(3, st.shields + 1);
                setShields(st.shields);
                stage.particles.burst(h.x, h.y, 0, 22, 0x22d3ee, 7);
                showBanner('PERISAI PLASMA +1!');
                h.z = -140;
              } else if (!wantsWarp && st.invulnTimer <= 0) {
                if (st.shields > 0) {
                  st.shields -= 1;
                  st.invulnTimer = 1.4;
                  st.combo = 1;
                  setShields(st.shields);
                  setCombo(1);
                  audioController.playShield();
                  screenShake.trigger('medium');
                  stage.cameraRig.addTrauma(0.65);
                  stage.particles.burst(st.x, st.y, 0, 30, 0xef4444, 9);
                  showBanner('PERISAI MENAHAN METEOR!');
                  h.z = -130;
                } else {
                  audioController.playGameOver();
                  screenShake.trigger('heavy');
                  stage.cameraRig.addTrauma(0.95);
                  stage.particles.burst(st.x, st.y, 0, 40, 0xf97316, 11);
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

      // Update Thruster Exhaust InstancedMesh
      let exhaustDirty = false;
      for (let i = 0; i < EXHAUST_CAPACITY; i++) {
        const es = exhaustSlots[i];
        if (!es.active) continue;
        exhaustDirty = true;
        es.life -= delta;
        if (es.life <= 0) {
          es.active = false;
          _dummy.position.set(0, -99, 0);
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          exhaustInst.setMatrixAt(i, _dummy.matrix);
        } else {
          es.z += es.vz * delta;
          const ratio = es.life / es.maxLife;
          const rad = ratio * (es.warp ? 1.45 : 0.95);
          _dummy.position.set(es.x, es.y, es.z);
          _dummy.scale.set(rad, rad, rad * (es.warp ? 3.2 : 1.8));
          _dummy.updateMatrix();
          exhaustInst.setMatrixAt(i, _dummy.matrix);
        }
      }
      if (exhaustDirty) {
        exhaustInst.instanceMatrix.needsUpdate = true;
      }

      // Camera Choreography + Dynamic Warp FOV + Trauma Shake
      const view = camViewRef.current;
      if (view === 'chase') {
        _camTargetPos.set(st.x * 0.55, st.y * 0.55 + 1.65, 6.4);
        _camLook.set(st.x * 0.7, st.y * 0.7, -18);
      } else if (view === 'cockpit') {
        _camTargetPos.set(st.x, st.y + 0.35, -0.4);
        _camLook.set(st.x, st.y, -25);
      } else {
        _camTargetPos.set(0, 9.5, 9.5);
        _camLook.set(0, 0, -14);
      }

      _camSmoothPos.x = THREE.MathUtils.damp(_camSmoothPos.x, _camTargetPos.x, 9, delta);
      _camSmoothPos.y = THREE.MathUtils.damp(_camSmoothPos.y, _camTargetPos.y, 9, delta);
      _camSmoothPos.z = THREE.MathUtils.damp(_camSmoothPos.z, _camTargetPos.z, 9, delta);

      const speedRatio = wantsWarp ? 0.95 : Math.min(0.45, scoreRef.current / 1200);
      stage.cameraRig.updateDynamicFov(camera, 62, speedRatio, delta, 14);
      stage.cameraRig.applyTraumaToCamera(camera, _camSmoothPos, delta, 0.45);
      camera.lookAt(_camLook);
    });

    return () => {
      stage.dispose();
    };
  }, [gameStateRef, scoreRef, showBanner, triggerGameOver, updateScore]);

  return (
    <div
      onPointerDown={handlePointerMove}
      onPointerMove={handlePointerMove}
      className="relative w-full h-full min-h-[260px] sm:min-h-[380px] lg:min-h-[480px] flex flex-col items-center justify-center bg-[#030611] overflow-hidden select-none touch-none"
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
              className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold whitespace-nowrap"
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
