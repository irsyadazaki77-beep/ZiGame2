import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../../types';
import { useGameEngine } from '../../hooks/useGameEngine';
import { GameOverlay } from '../gameplay/GameOverlay';
import { audioController } from '../../sdk/audioController';
import { screenShake } from '../../utils/screenShake';
import {
  DIVINE_ERA_CHALLENGES,
  GOD_POWERS_CATALOG,
  RACE_CONFIG
} from './world-box/constants';
import {
  CameraState,
  HudSnapshot,
  SimSpeed,
  ToolCategory,
  ToolId,
  WorldLaws,
  WorldTemplate
} from './world-box/types';
import { WorldBoxEngine } from './world-box/worldEngine';
import { WorldBoxRenderer, screenToWorld } from './world-box/worldRenderer';
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
  Crosshair
} from 'lucide-react';

export default function WorldBoxGame({ onGameOver, onScoreUpdate, highScore }: GameComponentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const {
    gameState,
    score,
    setScore,
    addScore,
    startWithCountdown,
    countdown,
    triggerGameOver,
    startLoop,
    stopLoop,
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
  const [camera, setCamera] = useState<CameraState>({ zoom: 1, panX: 0, panY: 0 });
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
  const cameraRef = useRef<CameraState>(camera);
  const isPointerDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef({ x: 0, y: 0 });
  const frameCounterRef = useRef(0);

  useEffect(() => { simSpeedRef.current = simSpeed; }, [simSpeed]);
  useEffect(() => { selectedToolRef.current = selectedTool; }, [selectedTool]);
  useEffect(() => { brushRadiusRef.current = brushRadius; }, [brushRadius]);
  useEffect(() => { selectedUnitIdRef.current = selectedUnitId; }, [selectedUnitId]);
  useEffect(() => {
    cameraRef.current = camera;
    if (canvasRef.current && engineRef.current && rendererRef.current) {
      rendererRef.current.render(
        canvasRef.current,
        engineRef.current,
        camera,
        selectedUnitIdRef.current
      );
    }
  }, [camera]);

  const engineRef = useRef<WorldBoxEngine | null>(null);
  const rendererRef = useRef<WorldBoxRenderer | null>(null);

  if (!engineRef.current) {
    engineRef.current = new WorldBoxEngine({
      onScoreAdd: (pts) => addScore(pts),
      onSound: (type) => {
        if (type === 'click') audioController.playClick();
        else if (type === 'coin') audioController.playCoin();
        else if (type === 'powerup') audioController.playPowerup();
        else if (type === 'explosion') audioController.playExplosion();
        else if (type === 'hit') audioController.playHit();
        else if (type === 'levelup') audioController.playLevelUp();
      },
      onShake: (intensity) => screenShake.trigger(intensity)
    });
  }
  if (!rendererRef.current) {
    rendererRef.current = new WorldBoxRenderer();
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
      if (canvasRef.current && rendererRef.current) {
        rendererRef.current.render(canvasRef.current, engine, cameraRef.current, null);
      }
    },
    [syncHudSnapshot]
  );

  // Initialize world + ResizeObserver DPR canvas sizing + strict unmount cleanup
  useEffect(() => {
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    if (engine) {
      engine.resetWorld('archipelago');
      syncHudSnapshot(null);
    }

    const syncCanvasDimensionsAndRender = () => {
      const wrapper = canvasWrapperRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (wrapper) {
        const width = wrapper.clientWidth;
        const height = wrapper.clientHeight;
        if (width > 0 && height > 0) {
          const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
          const targetW = Math.floor(width * dpr);
          const targetH = Math.floor(height * dpr);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }
        }
      }

      if (engineRef.current && rendererRef.current) {
        rendererRef.current.render(
          canvas,
          engineRef.current,
          cameraRef.current,
          selectedUnitIdRef.current
        );
      }
    };

    syncCanvasDimensionsAndRender();

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            syncCanvasDimensionsAndRender();
          })
        : null;

    if (observer && canvasWrapperRef.current) {
      observer.observe(canvasWrapperRef.current);
    }

    return () => {
      stopLoop();
      observer?.disconnect();
      engine?.destroy();
      renderer?.dispose();
    };
  }, [stopLoop, syncHudSnapshot]);

  // 60 FPS Fixed-Timestep Loop
  useEffect(() => {
    const engine = engineRef.current;
    const renderer = rendererRef.current;
    if (!engine || !renderer) return;

    if (gameState !== 'playing') {
      stopLoop();
      if (canvasRef.current) {
        renderer.render(canvasRef.current, engine, cameraRef.current, selectedUnitIdRef.current);
      }
      return;
    }

    startLoop((_timestamp, deltaTimeMs) => {
      const dtSec = deltaTimeMs > 0 ? deltaTimeMs / 1000 : 1 / 60;
      engine.updateFrame(dtSec, simSpeedRef.current);
      if (canvasRef.current) {
        renderer.render(canvasRef.current, engine, cameraRef.current, selectedUnitIdRef.current);
      }
      frameCounterRef.current++;
      if (frameCounterRef.current % 12 === 0) {
        syncHudSnapshot();
      }
    });

    return () => {
      stopLoop();
    };
  }, [gameState, startLoop, stopLoop, syncHudSnapshot]);

  const getTileFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return null;
    const pt = screenToWorld(
      clientX,
      clientY,
      canvas,
      engine.state.gridW,
      engine.state.gridH,
      cameraRef.current
    );
    return { tx: pt.tx, ty: pt.ty };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState !== 'playing' || !engineRef.current) return;
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      isPanningRef.current = true;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
    isPointerDownRef.current = true;
    const coords = getTileFromPointer(e.clientX, e.clientY);
    if (coords) {
      engineRef.current.applyToolAtTile(
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
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      setCamera((prev) => ({
        ...prev,
        panX: Math.max(-320, Math.min(320, prev.panX + dx)),
        panY: Math.max(-220, Math.min(220, prev.panY + dy))
      }));
      return;
    }
    if (!isPointerDownRef.current || gameState !== 'playing' || !engineRef.current) return;
    const coords = getTileFromPointer(e.clientX, e.clientY);
    if (coords) {
      engineRef.current.applyToolAtTile(
        selectedToolRef.current,
        coords.tx,
        coords.ty,
        brushRadiusRef.current,
        true
      );
    }
  };

  const handlePointerUp = () => {
    isPointerDownRef.current = false;
    isPanningRef.current = false;
  };

  const activeTools = GOD_POWERS_CATALOG.filter((t) => t.category === activeCategory);
  const currentToolInfo = GOD_POWERS_CATALOG.find((t) => t.id === selectedTool) || GOD_POWERS_CATALOG[0];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] sm:min-h-[520px] lg:min-h-[560px] bg-slate-950 text-slate-100 flex flex-col select-none overflow-hidden rounded-xl border border-slate-800"
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
        <div className="flex items-center gap-1.5">
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
            className="px-2 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1"
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

      {/* MAIN WORKSPACE */}
      <div className="relative flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div
          ref={canvasWrapperRef}
          className="relative flex-1 bg-[#071324] flex items-center justify-center overflow-hidden min-h-[240px] sm:min-h-[320px]"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full block cursor-crosshair touch-none"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-1 z-10">
            <button
              type="button"
              onClick={() => setCamera((c) => ({ ...c, zoom: Math.min(2.5, Number((c.zoom + 0.25).toFixed(2))) }))}
              className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCamera((c) => ({ ...c, zoom: Math.max(1, Number((c.zoom - 0.25).toFixed(2))) }))}
              className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCamera({ zoom: 1, panX: 0, panY: 0 })}
              className="px-2 py-1 text-[11px] font-mono tabular-nums text-slate-300 hover:text-white"
            >
              {Math.round(camera.zoom * 100)}%
            </button>
          </div>
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
        title="WorldBox: God Simulator"
        description="Bentuk benua 2D Pixel Art, turunkan 4 bangsa fantasi otonom & Naga, saksikan kerajaan bangkit atau berperang, dan selesaikan Tantangan Era Ilahi!"
        themeColor="#f59e0b"
        onStart={() => { setScore(0); regenerateWorld(worldTemplate); startWithCountdown(); }}
        onRestart={() => { setScore(0); regenerateWorld(worldTemplate); startWithCountdown(); }}
      />
    </div>
  );
}
