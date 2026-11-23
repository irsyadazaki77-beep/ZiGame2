import React, { useState, useEffect, useCallback } from 'react';
import {
  CameraPreset3D,
  QualityLevel3D,
  STUDIO_ATMOSPHERES_3D,
  StudioAtmosphere3D,
  ThreeStageController,
} from '../../utils/threeStage';
import { Eye, Sparkles, ChevronDown, ChevronUp, Palette, Gauge } from 'lucide-react';
import { audioController } from '../../sdk/audioController';

interface ThreeDockOverlayProps {
  cameraPreset: CameraPreset3D;
  onSelectPreset: (preset: CameraPreset3D) => void;
  quality?: QualityLevel3D;
  onCycleQuality?: () => void;
  extraControls?: React.ReactNode;
  presetLabels?: Partial<Record<CameraPreset3D, string>>;
}

export const ThreeDockOverlay: React.FC<ThreeDockOverlayProps> = ({
  cameraPreset,
  onSelectPreset,
  quality = 'ultra',
  onCycleQuality,
  extraControls,
  presetLabels
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });
  const [atmosphere, setAtmosphere] = useState<StudioAtmosphere3D>(() => {
    const active = ThreeStageController.getActiveStage();
    if (active) return active.getAtmosphere();
    try {
      const saved = localStorage.getItem('zigame_3d_atmosphere') as StudioAtmosphere3D | null;
      if (saved && STUDIO_ATMOSPHERES_3D[saved]) return saved;
    } catch {}
    return 'cyber-neon';
  });
  const [fps, setFps] = useState<number>(60);

  const handleCycleAtmosphere = useCallback(() => {
    audioController.playClick();
    const active = ThreeStageController.getActiveStage();
    if (active) {
      const next = active.cycleAtmosphere();
      active.triggerShockwave(0, 0.08, 0, STUDIO_ATMOSPHERES_3D[next].accentColor, 6.0, 0.48);
      setAtmosphere(next);
    } else {
      const keys = Object.keys(STUDIO_ATMOSPHERES_3D) as StudioAtmosphere3D[];
      const next = keys[(keys.indexOf(atmosphere) + 1) % keys.length];
      setAtmosphere(next);
    }
  }, [atmosphere]);

  useEffect(() => {
    const interval = setInterval(() => {
      const active = ThreeStageController.getActiveStage();
      if (active) {
        setFps(active.getCurrentFps());
        setAtmosphere(active.getAtmosphere());
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'h') {
        setCollapsed((prev) => !prev);
      } else if (k === 'c') {
        const order: CameraPreset3D[] = ['chase', 'isometric', 'diorama'];
        const next = order[(order.indexOf(cameraPreset) + 1) % order.length];
        audioController.playClick();
        onSelectPreset(next);
      } else if (k === 'v') {
        handleCycleAtmosphere();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cameraPreset, onSelectPreset, handleCycleAtmosphere]);

  const labels: Record<CameraPreset3D, string> = {
    chase: presetLabels?.chase || 'Chase 3D',
    isometric: presetLabels?.isometric || 'Isometric 3D',
    diorama: presetLabels?.diorama || 'Top Diorama'
  };

  const qualityLabel =
    quality === 'ultra' ? 'PBR Ultra' : quality === 'balanced' ? 'Balanced 60FPS' : 'Perf Mode';

  const activeAtmosLabel = STUDIO_ATMOSPHERES_3D[atmosphere]?.label || 'Cyber Neon';

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-2 sm:bottom-3 pb-[env(safe-area-inset-bottom,0px)] z-20 flex flex-col items-center px-2 sm:px-3"
      aria-label="Kontrol Kamera dan Visual 3D"
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setCollapsed((c) => !c);
        }}
        className={`pointer-events-auto mb-1 min-h-[36px] sm:min-h-0 flex items-center gap-1.5 border border-white/10 bg-slate-950/90 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-900 hover:text-white whitespace-nowrap shrink-0 shadow-lg ${
          collapsed ? 'rounded-full' : 'rounded-t-lg'
        }`}
        title="Sembunyikan atau tampilkan dock kontrol 3D (Shortcut: H)"
      >
        {collapsed ? (
          <>
            <Eye className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold text-white">{labels[cameraPreset]}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-[10px] text-emerald-400 font-bold tabular-nums">{fps} FPS</span>
            <span className="hidden xs:inline text-slate-500">·</span>
            <span className="hidden xs:inline-flex items-center gap-1 text-cyan-300">
              <Palette className="h-3 w-3" />
              {activeAtmosLabel}
            </span>
            <ChevronUp className="h-3.5 w-3.5 text-slate-400 ml-0.5 shrink-0" />
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Sembunyikan Kontrol (H)</span>
          </>
        )}
      </button>

      {!collapsed && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-3.5 py-2 shadow-xl max-w-[94vw]"
        >
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-900 p-1">
            <span className="flex items-center gap-1 px-2 text-[11px] font-medium text-slate-400 whitespace-nowrap shrink-0">
              <Eye className="h-3.5 w-3.5 text-cyan-400" />
              Kamera
            </span>
            {(['chase', 'isometric', 'diorama'] as CameraPreset3D[]).map((preset) => {
              const active = cameraPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className={`min-h-[44px] sm:min-h-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-cyan-500 text-slate-950 shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          {onCycleQuality && (
            <button
              type="button"
              onClick={onCycleQuality}
              className="min-h-[44px] sm:min-h-0 flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              title="Ubah tingkat kualitas grafis 3D"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>{qualityLabel}</span>
            </button>
          )}

          {/* 3D Studio Atmosphere & Lighting Switcher (Shortcut: V) */}
          <button
            type="button"
            onClick={handleCycleAtmosphere}
            className="min-h-[44px] sm:min-h-0 flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-slate-800 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            title="Ganti Atmosfer Pencahayaan & Bloom 3D (Shortcut: V)"
            data-testid="three-atmosphere-btn"
          >
            <Palette className="h-3.5 w-3.5 text-cyan-400" />
            <span>{STUDIO_ATMOSPHERES_3D[atmosphere]?.label || 'Cyber Neon'}</span>
          </button>

          {/* Live 3D FPS Telemetry Badge */}
          <span
            className="hidden md:inline-flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] font-mono font-bold text-emerald-400 tabular-nums shrink-0"
            title="Frame Rate WebGL 3D Real-Time"
          >
            <Gauge className="h-3 w-3" />
            {fps} FPS
          </span>

          {extraControls}
        </div>
      )}
    </div>
  );
};
