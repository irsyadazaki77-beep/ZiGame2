import React from 'react';
import { Monitor, Sparkles } from 'lucide-react';

interface DisplaySettingsSectionProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  defaultScreenSize: 'standard' | 'wide' | 'theater';
  onScreenSizeChange: (size: 'standard' | 'wide' | 'theater') => void;
}

export const DisplaySettingsSection: React.FC<DisplaySettingsSectionProps> = ({
  theme,
  toggleTheme,
  defaultScreenSize,
  onScreenSizeChange
}) => {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-mono font-bold text-text-primary tracking-wider uppercase flex items-center gap-2">
        <Monitor className="w-4 h-4 text-indigo-500" /> TAMPILAN & TEMA APLIKASI
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3.5 bg-surface-subtle border border-border-subtle rounded-xl">
          <div>
            <span className="text-xs font-bold text-text-primary uppercase tracking-wide block">Tema Tampilan</span>
            <span className="text-xs text-text-secondary font-mono mt-0.5 block">Mode {theme === 'dark' ? 'Gelap (Retro Dark)' : 'Terang (Clean Modern)'}</span>
          </div>
          <button
            onClick={toggleTheme}
            className="px-3.5 py-1.5 rounded-lg border border-border-medium bg-surface-card text-xs font-mono font-bold text-text-primary hover:text-white hover:bg-indigo-600 cursor-pointer transition"
          >
            {theme === 'dark' ? '🌙 GELAP' : '☀️ TERANG'}
          </button>
        </div>

        <div className="p-3.5 bg-surface-subtle border border-border-subtle rounded-xl space-y-2">
          <div>
            <span className="text-xs font-bold text-text-primary uppercase tracking-wide block">Ukuran Kanvas Game</span>
            <span className="text-xs text-text-secondary font-mono mt-0.5 block">Preferensi rasio aspek saat membuka game.</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {(['standard', 'wide', 'theater'] as const).map((sz) => (
              <button
                key={sz}
                onClick={() => onScreenSizeChange(sz)}
                className={`py-2 rounded-lg text-xs font-mono font-bold uppercase transition cursor-pointer ${
                  defaultScreenSize === sz
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-surface-card border border-border-subtle text-text-secondary hover:text-text-primary'
                }`}
              >
                {sz === 'standard' ? 'STANDAR (4:3)' : sz === 'wide' ? 'WIDE (16:9)' : 'THEATER'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
