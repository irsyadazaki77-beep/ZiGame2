import React, { useState, useEffect } from 'react';
import { CameraPreset3D, QualityLevel3D } from '../../utils/threeStage';
import { Eye, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && document.activeElement?.tagName !== 'INPUT') {
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const labels: Record<CameraPreset3D, string> = {
    chase: presetLabels?.chase || 'Chase 3D',
    isometric: presetLabels?.isometric || 'Isometric 3D',
    diorama: presetLabels?.diorama || 'Top Diorama'
  };

  const qualityLabel =
    quality === 'ultra' ? 'PBR Ultra' : quality === 'balanced' ? 'Balanced 60FPS' : 'Perf Mode';

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-3 pb-[env(safe-area-inset-bottom)] z-20 flex flex-col items-center px-3"
      aria-label="Kontrol Kamera dan Visual 3D"
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setCollapsed((c) => !c);
        }}
        className="pointer-events-auto mb-1 min-h-[44px] sm:min-h-0 flex items-center gap-1.5 rounded-t-lg border border-white/10 bg-slate-950/90 px-3 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-900 hover:text-white whitespace-nowrap shrink-0"
        title="Sembunyikan atau tampilkan dock kontrol 3D (Shortcut: H)"
      >
        {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span>{collapsed ? 'Tampilkan Kontrol 3D (H)' : 'Sembunyikan Kontrol (H)'}</span>
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
              className="min-h-[44px] sm:min-h-0 flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
              title="Ubah tingkat kualitas grafis 3D"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>{qualityLabel}</span>
            </button>
          )}

          {extraControls}
        </div>
      )}
    </div>
  );
};
