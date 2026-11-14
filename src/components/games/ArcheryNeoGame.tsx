import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audio } from '../../utils/audio';
import { useGameEngine } from '../../sdk';
import { disposeThreeScene } from '../../utils/threeCleanup';
import { screenShake } from '../../utils/screenShake';
import { GameOverlay } from '../gameplay/GameOverlay';
import { Target, Wind, Sparkles, Eye, ChevronDown, ChevronUp, Crosshair } from 'lucide-react';

interface GameProps {
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  highScore: number;
}

type ArcheryCamMode = 'archer' | 'arrow' | 'side';

interface FlyingArrow3D {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
  stuckOffset?: THREE.Vector3;
  life: number;
}

const _camPos = new THREE.Vector3();
const _camLook = new THREE.Vector3();

function createTargetFaceTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);
  const cx = 256;
  const cy = 256;

  const rings = [
    { r: 248, color: '#f8fafc' },
    { r: 200, color: '#0f172a' },
    { r: 150, color: '#06b6d4' },
    { r: 100, color: '#ef4444' },
    { r: 48, color: '#facc15' }
  ];

  for (const ring of rings) {
    ctx.fillStyle = ring.color;
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Center pinhole X
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function buildCompoundBow(): {
  group: THREE.Group;
  nockedArrow: THREE.Group;
} {
  const group = new THREE.Group();

  const riserMat = new THREE.MeshPhysicalMaterial({
    color: 0x06b6d4,
    metalness: 0.85,
    roughness: 0.2,
    clearcoat: 1.0
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.6,
    roughness: 0.35
  });
  const camMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.8,
    roughness: 0.2
  });

  // 1. Center Riser
  const riser = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.12), riserMat);
  group.add(riser);

  // 2. Upper & Lower Limbs
  const topLimb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.08), limbMat);
  topLimb.position.set(0, 0.62, 0.12);
  topLimb.rotation.x = -0.35;
  const botLimb = topLimb.clone();
  botLimb.position.set(0, -0.62, 0.12);
  botLimb.rotation.x = 0.35;
  group.add(topLimb, botLimb);

  // 3. Cam Pulleys
  const camGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16);
  camGeo.rotateZ(Math.PI / 2);
  const topCam = new THREE.Mesh(camGeo, camMat);
  topCam.position.set(0, 0.92, 0.24);
  const botCam = topCam.clone();
  botCam.position.set(0, -0.92, 0.24);
  group.add(topCam, botCam);

  // 4. Holographic Sight Ring
  const sightRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.09, 0.012, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee })
  );
  sightRing.position.set(-0.12, 0.18, -0.1);
  group.add(sightRing);

  // 5. Nocked Arrow Preview
  const nockedArrow = buildArrowMesh();
  nockedArrow.position.set(-0.04, 0.08, 0);
  group.add(nockedArrow);

  return { group, nockedArrow };
}

function buildArrowMesh(): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.25 })
  );
  shaft.rotation.x = Math.PI / 2;
  g.add(shaft);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.042, 0.18, 8),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.6
    })
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.75;
  g.add(tip);

  const fletching = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.02, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xec4899 })
  );
  fletching.position.z = 0.56;
  const fletchingV = fletching.clone();
  fletchingV.rotation.z = Math.PI / 2;
  g.add(fletching, fletchingV);

  return g;
}

export default function ArcheryNeoGame({ onGameOver, onScoreUpdate, highScore }: GameProps) {
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
    gameStateRef,
    scoreRef
  } = useGameEngine({
    gameId: 'archeryneo',
    onGameOver,
    onScoreUpdate
  });

  const [arrowsLeft, setArrowsLeft] = useState(12);
  const [stage, setStage] = useState(1);
  const [combo, setCombo] = useState(1);
  const [windSpeed, setWindSpeed] = useState(0);
  const [drawPct, setDrawPct] = useState(0);
  const [camMode, setCamMode] = useState<ArcheryCamMode>('archer');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [hitBanner, setHitBanner] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const camModeRef = useRef<ArcheryCamMode>('archer');
  const arrowsLeftRef = useRef(12);
  const stageRef = useRef(1);
  const comboRef = useRef(1);
  const lastDrawPctRef = useRef(0);
  const bannerTimerRef = useRef<number | null>(null);

  const rangeStateRef = useRef({
    aimYaw: 0,
    aimPitch: 0.04,
    isDrawing: false,
    drawTension: 0,
    windX: 0,
    targetX: 0,
    targetY: 2.2,
    targetZ: -22,
    targetRadius: 1.65,
    orbX: -3.2,
    orbY: 3.1,
    orbZ: -18,
    orbActive: true,
    fireRequested: false,
    resetRequested: true
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
    setHitBanner(msg);
    if (bannerTimerRef.current !== null) {
      clearTimeout(bannerTimerRef.current);
    }
    bannerTimerRef.current = window.setTimeout(() => {
      setHitBanner(null);
      bannerTimerRef.current = null;
    }, 1300);
  }, []);

  const randomizeWind = useCallback((lvl: number) => {
    const maxWind = Math.min(4.5, 0.8 + (lvl - 1) * 0.65);
    const w = Number(((Math.random() - 0.5) * 2 * maxWind).toFixed(1));
    rangeStateRef.current.windX = w;
    setWindSpeed(w);
  }, []);

  const startGame = useCallback(() => {
    updateScore(0);
    arrowsLeftRef.current = 12;
    setArrowsLeft(12);
    stageRef.current = 1;
    setStage(1);
    comboRef.current = 1;
    setCombo(1);
    lastDrawPctRef.current = 0;
    setDrawPct(0);

    rangeStateRef.current = {
      aimYaw: 0,
      aimPitch: 0.04,
      isDrawing: false,
      drawTension: 0,
      windX: 0,
      targetX: 0,
      targetY: 2.2,
      targetZ: -22,
      targetRadius: 1.65,
      orbX: -3.2,
      orbY: 3.1,
      orbZ: -18,
      orbActive: true,
      fireRequested: false,
      resetRequested: true
    };
    randomizeWind(1);

    startWithCountdown(() => {
      audio.playClick();
    });
  }, [randomizeWind, startWithCountdown, updateScore]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameStateRef.current !== 'playing' || arrowsLeftRef.current <= 0) return;
    rangeStateRef.current.isDrawing = true;
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gameStateRef.current !== 'playing') return;
    const mount = canvasMountRef.current;
    if (!mount) return;
    const rect = mount.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    rangeStateRef.current.aimYaw = THREE.MathUtils.clamp(-nx * 0.35, -0.42, 0.42);
    rangeStateRef.current.aimPitch = THREE.MathUtils.clamp(ny * 0.25 + 0.05, -0.15, 0.35);
  };

  const releaseArrow = useCallback(() => {
    const st = rangeStateRef.current;
    if (!st.isDrawing) return;
    st.isDrawing = false;
    if (st.drawTension > 0.25 && arrowsLeftRef.current > 0) {
      st.fireRequested = true;
    } else {
      st.drawTension = 0;
      lastDrawPctRef.current = 0;
      setDrawPct(0);
    }
  }, []);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        setCamMode((prev) => (prev === 'archer' ? 'arrow' : prev === 'arrow' ? 'side' : 'archer'));
        return;
      }
      if (gameStateRef.current !== 'playing') return;
      if (e.code === 'Space' && !rangeStateRef.current.isDrawing && arrowsLeftRef.current > 0) {
        e.preventDefault();
        rangeStateRef.current.isDrawing = true;
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        rangeStateRef.current.aimYaw = Math.min(0.42, rangeStateRef.current.aimYaw + 0.03);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        rangeStateRef.current.aimYaw = Math.max(-0.42, rangeStateRef.current.aimYaw - 0.03);
      } else if (e.key === 'ArrowUp' || e.key === 'w') {
        rangeStateRef.current.aimPitch = Math.min(0.35, rangeStateRef.current.aimPitch + 0.025);
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        rangeStateRef.current.aimPitch = Math.max(-0.15, rangeStateRef.current.aimPitch - 0.025);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        releaseArrow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStateRef, releaseArrow]);

  // Isolated Three.js 3D Archery Range
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
    scene.background = new THREE.Color(0x060a14);
    scene.fog = new THREE.FogExp2(0x060a14, 0.018);

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 140);
    camera.position.set(0, 2.1, 3.2);

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
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x090d16, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.65);
    keyLight.position.set(6, 15, 8);
    keyLight.castShadow = !isSoftwareGl;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.85);
    rimLight.position.set(-8, 8, -20);
    scene.add(rimLight);

    // Range Floor & Distance Gates
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 60),
      new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.5, metalness: 0.3 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.z = -24;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    const archMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35,
      metalness: 0.7,
      roughness: 0.25
    });
    for (let z = -8; z >= -38; z -= 10) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.12, 8, 32, Math.PI), archMat);
      arch.position.set(0, 0, z);
      scene.add(arch);
    }

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const targetTex = createTargetFaceTexture(maxAniso);

    // Composite 3D Target Assembly
    const targetGroup = new THREE.Group();
    const boardDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.65, 1.65, 0.22, 36),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 })
    );
    boardDisc.rotation.x = Math.PI / 2;
    targetGroup.add(boardDisc);

    const faceDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1.62, 36),
      new THREE.MeshStandardMaterial({ map: targetTex, roughness: 0.3, metalness: 0.1 })
    );
    faceDisc.position.z = 0.12;
    targetGroup.add(faceDisc);

    const rimTorus = new THREE.Mesh(
      new THREE.TorusGeometry(1.66, 0.06, 12, 36),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    );
    targetGroup.add(rimTorus);
    targetGroup.position.set(0, 2.2, -22);
    scene.add(targetGroup);

    // Bonus Quiver Orb (+2 Arrows)
    const bonusOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.9,
        roughness: 0.15
      })
    );
    scene.add(bonusOrb);

    // Compound Bow in Foreground
    const bow = buildCompoundBow();
    bow.group.position.set(0.42, 1.75, 1.8);
    scene.add(bow.group);

    const activeArrows: FlyingArrow3D[] = [];
    const stuckArrows: THREE.Group[] = [];

    const clearArrows = () => {
      activeArrows.forEach((a) => scene.remove(a.mesh));
      activeArrows.length = 0;
      stuckArrows.forEach((sa) => targetGroup.remove(sa));
      stuckArrows.length = 0;
    };

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
    let swRenderAcc = 0;
    let drawHudAcc = 0;
    let hasRenderedInitial = false;

    startLoop((_timestamp, deltaTimeMs) => {
      const delta = Math.min(deltaTimeMs / 1000, 0.05);
      elapsed += delta;
      const st = rangeStateRef.current;

      if (st.resetRequested) {
        clearArrows();
        st.resetRequested = false;
      }

      if (gameStateRef.current === 'playing') {
        // Move target laterally based on stage
        const swayAmp = Math.min(4.2, (stageRef.current - 1) * 1.15);
        const swaySpeed = 0.9 + stageRef.current * 0.22;
        st.targetX = Math.sin(elapsed * swaySpeed) * swayAmp;
        st.targetY = 2.3 + Math.cos(elapsed * swaySpeed * 0.7) * Math.min(1.1, (stageRef.current - 1) * 0.3);
        st.targetZ = -20 - Math.min(12, (stageRef.current - 1) * 2.5);
        targetGroup.position.set(st.targetX, st.targetY, st.targetZ);

        // Move Bonus Quiver Orb
        bonusOrb.visible = st.orbActive;
        if (st.orbActive) {
          st.orbX = Math.cos(elapsed * 1.4) * 3.6;
          st.orbY = 3.2 + Math.sin(elapsed * 2.1) * 0.6;
          bonusOrb.position.set(st.orbX, st.orbY, st.orbZ);
          bonusOrb.rotation.y = elapsed * 2.5;
        }

        // Handle Bow Draw Tension (throttled HUD updates ~15Hz)
        if (st.isDrawing) {
          st.drawTension = Math.min(1, st.drawTension + delta * 1.35);
          drawHudAcc += delta;
          if (drawHudAcc >= 0.065) {
            drawHudAcc = 0;
            const nextPct = Math.round(st.drawTension * 100);
            if (nextPct !== lastDrawPctRef.current) {
              lastDrawPctRef.current = nextPct;
              setDrawPct(nextPct);
            }
          }
        }

        bow.group.rotation.y = st.aimYaw;
        bow.group.rotation.x = st.aimPitch;
        bow.nockedArrow.visible = arrowsLeftRef.current > 0;
        bow.nockedArrow.position.z = st.drawTension * 0.42;

        // Fire Arrow if requested
        if (st.fireRequested) {
          st.fireRequested = false;
          const speed = 26 + st.drawTension * 24;
          st.drawTension = 0;
          lastDrawPctRef.current = 0;
          setDrawPct(0);

          arrowsLeftRef.current = Math.max(0, arrowsLeftRef.current - 1);
          setArrowsLeft(arrowsLeftRef.current);
          audio.playLaser();

          const arrowMesh = buildArrowMesh();
          const startPos = new THREE.Vector3(0.35, 1.82, 1.5);
          arrowMesh.position.copy(startPos);

          const dir = new THREE.Vector3(0, 0, -1)
            .applyEuler(new THREE.Euler(st.aimPitch, st.aimYaw, 0, 'YXZ'))
            .normalize();

          scene.add(arrowMesh);
          activeArrows.push({
            mesh: arrowMesh,
            pos: startPos,
            vel: dir.multiplyScalar(speed),
            active: true,
            life: 3.5
          });
        }

        // Update Flying Arrows
        for (let i = activeArrows.length - 1; i >= 0; i--) {
          const arr = activeArrows[i];
          if (!arr.active) continue;

          const prevZ = arr.pos.z;
          // Apply Gravity and Wind Drift
          arr.vel.y -= 9.8 * delta;
          arr.vel.x += st.windX * 0.85 * delta;

          arr.pos.addScaledVector(arr.vel, delta);
          arr.mesh.position.copy(arr.pos);

          // Orient arrow along velocity vector
          const lookTarget = arr.pos.clone().add(arr.vel);
          arr.mesh.lookAt(lookTarget);

          // Check Bonus Quiver Orb Collision
          if (st.orbActive && arr.pos.distanceTo(bonusOrb.position) < 0.65) {
            st.orbActive = false;
            arrowsLeftRef.current += 2;
            setArrowsLeft(arrowsLeftRef.current);
            addScore(75);
            audio.playCoin();
            showBanner('QUIVER ORB! +2 ANAK PANAH & +75');
          }

          // Check Target Plane Crossing
          if (prevZ >= st.targetZ + 0.12 && arr.pos.z <= st.targetZ + 0.12) {
            const dx = arr.pos.x - st.targetX;
            const dy = arr.pos.y - st.targetY;
            const distFromCenter = Math.hypot(dx, dy);

            if (distFromCenter <= st.targetRadius) {
              arr.active = false;
              scene.remove(arr.mesh);

              // Attach arrow to moving target board
              const stuck = buildArrowMesh();
              stuck.position.set(dx, dy, 0.35);
              targetGroup.add(stuck);
              stuckArrows.push(stuck);

              // Score by ring radius
              let basePts = 15;
              let ringName = 'OUTER RING';
              if (distFromCenter <= 0.32) {
                basePts = 100;
                ringName = 'BULLSEYE!';
                comboRef.current = Math.min(8, comboRef.current + 1);
                screenShake.trigger('medium');
                audio.playLevelUp();
              } else if (distFromCenter <= 0.68) {
                basePts = 60;
                ringName = 'INNER RED!';
                comboRef.current = Math.min(8, comboRef.current + 1);
                audio.playScore();
              } else if (distFromCenter <= 1.05) {
                basePts = 35;
                ringName = 'CYAN RING';
                audio.playScore();
              } else {
                comboRef.current = 1;
                audio.playHit();
              }

              setCombo(comboRef.current);
              const totalPts = basePts * comboRef.current;
              addScore(totalPts);
              showBanner(`${ringName} +${totalPts} (x${comboRef.current})`);

              // Advance stage every 350 points
              const nextStage = Math.floor((scoreRef.current + totalPts) / 350) + 1;
              if (nextStage > stageRef.current) {
                stageRef.current = nextStage;
                setStage(nextStage);
                st.orbActive = true;
              }
              randomizeWind(stageRef.current);

              activeArrows.splice(i, 1);
              continue;
            }
          }

          arr.life -= delta;
          if (arr.life <= 0 || arr.pos.y < -1 || arr.pos.z < -48) {
            // Missed shot resets combo
            comboRef.current = 1;
            setCombo(1);
            scene.remove(arr.mesh);
            activeArrows.splice(i, 1);
          }
        }

        // Check Out of Arrows Game Over
        if (arrowsLeftRef.current <= 0 && activeArrows.length === 0) {
          triggerGameOver(scoreRef.current);
        }
      }

      // Camera Choreography
      const mode = camModeRef.current;
      const latestArrow = activeArrows[activeArrows.length - 1];

      if (mode === 'arrow' && latestArrow) {
        _camPos.set(latestArrow.pos.x, latestArrow.pos.y + 0.45, latestArrow.pos.z + 2.4);
        _camLook.copy(latestArrow.pos);
      } else if (mode === 'side') {
        _camPos.set(7.5, 3.2, -9);
        _camLook.set(0, 2.2, -16);
      } else {
        const zoomOffset = st.isDrawing ? -0.65 : 0;
        _camPos.set(-st.aimYaw * 1.2, 2.05 + st.aimPitch * 0.8, 3.2 + zoomOffset);
        _camLook.set(-st.aimYaw * 16, 2.2 + st.aimPitch * 16, st.targetZ);
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
      targetTex.dispose();
      clearArrows();
      disposeThreeScene(scene, renderer);
    };
  }, [addScore, gameStateRef, randomizeWind, scoreRef, showBanner, startLoop, stopLoop, triggerGameOver]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releaseArrow}
      onPointerCancel={releaseArrow}
      className="relative w-full h-full min-h-[480px] flex flex-col items-center justify-center bg-[#060a14] overflow-hidden select-none cursor-crosshair touch-none"
    >
      {/* Dedicated WebGL Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Center Aim Reticle */}
      {gameState === 'playing' && (
        <div className="pointer-events-none z-10 flex items-center justify-center opacity-70">
          <Crosshair className="w-7 h-7 text-cyan-400" />
        </div>
      )}

      {/* Top HUD */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-3 bg-slate-950/90 border border-white/10 px-3.5 py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className={arrowsLeft <= 3 ? 'text-red-400 font-bold' : 'text-cyan-400 font-semibold'}>
            <Target className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            PANAH {arrowsLeft}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-200 flex items-center gap-1">
            <Wind className="w-3.5 h-3.5 text-sky-400" />
            {windSpeed > 0 ? `→ ${windSpeed}` : windSpeed < 0 ? `← ${Math.abs(windSpeed)}` : '0.0'} m/s
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-amber-400 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            x{combo}
          </span>
        </div>

        <div className="bg-slate-950/90 border border-white/10 px-4 py-2 rounded-xl text-xs font-mono tabular-nums">
          <span className="text-slate-400 mr-2">STAGE {stage} · SKOR</span>
          <span className="text-white font-bold text-base">{score.toLocaleString()}</span>
        </div>
      </div>

      {/* Hit Notification Toast */}
      {hitBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-950/95 border border-amber-400/40 px-4 py-1.5 rounded-lg text-xs font-mono font-bold text-amber-300 tracking-wide shadow-lg">
          {hitBanner}
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
            {(['archer', 'arrow', 'side'] as ArcheryCamMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setCamMode(m)}
                className={`px-2.5 py-1 rounded-md font-medium capitalize transition-colors whitespace-nowrap ${
                  camMode === m
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span className="text-slate-400">TARIKAN BUSUR</span>
            <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-500"
                style={{ width: `${drawPct}%` }}
              />
            </div>
            <span className="text-white w-9 text-right tabular-nums">{drawPct}%</span>
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
        gameTitle="ARCHERY NEO 3D"
        instructions="Tahan klik/sentuhan (atau SPASI) untuk menarik tali busur komposit 3D, perhatikan kecepatan angin & gravitasi, lalu lepaskan untuk membidik Bullseye!"
      />
    </div>
  );
}
