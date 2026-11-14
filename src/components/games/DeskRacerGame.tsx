import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { audioController, useGameEngine } from '../../sdk';
import { inputManager } from '../../services/inputService';
import {
  ThreeStageController,
  createWetAsphaltMaps,
  followDirectionalShadow
} from '../../utils/threeStage';
import { screenShake } from '../../utils/screenShake';
import {
  DeskPowerUpType,
  TRACK_CONTROL_POINTS,
  TRACK_HALF_WIDTH,
  buildFormulaRacerGroup,
  buildHazardMesh,
  buildInstancedTrackProps,
  buildPowerUpMesh,
  createCheckeredTexture,
  createTrackRoadTexture
} from './desk-racer/deskModels';
import {
  Flag,
  Gauge,
  RotateCcw,
  Eye,
  ChevronDown,
  ChevronUp,
  Ghost,
  Zap,
  Play,
  Shield,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

interface GameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (score: number) => void;
  highScore: number;
}

type CameraMode = 'chase' | 'hood' | 'overhead';

interface GhostSample {
  timeMs: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

interface DeskPowerUpItem {
  id: string;
  type: DeskPowerUpType;
  mesh: THREE.Group;
  uPos: number;
  lateralOffset: number;
  active: boolean;
}

interface DeskHazardItem {
  id: string;
  type: 'coffee' | 'eraser' | 'pen';
  mesh: THREE.Group;
  uPos: number;
  lateralOffset: number;
  active: boolean;
}

const GHOST_STORAGE_KEY = 'zigame_desk_racer_best_ghost_v1';
const TOTAL_LAPS = 3;

const _pt = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _hoodOffset = new THREE.Vector3(0, 0.82, 0);
const _overheadOffset = new THREE.Vector3(0, 14, 6);
const _chaseOffset = new THREE.Vector3(0, 1.85, 0);
const _lampOffset = new THREE.Vector3(10, 20, 11);

export default function DeskRacerGame({ onScoreUpdate, onGameOver, highScore }: GameProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const {
    score,
    updateScore,
    triggerGameOver,
    setGameState,
    gameStateRef
  } = useGameEngine({
    gameId: 'desk-racer',
    onScoreUpdate,
    onGameOver
  });

  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [lap, setLap] = useState<number>(1);
  const [speedKmh, setSpeedKmh] = useState<number>(0);
  const [boostPct, setBoostPct] = useState<number>(100);
  const [currentLapMs, setCurrentLapMs] = useState<number>(0);
  const [bestLapMs, setBestLapMs] = useState<number | null>(null);
  const [ghostEnabled, setGhostEnabled] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [raceFinished, setRaceFinished] = useState<{
    totalTimeMs: number;
    bestLapMs: number;
    finalScore: number;
  } | null>(null);
  const [playerMinimapPt, setPlayerMinimapPt] = useState<{ x: number; y: number }>({ x: 0, y: 12 });
  const [ghostMinimapPt, setGhostMinimapPt] = useState<{ x: number; y: number } | null>(null);

  const [hasShield, setHasShield] = useState<boolean>(false);
  const [hasMagnet, setHasMagnet] = useState<boolean>(false);
  const [comboMultiplier, setComboMultiplier] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cameraModeRef = useRef<CameraMode>('chase');
  const ghostEnabledRef = useRef<boolean>(true);
  const keysRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean; boost: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
    boost: false
  });

  const resetRaceFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    ghostEnabledRef.current = ghostEnabled;
  }, [ghostEnabled]);

  useEffect(() => {
    setGameState('playing');
  }, [setGameState]);

  const formatRaceTime = (ms: number) => {
    const totalSec = ms / 1000;
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${mins}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  };

  const handleRestartRace = useCallback(() => {
    resetRaceFnRef.current?.();
    audioController.playClick();
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container,
        backgroundColor: 0x14161d,
        fogColor: 0x14161d,
        fogDensity: 0.011,
        fov: 58,
        near: 0.1,
        far: 160,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 16,
        toneMappingExposure: 1.12,
        bloom: {
          enabled: true,
          strength: 0.44,
          radius: 0.35,
          threshold: 0.85
        }
      });
    } catch {
      return;
    }

    const { scene, camera, renderer, isSoftwareGl } = stage;
    camera.position.set(0, 2.4, 16.5);

    // Studio Desk Lighting + RGB Keyboard Backlight
    stage.hemiLight.color.setHex(0xe2e8f0);
    stage.hemiLight.groundColor.setHex(0x1e1b4b);
    stage.hemiLight.intensity = 0.72;

    // Desk Lamp Key Light (dynamically tracks player car via followDirectionalShadow)
    stage.keyLight.color.setHex(0xfff7ed);
    stage.keyLight.intensity = 1.95;
    stage.keyLight.position.copy(_lampOffset);
    stage.keyLight.shadow.camera.near = 2;
    stage.keyLight.shadow.camera.far = 60;

    stage.rimLight.color.setHex(0x818cf8);
    stage.rimLight.intensity = 0.65;

    const rgbGlowLight = new THREE.PointLight(0x38bdf8, 6.8, 28, 1.5);
    rgbGlowLight.position.set(8.5, 2.5, 0);
    scene.add(rgbGlowLight);

    // Giant Workspace Desk Mat Surface with subtle PBR specular breakup
    const deskMaps = createWetAsphaltMaps(renderer, {
      baseColor: '#222631',
      puddleIntensity: 0.35,
      repeatX: 6,
      repeatY: 6
    });
    const deskMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      new THREE.MeshStandardMaterial({
        map: deskMaps.map,
        roughnessMap: deskMaps.roughnessMap,
        bumpMap: deskMaps.bumpMap,
        bumpScale: 0.02,
        roughness: 0.78,
        metalness: 0.16
      })
    );
    deskMesh.rotation.x = -Math.PI / 2;
    deskMesh.position.y = -0.05;
    deskMesh.receiveShadow = true;
    scene.add(deskMesh);

    // Giant RGB Mechanical Keyboard Prop (RoundedBoxGeometry + InstancedMesh keycaps)
    const keyboardGroup = new THREE.Group();
    keyboardGroup.position.set(8.2, 0, 0);
    const kbBody = new THREE.Mesh(
      new RoundedBoxGeometry(7.2, 0.55, 19.5, 2, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.38, metalness: 0.62 })
    );
    kbBody.position.y = 0.27;
    kbBody.receiveShadow = true;
    kbBody.castShadow = !isSoftwareGl;
    keyboardGroup.add(kbBody);

    const rgbStrip = new THREE.Mesh(
      new RoundedBoxGeometry(0.14, 0.22, 19.2, 2, 0.04),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: 0x38bdf8,
        emissiveIntensity: 2.0,
        roughness: 0.2
      })
    );
    rgbStrip.position.set(-3.62, 0.22, 0);
    keyboardGroup.add(rgbStrip);

    const rows = 6;
    const cols = 16;
    const keycapGeo = new RoundedBoxGeometry(0.78, 0.35, 0.92, 2, 0.08);
    const keycapMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.28,
      emissive: 0x0284c7,
      emissiveIntensity: 0.65
    });
    const keycapsInstanced = new THREE.InstancedMesh(keycapGeo, keycapMat, rows * cols);
    const dummy = new THREE.Object3D();
    const keyColor = new THREE.Color();
    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dummy.position.set(-2.6 + r * 1.02, 0.68, -8.5 + c * 1.12);
        dummy.updateMatrix();
        keycapsInstanced.setMatrixAt(idx, dummy.matrix);
        keyColor.setHSL(0.55 + (c / cols) * 0.22, 0.88, 0.52);
        keycapsInstanced.setColorAt(idx, keyColor);
        idx++;
      }
    }
    keycapsInstanced.instanceMatrix.needsUpdate = true;
    if (keycapsInstanced.instanceColor) keycapsInstanced.instanceColor.needsUpdate = true;
    keycapsInstanced.computeBoundingSphere();
    keyboardGroup.add(keycapsInstanced);
    scene.add(keyboardGroup);

    // Giant Coffee Mug Prop
    const mugGroup = new THREE.Group();
    mugGroup.position.set(-9.5, 0, -9);
    const mugCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.0, 4.6, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xf97316, roughness: 0.18, clearcoat: 0.85 })
    );
    mugCylinder.position.y = 2.3;
    mugCylinder.castShadow = !isSoftwareGl;
    mugGroup.add(mugCylinder);
    scene.add(mugGroup);

    // Procedural Ribbon Coaster Track Geometry
    const curvePoints = TRACK_CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const trackCurve = new THREE.CatmullRomCurve3(curvePoints, true, 'catmullrom', 0.5);

    const segments = 320;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const pt = trackCurve.getPointAt(u);
      const tan = trackCurve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();

      const leftPt = pt.clone().addScaledVector(right, -TRACK_HALF_WIDTH);
      const rightPt = pt.clone().addScaledVector(right, TRACK_HALF_WIDTH);

      positions.push(leftPt.x, leftPt.y + 0.03, leftPt.z);
      positions.push(rightPt.x, rightPt.y + 0.03, rightPt.z);

      uvs.push(0, u);
      uvs.push(1, u);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const roadTex = createTrackRoadTexture(maxAniso);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughnessMap: deskMaps.roughnessMap,
      bumpMap: deskMaps.bumpMap,
      bumpScale: 0.015,
      roughness: 0.68,
      metalness: 0.14,
      side: THREE.DoubleSide
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    const trackProps = buildInstancedTrackProps(scene, trackCurve, isSoftwareGl);

    // Start / Finish Checkered Gantry Truss
    const startPt = trackCurve.getPointAt(0);
    const gantryGroup = new THREE.Group();
    gantryGroup.position.copy(startPt);

    const trussMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.8 });
    const leftPillar = new THREE.Mesh(new RoundedBoxGeometry(0.32, 3.6, 0.32, 2, 0.04), trussMat);
    leftPillar.position.set(-TRACK_HALF_WIDTH - 0.15, 1.8, 0);
    const rightPillar = leftPillar.clone();
    rightPillar.position.x = TRACK_HALF_WIDTH + 0.15;
    const topBeam = new THREE.Mesh(new RoundedBoxGeometry(TRACK_HALF_WIDTH * 2 + 0.8, 0.38, 0.38, 2, 0.05), trussMat);
    topBeam.position.set(0, 3.5, 0);

    const checkerTex = createCheckeredTexture(maxAniso);
    const bannerMat = new THREE.MeshBasicMaterial({ map: checkerTex, side: THREE.DoubleSide });
    const bannerMesh = new THREE.Mesh(new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 2, 0.85), bannerMat);
    bannerMesh.position.set(0, 3.0, 0);

    const finishLineDecal = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_HALF_WIDTH * 1.9, 0.9),
      new THREE.MeshBasicMaterial({
        map: checkerTex,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      })
    );
    finishLineDecal.rotation.x = -Math.PI / 2;
    finishLineDecal.position.set(0, 0.05, 0);

    gantryGroup.add(leftPillar, rightPillar, topBeam, bannerMesh, finishLineDecal);
    scene.add(gantryGroup);

    // Player Formula Car & Ghost Replay Car
    const { group: playerCar, shieldBubble, flameL, flameR, wheels } = buildFormulaRacerGroup(false);
    scene.add(playerCar);

    const { group: ghostCar } = buildFormulaRacerGroup(true);
    ghostCar.visible = false;
    scene.add(ghostCar);

    // Interactive Power-Ups & Desk Hazards along Spline
    const powerUps: DeskPowerUpItem[] = [];
    const pTypes: DeskPowerUpType[] = ['nitro', 'shield', 'magnet', 'eraser'];
    const pSplineOffsets = [0.15, 0.35, 0.55, 0.75, 0.9];

    pSplineOffsets.forEach((u, i) => {
      const type = pTypes[i % pTypes.length];
      const pMesh = buildPowerUpMesh(type);
      const lat = (Math.random() - 0.5) * (TRACK_HALF_WIDTH * 1.2);

      const ptOnTrack = trackCurve.getPointAt(u);
      const tan = trackCurve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();

      pMesh.position.copy(ptOnTrack).addScaledVector(right, lat);
      pMesh.position.y += 0.45;
      scene.add(pMesh);

      powerUps.push({
        id: `p_${i}`,
        type,
        mesh: pMesh,
        uPos: u,
        lateralOffset: lat,
        active: true
      });
    });

    const hazards: DeskHazardItem[] = [];
    const hTypes: ('coffee' | 'eraser' | 'pen')[] = ['coffee', 'eraser', 'pen'];
    const hSplineOffsets = [0.1, 0.28, 0.48, 0.68, 0.84];

    hSplineOffsets.forEach((u, i) => {
      const type = hTypes[i % hTypes.length];
      const hMesh = buildHazardMesh(type);
      const lat = (Math.random() - 0.5) * (TRACK_HALF_WIDTH * 1.4);

      const ptOnTrack = trackCurve.getPointAt(u);
      const tan = trackCurve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(tan, _up).normalize();

      hMesh.position.copy(ptOnTrack).addScaledVector(right, lat);
      scene.add(hMesh);

      hazards.push({
        id: `h_${i}`,
        type,
        mesh: hMesh,
        uPos: u,
        lateralOffset: lat,
        active: true
      });
    });

    let bestGhostFrames: GhostSample[] = [];
    try {
      const raw = localStorage.getItem(GHOST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.frames)) {
          bestGhostFrames = parsed.frames;
          if (typeof parsed.lapMs === 'number') {
            setBestLapMs(parsed.lapMs);
          }
        }
      }
    } catch {
      // ignore storage errors
    }

    const trackLength = trackCurve.getLength();
    let uPos = 0.002;
    let lateralOffset = 0;
    let speed = 0;
    let steerInput = 0;
    let boostEnergy = 100;
    let currentLap = 1;
    let passedHalfway = false;
    let lapStartMs = performance.now();
    let raceStartMs = performance.now();
    let currentLapFrames: GhostSample[] = [];
    let bestLapRecordMs = Infinity;
    let totalScoreAccum = 0;
    let finished = false;
    let hudThrottleTimer = 0;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;

    let shieldActive = false;
    let magnetActive = false;
    let magnetTimer = 0;
    let comboMultiplierVal = 1;
    let comboDecayTimer = 0;

    const triggerToast = (msg: string, ms = 1600) => {
      setToastMessage(msg);
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => setToastMessage(null), ms);
    };

    const resetRaceState = () => {
      uPos = 0.002;
      lateralOffset = 0;
      speed = 0;
      steerInput = 0;
      boostEnergy = 100;
      currentLap = 1;
      passedHalfway = false;
      const now = performance.now();
      lapStartMs = now;
      raceStartMs = now;
      currentLapFrames = [];
      totalScoreAccum = 0;
      finished = false;
      shieldActive = false;
      magnetActive = false;
      magnetTimer = 0;
      comboMultiplierVal = 1;
      comboDecayTimer = 0;

      powerUps.forEach((p) => {
        p.active = true;
        p.mesh.visible = true;
      });
      hazards.forEach((h) => {
        h.active = true;
        h.mesh.visible = true;
      });

      setLap(1);
      setSpeedKmh(0);
      setBoostPct(100);
      setCurrentLapMs(0);
      setHasShield(false);
      setHasMagnet(false);
      setComboMultiplier(1);
      setRaceFinished(null);
      updateScore(0);
      setGameState('playing');
    };
    resetRaceFnRef.current = resetRaceState;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') resetRaceState();
      if (e.code === 'KeyH') setDockCollapsed((p) => !p);
    };

    const unsubInput = inputManager.subscribe({
      onActionDown: (action) => {
        if (action === 'UP') keysRef.current.up = true;
        else if (action === 'DOWN') keysRef.current.down = true;
        else if (action === 'LEFT') keysRef.current.left = true;
        else if (action === 'RIGHT') keysRef.current.right = true;
        else if (
          action === 'PRIMARY' ||
          action === 'ACTION_PRIMARY' ||
          action === 'SECONDARY' ||
          action === 'ACTION_SECONDARY'
        ) {
          keysRef.current.boost = true;
        } else if (action === 'RESTART') {
          resetRaceState();
        }
      },
      onActionUp: (action) => {
        if (action === 'UP') keysRef.current.up = false;
        else if (action === 'DOWN') keysRef.current.down = false;
        else if (action === 'LEFT') keysRef.current.left = false;
        else if (action === 'RIGHT') keysRef.current.right = false;
        else if (
          action === 'PRIMARY' ||
          action === 'ACTION_PRIMARY' ||
          action === 'SECONDARY' ||
          action === 'ACTION_SECONDARY'
        ) {
          keysRef.current.boost = false;
        }
      }
    });

    window.addEventListener('keydown', onKeyDown);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    stage.startLoop((rawDt, elapsedTotal) => {
      const dt = Math.min(rawDt, 0.05);
      const now = performance.now();
      const isPlaying = (gameStateRef.current as string)?.toLowerCase() === 'playing';

      // Subtle RGB desk pulse
      rgbGlowLight.color.setHSL(0.55 + Math.sin(elapsedTotal * 0.6) * 0.08, 0.9, 0.58);

      if (isPlaying) {
        powerUps.forEach((p) => {
          if (p.active) {
            p.mesh.rotation.y = elapsedTotal * 2.5;
          }
        });
      }

      if (!finished && isPlaying) {
        const k = keysRef.current;
        const isBoosting = k.boost && boostEnergy > 5 && k.up;
        const maxSpeed = isBoosting ? 32 : 22;
        const accel = isBoosting ? 26 : 15;

        if (isBoosting) {
          flameL.visible = true;
          flameR.visible = true;
          flameL.scale.setScalar(0.8 + Math.sin(elapsedTotal * 35) * 0.25);
          flameR.scale.setScalar(0.8 + Math.sin(elapsedTotal * 35) * 0.25);
        } else {
          flameL.visible = false;
          flameR.visible = false;
        }

        if (k.up) {
          speed = Math.min(maxSpeed, speed + accel * dt);
        } else if (k.down) {
          speed = Math.max(-8, speed - 20 * dt);
        } else {
          speed = THREE.MathUtils.damp(speed, 0, 2.5, dt);
        }

        if (isBoosting) {
          boostEnergy = Math.max(0, boostEnergy - 32 * dt);
        } else {
          boostEnergy = Math.min(100, boostEnergy + 14 * dt);
        }

        const targetSteer = (k.left ? -1 : 0) + (k.right ? 1 : 0);
        steerInput = THREE.MathUtils.damp(steerInput, targetSteer, 10, dt);

        if (Math.abs(speed) > 0.4) {
          lateralOffset += steerInput * (speed / 18) * 3.8 * dt;
        }

        const maxLat = TRACK_HALF_WIDTH - 0.55;
        if (Math.abs(lateralOffset) > maxLat) {
          lateralOffset = Math.sign(lateralOffset) * maxLat;
          speed *= 0.88;
          screenShake.trigger('subtle');
          stage.cameraRig.addTrauma(0.22);
        }

        const prevU = uPos;
        uPos = (uPos + (speed * dt) / trackLength + 1) % 1;

        if (uPos > 0.45 && uPos < 0.65) {
          passedHalfway = true;
        }

        if (magnetActive) {
          magnetTimer -= dt;
          if (magnetTimer <= 0) {
            magnetActive = false;
            setHasMagnet(false);
          }
        }

        if (comboMultiplierVal > 1) {
          comboDecayTimer -= dt;
          if (comboDecayTimer <= 0) {
            comboMultiplierVal = 1;
            setComboMultiplier(1);
          }
        }

        powerUps.forEach((p) => {
          if (!p.active) return;
          const uDist = Math.abs(uPos - p.uPos);
          const latDist = Math.abs(lateralOffset - p.lateralOffset);

          if (uDist < 0.02 || (magnetActive && uDist < 0.08)) {
            if (latDist < 1.2 || magnetActive) {
              p.active = false;
              p.mesh.visible = false;
              audioController.playPowerup();
              screenShake.trigger('medium');
              stage.particles.burst(p.mesh.position.x, p.mesh.position.y + 0.3, p.mesh.position.z, isSoftwareGl ? 8 : 20, 0x38bdf8, 6, 1.0, 8);

              comboMultiplierVal = Math.min(8, comboMultiplierVal * 2);
              comboDecayTimer = 5.0;
              setComboMultiplier(comboMultiplierVal);

              if (p.type === 'nitro') {
                boostEnergy = 100;
                stage.cameraRig.kickFov(6);
                triggerToast('NITRO REFILLED! +100% BOOST', 1800);
              } else if (p.type === 'shield') {
                shieldActive = true;
                shieldBubble.visible = true;
                setHasShield(true);
                triggerToast('DESK SHIELD ACTIVATED!', 1800);
              } else if (p.type === 'magnet') {
                magnetActive = true;
                magnetTimer = 8.0;
                setHasMagnet(true);
                triggerToast('COIN MAGNET ACTIVE (8s)!', 1800);
              } else if (p.type === 'eraser') {
                hazards.forEach((h) => {
                  h.active = false;
                  h.mesh.visible = false;
                });
                triggerToast('ERASER BOMB! ALL HAZARDS CLEARED', 1800);
              }
            }
          }
        });

        hazards.forEach((h) => {
          if (!h.active) return;
          const uDist = Math.abs(uPos - h.uPos);
          const latDist = Math.abs(lateralOffset - h.lateralOffset);

          if (uDist < 0.015 && latDist < 1.0) {
            if (shieldActive) {
              shieldActive = false;
              shieldBubble.visible = false;
              setHasShield(false);
              h.active = false;
              h.mesh.visible = false;
              audioController.playExplosion();
              screenShake.trigger('medium');
              stage.cameraRig.addTrauma(0.42);
              triggerToast('SHIELD ABSORBED IMPACT!', 1500);
            } else {
              audioController.playHit();
              screenShake.trigger('heavy');
              stage.cameraRig.addTrauma(0.62);
              stage.particles.burst(playerCar.position.x, playerCar.position.y + 0.4, playerCar.position.z, isSoftwareGl ? 8 : 22, 0xf43f5e, 6, 1.1, 10);
              speed *= 0.35;
              comboMultiplierVal = 1;
              setComboMultiplier(1);
              h.active = false;
              h.mesh.visible = false;
              triggerToast('SPIN OUT! HAZARD HIT', 1500);
            }
          }
        });

        const lapElapsed = now - lapStartMs;

        if (
          currentLapFrames.length === 0 ||
          lapElapsed - currentLapFrames[currentLapFrames.length - 1].timeMs >= 60
        ) {
          currentLapFrames.push({
            timeMs: Math.round(lapElapsed),
            x: playerCar.position.x,
            y: playerCar.position.y,
            z: playerCar.position.z,
            yaw: playerCar.rotation.y
          });
        }

        if (speed > 4) {
          totalScoreAccum += speed * dt * 1.8 * comboMultiplierVal;
        }

        if (passedHalfway && prevU > 0.85 && uPos < 0.15) {
          passedHalfway = false;
          audioController.playLevelUp();
          screenShake.trigger('medium');
          stage.cameraRig.kickFov(5);

          const completedLapMs = lapElapsed;
          const lapBonus = Math.max(400, Math.round(2200 - completedLapMs / 25)) * comboMultiplierVal;
          totalScoreAccum += lapBonus;

          if (completedLapMs < bestLapRecordMs) {
            bestLapRecordMs = completedLapMs;
            bestGhostFrames = [...currentLapFrames];
            setBestLapMs(Math.round(completedLapMs));
            try {
              localStorage.setItem(
                GHOST_STORAGE_KEY,
                JSON.stringify({ lapMs: Math.round(completedLapMs), frames: bestGhostFrames.slice(0, 400) })
              );
            } catch {
              // ignore quota errors
            }
          }

          if (currentLap >= TOTAL_LAPS) {
            finished = true;
            const finalScore = Math.round(totalScoreAccum);
            updateScore(finalScore);
            setRaceFinished({
              totalTimeMs: Math.round(now - raceStartMs),
              bestLapMs: Math.round(Math.min(bestLapRecordMs, completedLapMs)),
              finalScore
            });
            audioController.playWin();
            triggerGameOver(finalScore);
          } else {
            currentLap += 1;
            setLap(currentLap);
            lapStartMs = now;
            currentLapFrames = [];
          }
        }

        trackCurve.getPointAt(uPos, _pt);
        trackCurve.getTangentAt(uPos, _tangent).normalize();
        _right.crossVectors(_tangent, _up).normalize();

        playerCar.position.copy(_pt).addScaledVector(_right, lateralOffset);
        const headingYaw = Math.atan2(_tangent.x, _tangent.z);
        playerCar.rotation.y = headingYaw - steerInput * 0.22;

        wheels.forEach((w) => {
          w.rotation.x += speed * dt * 2.2;
        });

        // Keep directional shadow frustum tightly centered on the player car with texel snapping
        followDirectionalShadow(stage.keyLight, playerCar.position, 16, true, _lampOffset);

        if (ghostEnabledRef.current && bestGhostFrames.length > 1) {
          ghostCar.visible = true;
          let gIdx = 0;
          while (
            gIdx < bestGhostFrames.length - 1 &&
            bestGhostFrames[gIdx + 1].timeMs < lapElapsed
          ) {
            gIdx++;
          }
          const f0 = bestGhostFrames[gIdx];
          const f1 = bestGhostFrames[Math.min(gIdx + 1, bestGhostFrames.length - 1)];
          const span = Math.max(1, f1.timeMs - f0.timeMs);
          const alpha = THREE.MathUtils.clamp((lapElapsed - f0.timeMs) / span, 0, 1);

          ghostCar.position.set(
            THREE.MathUtils.lerp(f0.x, f1.x, alpha),
            THREE.MathUtils.lerp(f0.y, f1.y, alpha),
            THREE.MathUtils.lerp(f0.z, f1.z, alpha)
          );
          ghostCar.rotation.y = f0.yaw;
        } else {
          ghostCar.visible = false;
        }

        // Dynamic FOV Kick + Camera Mode Choreography + Trauma Shake
        const speedRatio = Math.max(0, speed / 32);
        stage.cameraRig.updateDynamicFov(camera, 58, speedRatio + (isBoosting ? 0.25 : 0), dt, 10);

        const cMode = cameraModeRef.current;
        if (cMode === 'hood') {
          _camDesired.copy(playerCar.position).add(_hoodOffset);
          _camLook.copy(playerCar.position).addScaledVector(_tangent, 8);
          camera.position.lerp(_camDesired, 0.45);
          stage.cameraRig.applyTraumaToCamera(camera, camera.position.clone(), dt, 0.28);
          camera.lookAt(_camLook);
        } else if (cMode === 'overhead') {
          _camDesired.copy(playerCar.position).add(_overheadOffset);
          camera.position.lerp(_camDesired, 0.15);
          stage.cameraRig.applyTraumaToCamera(camera, camera.position.clone(), dt, 0.3);
          camera.lookAt(playerCar.position);
        } else {
          _camDesired
            .copy(playerCar.position)
            .addScaledVector(_tangent, -4.2)
            .add(_chaseOffset);
          _camLook.copy(playerCar.position).addScaledVector(_tangent, 5.5);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camDesired.x, 8, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camDesired.y, 8, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camDesired.z, 8, dt);
          stage.cameraRig.applyTraumaToCamera(camera, camera.position.clone(), dt, 0.35);
          camera.lookAt(_camLook);
        }

        hudThrottleTimer += dt;
        if (hudThrottleTimer >= 0.08) {
          hudThrottleTimer = 0;
          const nextSpeedKmh = Math.round(Math.abs(speed) * 6.2);
          const nextBoostPct = Math.round(boostEnergy);
          const nextLapMs = Math.round(lapElapsed);
          const nextScore = Math.round(totalScoreAccum);
          setSpeedKmh((prev) => (prev === nextSpeedKmh ? prev : nextSpeedKmh));
          setBoostPct((prev) => (prev === nextBoostPct ? prev : nextBoostPct));
          setCurrentLapMs((prev) => (prev === nextLapMs ? prev : nextLapMs));
          updateScore(nextScore);
          const px = Math.round(playerCar.position.x * 10) / 10;
          const pz = Math.round(playerCar.position.z * 10) / 10;
          setPlayerMinimapPt((prev) => (prev.x === px && prev.y === pz ? prev : { x: px, y: pz }));
          if (ghostCar.visible) {
            const gx = Math.round(ghostCar.position.x * 10) / 10;
            const gz = Math.round(ghostCar.position.z * 10) / 10;
            setGhostMinimapPt((prev) => (prev && prev.x === gx && prev.y === gz ? prev : { x: gx, y: gz }));
          } else {
            setGhostMinimapPt((prev) => (prev === null ? prev : null));
          }
        }
      }
    });

    return () => {
      if (toastTimer) clearTimeout(toastTimer);
      unsubInput();
      window.removeEventListener('keydown', onKeyDown);
      deskMaps.dispose();
      roadTex.dispose();
      checkerTex.dispose();
      roadGeo.dispose();
      trackProps.dispose();
      stage.dispose();
    };
  }, [gameStateRef, setGameState, triggerGameOver, updateScore]);

  const minimapSvgPath =
    'M 0 12 L 0 -10 C -1 -18 -6 -24 -15 -24 C -22 -24 -25 -18 -24 -14 C -22 -6 -12 -2 -11 2 C -10 6 -16 14 -24 18 C -26 22 -23 28 -20 28 C -12 28 -2 24 0 20 Z';

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[500px] bg-[#14161d] overflow-hidden select-none touch-none">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Unified Top HUD Bar */}
      <div className="absolute top-2.5 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-zinc-950/90 border border-amber-500/30 text-white pointer-events-auto tabular-nums">
          <span className="text-xs sm:text-sm font-black italic tracking-wider text-amber-400 whitespace-nowrap">
            DESK RACER 3D
          </span>
          <span className="text-zinc-600" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold">
            <Flag className="w-3.5 h-3.5 text-red-400" />
            <span>LAP {lap}/{TOTAL_LAPS}</span>
          </div>
          <span className="text-zinc-600" aria-hidden="true">·</span>
          <div className="text-[11px] sm:text-xs">
            <span className="text-zinc-400 hidden sm:inline">Waktu: </span>
            <span className="font-mono font-bold text-cyan-300">{formatRaceTime(currentLapMs)}</span>
          </div>
          {bestLapMs !== null && (
            <>
              <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">·</span>
              <div className="text-xs hidden sm:block">
                <span className="text-zinc-400">Best: </span>
                <span className="font-mono font-bold text-emerald-400">{formatRaceTime(bestLapMs)}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-zinc-950/90 border border-white/10 text-[11px] sm:text-xs text-white pointer-events-auto tabular-nums">
          {comboMultiplier > 1 && (
            <div className="px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500 to-rose-500 text-zinc-950 font-black text-[11px] uppercase font-mono tracking-wider">
              {comboMultiplier}x COMBO
            </div>
          )}
          {hasShield && (
            <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs">
              <Shield className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">SHIELD</span>
            </div>
          )}
          {hasMagnet && (
            <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">MAGNET</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-red-400" />
            <span className="text-sm sm:text-base font-black font-mono text-white">{speedKmh}</span>
            <span className="text-[10px] text-zinc-400">KM/H</span>
          </div>
          <span className="text-zinc-600" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <div className="w-12 sm:w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-transform duration-75 origin-left"
                style={{ transform: `scaleX(${boostPct / 100})` }}
              />
            </div>
          </div>
          <span className="text-zinc-600" aria-hidden="true">·</span>
          <div>
            <span className="text-zinc-400">Skor: </span>
            <span className="font-bold text-amber-400">{score}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Toast Popup Notification */}
      {toastMessage && (
        <div className="absolute top-20 sm:top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-500 text-zinc-950 font-black text-xs tracking-wider uppercase shadow-2xl flex items-center gap-2 whitespace-nowrap">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Bottom-Left 2D Track Circuit Minimap (hidden on narrow mobile to avoid overlap) */}
      <div className="hidden sm:block absolute bottom-20 left-4 z-10 w-36 h-28 p-2 rounded-2xl bg-zinc-950/85 border border-white/15 pointer-events-none">
        <svg viewBox="-30 -30 36 64" className="w-full h-full overflow-visible">
          <path
            d={minimapSvgPath}
            fill="none"
            stroke="#334155"
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={minimapSvgPath}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="2.0"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {ghostMinimapPt && (
            <circle
              cx={ghostMinimapPt.x}
              cy={ghostMinimapPt.y}
              r="2.4"
              fill="#a855f7"
            />
          )}
          <circle
            cx={playerMinimapPt.x}
            cy={playerMinimapPt.y}
            r="3.0"
            fill="#38bdf8"
            stroke="#ffffff"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Mobile Touch Steering & Nitro Controls */}
      <div
        className={`md:hidden absolute ${dockCollapsed ? 'bottom-12' : 'bottom-28'} inset-x-3 z-10 flex items-center justify-between gap-2 pointer-events-auto touch-none transition-all`}
      >
        <div className="flex items-center gap-2">
          <button
            onPointerDown={(e) => { e.preventDefault(); keysRef.current.left = true; keysRef.current.up = true; }}
            onPointerUp={() => { keysRef.current.left = false; }}
            onPointerLeave={() => { keysRef.current.left = false; }}
            onPointerCancel={() => { keysRef.current.left = false; }}
            className="w-12 h-12 rounded-xl bg-zinc-900/90 border border-white/15 text-white font-bold text-sm active:bg-red-500 touch-none"
            aria-label="Belok Kiri"
          >
            ◀
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); keysRef.current.right = true; keysRef.current.up = true; }}
            onPointerUp={() => { keysRef.current.right = false; }}
            onPointerLeave={() => { keysRef.current.right = false; }}
            onPointerCancel={() => { keysRef.current.right = false; }}
            className="w-12 h-12 rounded-xl bg-zinc-900/90 border border-white/15 text-white font-bold text-sm active:bg-red-500 touch-none"
            aria-label="Belok Kanan"
          >
            ▶
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onPointerDown={(e) => { e.preventDefault(); keysRef.current.boost = true; keysRef.current.up = true; }}
            onPointerUp={() => { keysRef.current.boost = false; }}
            onPointerLeave={() => { keysRef.current.boost = false; }}
            onPointerCancel={() => { keysRef.current.boost = false; }}
            className="px-3.5 h-12 rounded-xl bg-cyan-600/90 border border-cyan-400/30 text-white font-bold text-xs active:bg-cyan-500 touch-none"
          >
            NITRO
          </button>
          <button
            onPointerDown={(e) => { e.preventDefault(); keysRef.current.up = true; }}
            onPointerUp={() => { keysRef.current.up = false; }}
            onPointerLeave={() => { keysRef.current.up = false; }}
            onPointerCancel={() => { keysRef.current.up = false; }}
            className="px-4 h-12 rounded-xl bg-red-600/90 border border-red-400/30 text-white font-bold text-xs active:bg-red-500 touch-none"
          >
            GAS
          </button>
        </div>
      </div>

      {/* Race Finished Modal */}
      {raceFinished && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4">
          <div className="max-w-md w-full rounded-2xl bg-zinc-900 border border-red-500/40 p-6 text-center shadow-2xl">
            <Flag className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Desk Racer 3D Selesai!</h3>
            <p className="text-sm text-zinc-400 mb-4">
              3 Putaran Sirkuit Meja berhasil ditaklukkan
            </p>
            <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-zinc-950 border border-white/10 mb-5 tabular-nums">
              <div>
                <div className="text-[11px] text-zinc-400">Total Waktu</div>
                <div className="text-sm font-bold font-mono text-white">
                  {formatRaceTime(raceFinished.totalTimeMs)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">Best Lap</div>
                <div className="text-sm font-bold font-mono text-emerald-400">
                  {formatRaceTime(raceFinished.bestLapMs)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-400">Skor Akhir</div>
                <div className="text-sm font-bold font-mono text-amber-400">
                  {raceFinished.finalScore}
                </div>
              </div>
            </div>
            <button
              onClick={handleRestartRace}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              Balapan Lagi
            </button>
          </div>
        </div>
      )}

      {/* Unified Collapsible Bottom Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-[min(860px,95vw)] flex flex-col items-center pointer-events-auto pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="mb-1 px-3 min-h-[36px] sm:min-h-0 py-1 rounded-t-lg bg-zinc-950/90 border border-b-0 border-white/15 text-[11px] font-medium text-zinc-300 hover:text-white flex items-center gap-1 whitespace-nowrap transition-colors"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Tampilkan Kontrol (H)
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Sembunyikan Kontrol (H)
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="w-full px-3 sm:px-4 py-2 rounded-2xl bg-zinc-950/95 border border-white/15 shadow-2xl flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            {/* Camera Switcher */}
            <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-white/5">
              <Eye className="w-3.5 h-3.5 text-zinc-400 ml-1.5 mr-1 shrink-0" />
              {(
                [
                  { id: 'chase', label: 'Chase' },
                  { id: 'hood', label: 'Kokpit' },
                  { id: 'overhead', label: 'Top' }
                ] as { id: CameraMode; label: string }[]
              ).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    audioController.playClick();
                    setCameraMode(c.id);
                  }}
                  className={`px-2.5 min-h-[44px] sm:min-h-0 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    cameraMode === c.id
                      ? 'bg-red-600 text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Controls Hint */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 whitespace-nowrap">
              <span>Kemudi: WASD / Panah</span>
              <span aria-hidden="true">·</span>
              <span>Nitro Boost: Spasi</span>
            </div>

            {/* Ghost & Reset Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  audioController.playClick();
                  setGhostEnabled((g) => !g);
                }}
                className={`px-3 min-h-[44px] sm:min-h-0 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  ghostEnabled
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-zinc-900 text-zinc-400 border-white/10'
                }`}
              >
                <Ghost className="w-3.5 h-3.5" />
                {ghostEnabled ? 'Ghost: On' : 'Ghost: Off'}
              </button>
              <button
                onClick={handleRestartRace}
                className="px-3 min-h-[44px] sm:min-h-0 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 border border-white/10 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Ulang
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
