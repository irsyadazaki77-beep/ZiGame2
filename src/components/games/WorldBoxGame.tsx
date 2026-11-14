import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GameComponentProps } from '../../types';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { ThreeDockOverlay } from '../gameplay/ThreeDockOverlay';
import { audioController } from '../../sdk/audioController';
import { screenShake } from '../../utils/screenShake';
import { haptics } from '../../utils/haptics';
import {
  CameraPreset3D,
  QualityLevel3D,
  ThreeStageController
} from '../../utils/threeStage';
import {
  DIVINE_ERA_CHALLENGES,
  GOD_POWERS_CATALOG,
  RACE_CONFIG
} from './world-box/constants';
import {
  HudSnapshot,
  SimSpeed,
  ToolCategory,
  ToolId,
  WorldLaws,
  WorldTemplate
} from './world-box/types';
import { WorldBoxEngine } from './world-box/worldEngine';
import { WorldBoxRenderer3D, tileToWorld3D, world3DToTile } from './world-box/worldRenderer3D';
import {
  Globe,
  Users,
  Trees,
  Flame,
  Eye,
  Pause,
  RotateCcw,
  Award,
  Crown,
  Shield,
  Sparkles,
  ScrollText,
  ZoomIn,
  ZoomOut,
  Compass,
  Save,
  Download,
  Skull,
  Crosshair,
  Paintbrush,
  Orbit
} from 'lucide-react';

// Reusable scratch objects for zero-GC raycasting & camera transitions
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hitPoint = new THREE.Vector3();
const _worldPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
const _camTargetPos = new THREE.Vector3(0, 38, 42);
const _camTargetLook = new THREE.Vector3(0, 0, 2);
const _zoomVec = new THREE.Vector3();

const CAMERA_PRESETS: Record<CameraPreset3D, { pos: [number, number, number]; look: [number, number, number] }> = {
  isometric: { pos: [0, 38, 42], look: [0, 0, 2] },
  chase: { pos: [0, 17, 29], look: [0, 0.5, -2] },
  diorama: { pos: [0, 62, 0.01], look: [0, 0, 0] }
};

export default function WorldBoxGame({ onGameOver, onScoreUpdate, highScore }: GameComponentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const {
    gameState,
    score,
    setScore,
    addScore,
    startWithCountdown,
    countdown,
    triggerGameOver,
    gameStateRef,
    scoreRef
  } = useGameEngine({
    gameId: 'world-box',
    onGameOver,
    onScoreUpdate
  });

  const [activeCategory, setActiveCategory] = useState<ToolCategory>('civilization');
  const [selectedTool, setSelectedTool] = useState<ToolId>('spawn_human');
  const [brushRadius, setBrushRadius] = useState<number>(2);
  const [simSpeed, setSimSpeed] = useState<SimSpeed>(1);
  const [worldTemplate, setWorldTemplate] = useState<WorldTemplate>('archipelago');
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset3D>('isometric');
  const [quality, setQuality] = useState<QualityLevel3D>('ultra');
  const [interactionMode, setInteractionMode] = useState<'paint' | 'orbit'>('paint');
  const [worldLaws, setWorldLaws] = useState<WorldLaws>({
    diplomacyAndWars: true,
    naturalDisasters: false,
    hungerAndAging: true,
    showKingdomBorders: true
  });
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    year: 1,
    month: 1,
    population: 0,
    kingdomCount: 0,
    buildingCount: 0,
    warsCount: 0,
    completedEraCount: 0,
    activeEraTitle: DIVINE_ERA_CHALLENGES[0].title,
    activeEraDesc: DIVINE_ERA_CHALLENGES[0].description,
    activeEraReward: DIVINE_ERA_CHALLENGES[0].rewardScore,
    chronicles: [],
    kingdoms: [],
    inspected: null
  }));

  const simSpeedRef = useRef<SimSpeed>(simSpeed);
  const selectedToolRef = useRef<ToolId>(selectedTool);
  const brushRadiusRef = useRef<number>(brushRadius);
  const selectedUnitIdRef = useRef<number | null>(selectedUnitId);
  const interactionModeRef = useRef<'paint' | 'orbit'>(interactionMode);
  const cameraPresetRef = useRef<CameraPreset3D>(cameraPreset);
  const activeCamTransitionRef = useRef<boolean>(false);
  const isPaintingRef = useRef<boolean>(false);
  const frameCounterRef = useRef<number>(0);

  const stageRef = useRef<ThreeStageController | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const renderer3DRef = useRef<WorldBoxRenderer3D | null>(null);
  const engineRef = useRef<WorldBoxEngine | null>(null);

  useEffect(() => { simSpeedRef.current = simSpeed; }, [simSpeed]);
  useEffect(() => { selectedToolRef.current = selectedTool; }, [selectedTool]);
  useEffect(() => { brushRadiusRef.current = brushRadius; }, [brushRadius]);
  useEffect(() => { selectedUnitIdRef.current = selectedUnitId; }, [selectedUnitId]);
  useEffect(() => {
    interactionModeRef.current = interactionMode;
    const controls = controlsRef.current;
    if (controls) {
      if (interactionMode === 'paint') {
        controls.mouseButtons = {
          LEFT: null as unknown as THREE.MOUSE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE
        };
        controls.touches = {
          ONE: null as unknown as THREE.TOUCH,
          TWO: THREE.TOUCH.DOLLY_PAN
        };
      } else {
        controls.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        controls.touches = {
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        };
      }
    }
  }, [interactionMode]);

  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
    const cfg = CAMERA_PRESETS[cameraPreset];
    _camTargetPos.set(...cfg.pos);
    _camTargetLook.set(...cfg.look);
    activeCamTransitionRef.current = true;
  }, [cameraPreset]);

  if (!engineRef.current) {
    engineRef.current = new WorldBoxEngine({
      onScoreAdd: (pts) => addScore(pts),
      onSound: (type) => {
        if (type === 'click') audioController.playClick();
        else if (type === 'coin') audioController.playCoin();
        else if (type === 'powerup') audioController.playPowerup();
        else if (type === 'explosion') {
          audioController.playExplosion();
          haptics.trigger('medium');
        } else if (type === 'hit') audioController.playHit();
        else if (type === 'levelup') {
          audioController.playLevelUp();
          haptics.trigger('success');
        }
      },
      onShake: (intensity) => {
        screenShake.trigger(intensity);
        if (intensity === 'heavy') {
          stageRef.current?.cameraRig.addTrauma(0.65);
          haptics.trigger('heavy');
        } else if (intensity === 'medium') {
          stageRef.current?.cameraRig.addTrauma(0.35);
          haptics.trigger('medium');
        }
      }
    });
  }

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.laws = worldLaws;
    }
  }, [worldLaws]);

  const syncHudSnapshot = useCallback((overrideUnitId?: number | null) => {
    const engine = engineRef.current;
    if (!engine) return;
    const targetId = overrideUnitId !== undefined ? overrideUnitId : selectedUnitIdRef.current;
    setHud(engine.getHudSnapshot(targetId));
  }, []);

  const regenerateWorld = useCallback(
    (tpl: WorldTemplate) => {
      const engine = engineRef.current;
      if (!engine) return;
      setSelectedUnitId(null);
      selectedUnitIdRef.current = null;
      engine.resetWorld(tpl);
      syncHudSnapshot(null);
    },
    [syncHudSnapshot]
  );

  const cycleQuality = useCallback(() => {
    setQuality((prev) => {
      const next: QualityLevel3D = prev === 'ultra' ? 'balanced' : prev === 'balanced' ? 'performance' : 'ultra';
      stageRef.current?.setQualityLevel(next);
      return next;
    });
  }, []);

  const adjustZoom = useCallback((factor: number) => {
    const stage = stageRef.current;
    const controls = controlsRef.current;
    if (!stage || !controls) return;
    activeCamTransitionRef.current = false;
    _zoomVec.subVectors(stage.camera.position, controls.target);
    const len = _zoomVec.length();
    const nextLen = Math.max(12, Math.min(95, len * factor));
    _zoomVec.setLength(nextLen);
    stage.camera.position.copy(controls.target).add(_zoomVec);
    controls.update();
  }, []);

  const resetCamera = useCallback(() => {
    setCameraPreset('isometric');
    const cfg = CAMERA_PRESETS.isometric;
    _camTargetPos.set(...cfg.pos);
    _camTargetLook.set(...cfg.look);
    activeCamTransitionRef.current = true;
    audioController.playClick();
  }, []);

  const focusOnUnit = useCallback((ux: number, uy: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const { x, z } = tileToWorld3D(ux, uy, engine.state.gridW, engine.state.gridH);
    _camTargetLook.set(x, 1.0, z);
    _camTargetPos.set(x, 11.5, z + 11.5);
    activeCamTransitionRef.current = true;
    audioController.playClick();
  }, []);

  // Initialize ThreeStageController + 3D Voxel Diorama Scene + OrbitControls + Game Loop
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    const engine = engineRef.current;
    if (!wrapper || !engine) return;

    engine.resetWorld('archipelago');
    syncHudSnapshot(null);

    let stage: ThreeStageController;
    try {
      stage = new ThreeStageController({
        container: wrapper,
        backgroundColor: 0x040b18,
        fogColor: 0x040b18,
        fogDensity: 0.0065,
        fov: 46,
        near: 0.5,
        far: 320,
        manualCamera: true,
        enableGridFloor: false,
        shadowBounds: 42,
        toneMappingExposure: 1.15,
        bloom: {
          enabled: true,
          strength: 0.42,
          radius: 0.35,
          threshold: 0.85
        }
      });
    } catch {
      return;
    }

    stageRef.current = stage;
    setQuality(stage.getQualityLevel());

    // Position isometric 3D diorama camera
    const initCfg = CAMERA_PRESETS.isometric;
    stage.camera.position.set(...initCfg.pos);
    stage.camera.lookAt(...initCfg.look);

    // Rich sunlit tabletop atmosphere
    stage.keyLight.position.set(28, 48, 26);
    stage.keyLight.intensity = 2.0;
    stage.hemiLight.intensity = 0.9;

    const controls = new OrbitControls(stage.camera, stage.renderer.domElement);
    controls.target.set(...initCfg.look);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 12;
    controls.maxDistance = 95;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };
    controls.touches = {
      ONE: null as unknown as THREE.TOUCH,
      TWO: THREE.TOUCH.DOLLY_PAN
    };
    controls.update();
    controlsRef.current = controls;

    const onControlsStart = () => {
      activeCamTransitionRef.current = false;
    };
    controls.addEventListener('start', onControlsStart);

    const renderer3D = new WorldBoxRenderer3D(stage.scene);
    renderer3DRef.current = renderer3D;

    const raycastTile = (clientX: number, clientY: number) => {
      const rect = stage.renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, stage.camera);
      const voxelHit = renderer3D.raycastTerrain(_raycaster, engine.state.gridW, engine.state.gridH);
      if (voxelHit) return voxelHit;
      if (!_raycaster.ray.intersectPlane(_worldPlane, _hitPoint)) return null;
      return world3DToTile(_hitPoint.x, _hitPoint.z, engine.state.gridW, engine.state.gridH);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (gameStateRef.current !== 'playing') return;
      if (interactionModeRef.current === 'orbit') return;
      if (e.button !== 0 || e.shiftKey || e.altKey) return;

      const coords = raycastTile(e.clientX, e.clientY);
      if (!coords) return;
      isPaintingRef.current = true;
      haptics.trigger('light');
      engine.applyToolAtTile(
        selectedToolRef.current,
        coords.tx,
        coords.ty,
        brushRadiusRef.current,
        false,
        (uid) => {
          setSelectedUnitId(uid);
          selectedUnitIdRef.current = uid;
          syncHudSnapshot(uid);
        }
      );
      syncHudSnapshot();
    };

    const onPointerMove = (e: PointerEvent) => {
      const coords = raycastTile(e.clientX, e.clientY);
      const toolInfo = GOD_POWERS_CATALOG.find((t) => t.id === selectedToolRef.current);
      const biome = coords
        ? engine.state.biomes[coords.ty * engine.state.gridW + coords.tx]
        : undefined;
      renderer3D.setBrushCursor(
        interactionModeRef.current === 'paint' ? coords : null,
        engine.state.gridW,
        engine.state.gridH,
        brushRadiusRef.current,
        toolInfo?.accent || '#38bdf8',
        biome
      );

      if (!isPaintingRef.current || gameStateRef.current !== 'playing' || !coords) return;
      engine.applyToolAtTile(
        selectedToolRef.current,
        coords.tx,
        coords.ty,
        brushRadiusRef.current,
        true
      );
    };

    const onPointerUp = () => {
      isPaintingRef.current = false;
    };

    const onPointerLeave = () => {
      isPaintingRef.current = false;
      renderer3D.setBrushCursor(null, engine.state.gridW, engine.state.gridH, 1, '#38bdf8');
    };

    const keysDown = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      keysDown.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
    };

    const domEl = stage.renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerup', onPointerUp);
    domEl.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    stage.startLoop((dt, elapsed) => {
      if (gameStateRef.current === 'playing') {
        engine.updateFrame(dt, simSpeedRef.current);
        frameCounterRef.current++;
        if (frameCounterRef.current % 12 === 0) {
          syncHudSnapshot();
        }
      }

      // Keyboard WASD / Arrow camera pan across the 3D diorama
      let panX = 0;
      let panZ = 0;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) panX -= 1;
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) panX += 1;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) panZ -= 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) panZ += 1;
      if (panX !== 0 || panZ !== 0) {
        activeCamTransitionRef.current = false;
        const speed = 26 * dt;
        const nextTx = Math.max(-34, Math.min(34, controls.target.x + panX * speed));
        const nextTz = Math.max(-22, Math.min(22, controls.target.z + panZ * speed));
        const dx = nextTx - controls.target.x;
        const dz = nextTz - controls.target.z;
        controls.target.x = nextTx;
        controls.target.z = nextTz;
        stage.camera.position.x += dx;
        stage.camera.position.z += dz;
      }

      renderer3D.sync(engine, selectedUnitIdRef.current, elapsed);

      if (activeCamTransitionRef.current) {
        stage.camera.position.x = THREE.MathUtils.damp(stage.camera.position.x, _camTargetPos.x, 6, dt);
        stage.camera.position.y = THREE.MathUtils.damp(stage.camera.position.y, _camTargetPos.y, 6, dt);
        stage.camera.position.z = THREE.MathUtils.damp(stage.camera.position.z, _camTargetPos.z, 6, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camTargetLook.x, 6, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camTargetLook.y, 6, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camTargetLook.z, 6, dt);

        if (stage.camera.position.distanceTo(_camTargetPos) < 0.2) {
          activeCamTransitionRef.current = false;
        }
      }

      controls.update();
      stage.cameraRig.applyAdditiveShake(stage.camera, dt, 0.45);
    });

    return () => {
      controls.removeEventListener('start', onControlsStart);
      domEl.removeEventListener('pointerdown', onPointerDown);
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      controls.dispose();
      controlsRef.current = null;
      renderer3D.dispose();
      renderer3DRef.current = null;
      engine.destroy();
      stage.dispose();
      stageRef.current = null;
    };
  }, [gameStateRef, syncHudSnapshot]);

  const activeTools = GOD_POWERS_CATALOG.filter((t) => t.category === activeCategory);
  const currentToolInfo = GOD_POWERS_CATALOG.find((t) => t.id === selectedTool) || GOD_POWERS_CATALOG[0];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] sm:min-h-[520px] lg:min-h-[580px] bg-slate-950 text-slate-100 flex flex-col select-none overflow-hidden rounded-xl border border-slate-800"
    >
      {/* TOP CHRONICLE & SIMULATION HUD BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 z-20">
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <Compass className="w-4 h-4 shrink-0" />
            <span>Thn {hud.year} · Bln {hud.month}</span>
          </div>
          <span className="text-slate-600">·</span>
          <div className="flex items-center gap-1.5 text-slate-200">
            <Users className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>Pop: {hud.population}</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <div className="hidden sm:flex items-center gap-1.5 text-slate-200">
            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Kerajaan: {hud.kingdomCount}</span>
          </div>
          <span className="text-slate-600 hidden md:inline">·</span>
          <div className="hidden md:flex items-center gap-1.5 text-slate-200">
            <Award className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Era: {hud.completedEraCount}/{DIVINE_ERA_CHALLENGES.length}</span>
          </div>
        </div>

        {/* Time Controls & Save/Load */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSimSpeed(0)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1 ${
                simSpeed === 0 ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
            {([1, 2, 5] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-1 text-xs font-mono tabular-nums rounded-md transition-colors ${
                  simSpeed === spd ? 'bg-sky-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <select
            aria-label="Template Dunia"
            value={worldTemplate}
            onChange={(e) => {
              const tpl = e.target.value as WorldTemplate;
              setWorldTemplate(tpl);
              regenerateWorld(tpl);
            }}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1.5"
          >
            <option value="archipelago">Kepulauan</option>
            <option value="pangaea">Benua Pangaea</option>
            <option value="volcanic">Cincin Vulkanik</option>
          </select>

          <button
            type="button"
            onClick={() => regenerateWorld(worldTemplate)}
            className="px-2 py-1.5 min-h-[36px] text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
            title="Buat Dunia Baru"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (engineRef.current?.saveToLocalStorage()) {
                audioController.playPowerup();
                syncHudSnapshot();
              }
            }}
            className="px-2 py-1.5 min-h-[36px] text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
            title="Quick Save Dunia"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (engineRef.current?.loadFromLocalStorage()) {
                audioController.playLevelUp();
                syncHudSnapshot();
              }
            }}
            className="px-2 py-1.5 min-h-[36px] text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
            title="Quick Load Dunia"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono tabular-nums">
            <span className="text-[11px] text-slate-400 block leading-none">DIVINE SCORE</span>
            <span className="text-sm font-bold text-amber-400">{score.toLocaleString()}</span>
          </div>
          {gameState === 'playing' && (
            <button
              type="button"
              onClick={() => {
                const finalScore = Math.max(
                  scoreRef.current,
                  hud.population * 25 + hud.kingdomCount * 300 + hud.year * 20
                );
                setScore(finalScore);
                audioController.playLevelUp();
                triggerGameOver(finalScore);
              }}
              className="px-3 py-1.5 min-h-[44px] sm:min-h-0 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Klaim Skor</span>
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE ERA OBJECTIVE STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 text-xs z-10">
        <div className="flex items-center gap-2 text-slate-300 truncate">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-300 whitespace-nowrap">{hud.activeEraTitle}:</span>
          <span className="text-slate-300 truncate">{hud.activeEraDesc}</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono tabular-nums text-emerald-400 whitespace-nowrap">
            +{hud.activeEraReward.toLocaleString()} Poin
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Kuas: <strong className="text-slate-200">{currentToolInfo.label}</strong></span>
          <span>·</span>
          <div className="flex items-center gap-1">
            {[1, 2, 4, 7].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setBrushRadius(r)}
                className={`px-1.5 py-0.5 font-mono tabular-nums rounded text-[11px] ${
                  brushRadius === r ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40' : 'text-slate-400'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN 3D WORKSPACE */}
      <div className="relative flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div
          className="relative flex-1 bg-[#040b18] overflow-hidden min-h-[260px] sm:min-h-[340px]"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Three.js WebGL Mount */}
          <div
            ref={canvasWrapperRef}
            className={`absolute inset-0 w-full h-full ${
              interactionMode === 'paint' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
            }`}
          />

          {/* Compact Top-Left Hint Pill */}
          <div className="pointer-events-none absolute top-3 left-3 z-10 hidden sm:flex items-center gap-2 rounded-lg bg-slate-950/80 border border-white/10 px-2.5 py-1 text-[11px] text-slate-300">
            <span>Klik kiri: Kuas · Drag kanan / Scroll: Orbit & Zoom · WASD: Geser Peta</span>
          </div>

          <ThreeDockOverlay
            cameraPreset={cameraPreset}
            onSelectPreset={setCameraPreset}
            quality={quality}
            onCycleQuality={cycleQuality}
            presetLabels={{
              chase: 'Sudut Rendah',
              isometric: 'Diorama 3D',
              diorama: 'Peta Atas'
            }}
            extraControls={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    audioController.playClick();
                    setInteractionMode((m) => (m === 'paint' ? 'orbit' : 'paint'));
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 border transition-colors ${
                    interactionMode === 'paint'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-sky-500/25 text-sky-300 border-sky-500/50'
                  }`}
                  title="Ganti Mode Klik/Sentuh: Kuas atau Putar Kamera 3D"
                >
                  {interactionMode === 'paint' ? (
                    <>
                      <Paintbrush className="w-3 h-3" />
                      <span>Kuas</span>
                    </>
                  ) : (
                    <>
                      <Orbit className="w-3 h-3" />
                      <span>Orbit 3D</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => adjustZoom(0.8)}
                  className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10"
                  aria-label="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustZoom(1.25)}
                  className="p-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10"
                  aria-label="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={resetCamera}
                  className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-[11px] font-mono text-slate-300 hover:text-white border border-white/10"
                >
                  Reset
                </button>
              </div>
            }
          />
        </div>

        {/* RIGHT INSPECTOR & CHRONICLE DRAWER */}
        <aside className="w-full lg:w-72 bg-slate-900/95 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between p-3 gap-3 overflow-y-auto max-h-56 lg:max-h-none z-10">
          {hud.inspected?.status === 'alive' ? (
            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    {hud.inspected.unit.isKing && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                    <span>{hud.inspected.unit.name}</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    {RACE_CONFIG[hud.inspected.unit.race].label} · Lv.{hud.inspected.unit.level} · {hud.inspected.unit.age} thn
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedUnitId(null); syncHudSnapshot(null); }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Tutup
                </button>
              </div>
              <div className="text-xs font-mono tabular-nums flex justify-between text-slate-300">
                <span>HP: {hud.inspected.unit.hp}/{hud.inspected.unit.maxHp}</span>
                <span>ATK: {hud.inspected.unit.attack} · Kills: {hud.inspected.unit.kills}</span>
              </div>
              <div className="text-xs text-slate-300">
                <span className="text-slate-400">Traits: </span>
                {hud.inspected.unit.traits.join(' · ') || 'Normal'}
              </div>
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (hud.inspected?.status === 'alive' && engineRef.current?.blessUnitById(hud.inspected.unit.id)) {
                      syncHudSnapshot();
                    }
                  }}
                  className="px-2 py-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded"
                >
                  Berkahi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (hud.inspected?.status === 'alive' && engineRef.current?.smiteUnitById(hud.inspected.unit.id)) {
                      syncHudSnapshot();
                    }
                  }}
                  className="px-2 py-1 text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded"
                >
                  Sambar Petir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (hud.inspected?.status === 'alive') {
                      focusOnUnit(hud.inspected.unit.x, hud.inspected.unit.y);
                    }
                  }}
                  className="col-span-2 px-2 py-1 text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded flex items-center justify-center gap-1"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>Fokus Kamera ke Unit</span>
                </button>
              </div>
            </div>
          ) : hud.inspected?.status === 'deceased' ? (
            <div className="bg-slate-950/90 border border-rose-900/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                  <Skull className="w-4 h-4" />
                  <span>Status: Deceased (Gugur)</span>
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedUnitId(null); syncHudSnapshot(null); }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Tutup
                </button>
              </div>
              <p className="text-xs text-slate-300">
                <strong>{hud.inspected.record.name}</strong> gugur pada Tahun {hud.inspected.record.yearOfDeath} ({hud.inspected.record.cause}).
              </p>
              {hud.inspected.record.killerId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    if (hud.inspected?.status === 'deceased' && hud.inspected.record.killerId !== null) {
                      setSelectedUnitId(hud.inspected.record.killerId);
                      syncHudSnapshot(hud.inspected.record.killerId);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded flex items-center justify-center gap-1.5"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Inspeksi Pembunuh ({hud.inspected.record.killerName})</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  <span>Hukum Dunia & Diplomasi</span>
                </span>
                <span className="font-mono tabular-nums text-slate-400">{hud.kingdoms.length} Dinasti</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setWorldLaws((w) => ({ ...w, diplomacyAndWars: !w.diplomacyAndWars }))}
                  className={`px-2 py-1 text-[11px] rounded border ${
                    worldLaws.diplomacyAndWars ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Diplomasi: {worldLaws.diplomacyAndWars ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setWorldLaws((w) => ({ ...w, naturalDisasters: !w.naturalDisasters }))}
                  className={`px-2 py-1 text-[11px] rounded border ${
                    worldLaws.naturalDisasters ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Bencana Alami: {worldLaws.naturalDisasters ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setWorldLaws((w) => ({ ...w, showKingdomBorders: !w.showKingdomBorders }))}
                  className={`px-2 py-1 text-[11px] rounded border ${
                    worldLaws.showKingdomBorders ? 'bg-sky-500/15 border-sky-500/30 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  Batas Kerajaan: {worldLaws.showKingdomBorders ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto text-xs font-mono tabular-nums">
                {hud.kingdoms.slice(0, 5).map((k) => {
                  const isAtWar = Object.values(k.relations).includes('war');
                  const isAllied = Object.values(k.relations).includes('alliance');
                  return (
                    <div key={k.id} className="flex items-center justify-between text-slate-300">
                      <span className="truncate font-sans font-medium" style={{ color: k.borderColor }}>
                        {k.name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Pop {k.population} · {isAtWar ? 'WAR' : isAllied ? 'ALLY' : 'PEACE'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 bg-slate-950/70 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2 text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <ScrollText className="w-3.5 h-3.5 text-amber-400" />
                <span>Kronik Sejarah Dunia</span>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {hud.chronicles.map((c) => (
                <div key={c.id} className="text-slate-300 leading-snug border-b border-slate-800/60 pb-1">
                  {c.text}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* BOTTOM GOD POWERS TOOLBAR */}
      <div className="bg-slate-900 border-t border-slate-800 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] space-y-2 z-20">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: 'terrain' as const, label: 'Medan & Bioma', icon: Globe },
            { id: 'civilization' as const, label: 'Peradaban & Ras', icon: Users },
            { id: 'nature' as const, label: 'Alam & Sumber Daya', icon: Trees },
            { id: 'disasters' as const, label: 'Bencana & Murka', icon: Flame },
            { id: 'inspector' as const, label: 'Inspeksi & Berkah', icon: Eye }
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  const first = GOD_POWERS_CATALOG.find((t) => t.category === cat.id);
                  if (first) setSelectedTool(first.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[44px] ${
                  activeCategory === cat.id ? 'bg-amber-500 text-slate-950 font-semibold' : 'bg-slate-950 text-slate-300 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {activeTools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => { setSelectedTool(tool.id); audioController.playClick(); }}
              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 min-h-[44px] border ${
                selectedTool === tool.id ? 'bg-slate-800 text-white border-amber-400' : 'bg-slate-950/90 text-slate-300 border-slate-800'
              }`}
            >
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: tool.accent }} />
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      <GameOverlay
        gameState={gameState}
        score={score}
        highScore={highScore}
        countdown={countdown}
        title="WorldBox: God Simulator 3D"
        description="Bentuk benua 3D Voxel Diorama, turunkan 4 bangsa fantasi otonom & Naga 3D, saksikan kerajaan bangkit atau berperang, dan selesaikan Tantangan Era Ilahi!"
        themeColor="#f59e0b"
        onStart={() => { setScore(0); regenerateWorld(worldTemplate); startWithCountdown(); }}
        onRestart={() => { setScore(0); regenerateWorld(worldTemplate); startWithCountdown(); }}
      />
    </div>
  );
}
