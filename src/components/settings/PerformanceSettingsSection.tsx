import React from 'react';
import { Cpu } from 'lucide-react';

interface PerformanceSettingsSectionProps {
  graphicsQuality: 'low' | 'medium' | 'high';
  onGraphicsChange: (q: 'low' | 'medium' | 'high') => void;
  fpsLimit: '30' | '60' | '120' | 'auto';
  onFpsChange: (fps: '30' | '60' | '120' | 'auto') => void;
}

export const PerformanceSettingsSection: React.FC<PerformanceSettingsSectionProps> = ({
  graphicsQuality,
  onGraphicsChange,
  fpsLimit,
  onFpsChange
}) => {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-mono font-bold text-text-primary tracking-wider uppercase flex items-center gap-2">
        <Cpu className="w-4 h-4 text-indigo-500" /> PERFORMA & GRAFIK
      </h3>
      
      <div className="space-y-3">
        <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-xl space-y-2">
          <div>
            <span className="text-xs font-bold text-text-primary uppercase tracking-wide block">Kualitas Efek & Partikel</span>
            <span className="text-xs text-text-secondary font-mono mt-0.5 block">Sesuaikan dengan kemampuan perangkat.</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                onClick={() => onGraphicsChange(q)}
                className={`py-2 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
                  graphicsQuality === q
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-surface-card border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                {q === 'low' ? 'HEMAT BATERAI' : q === 'medium' ? 'SEIMBANG' : 'ULTRA GLOW'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-xl space-y-2">
          <div>
            <span className="text-xs font-bold text-text-primary uppercase tracking-wide block">Batas Frame Rate (FPS)</span>
            <span className="text-xs text-text-secondary font-mono mt-0.5 block">Target refresh rate kanvas visual.</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {(['30', '60', '120', 'auto'] as const).map((f) => (
              <button
                key={f}
                onClick={() => onFpsChange(f)}
                className={`py-2 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
                  fpsLimit === f
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-surface-card border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                {f === 'auto' ? 'OTOMATIS' : `${f} FPS`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
