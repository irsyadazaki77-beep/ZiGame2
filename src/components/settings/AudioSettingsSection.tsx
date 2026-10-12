import React from 'react';
import { Volume2 } from 'lucide-react';

interface AudioSettingsSectionProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onTestSound: () => void;
}

export const AudioSettingsSection: React.FC<AudioSettingsSectionProps> = ({
  isMuted,
  onToggleMute,
  onTestSound
}) => {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <h3 className="text-xs font-mono font-bold text-text-primary tracking-wider uppercase flex items-center gap-2">
        <Volume2 className="w-4 h-4 text-indigo-500" /> SINTESIS AUDIO & SUARA
      </h3>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3.5 bg-surface-subtle border border-border-subtle rounded-xl">
          <div>
            <span className="text-xs font-bold text-text-primary uppercase tracking-wide block">Bungkam Semua Suara</span>
            <span className="text-xs text-text-secondary font-mono mt-0.5 block">Matikan seluruh efek audio synthesizer.</span>
          </div>
          <button
            onClick={onToggleMute}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 cursor-pointer focus:outline-hidden ${
              isMuted ? 'bg-zinc-800' : 'bg-indigo-600'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
              isMuted ? 'translate-x-0' : 'translate-x-5'
            }`} />
          </button>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-surface-subtle border border-border-subtle rounded-xl">
          <div>
            <span className="text-xs font-bold text-text-primary uppercase tracking-wide block">Uji Generator Suara</span>
            <span className="text-xs text-text-secondary font-mono mt-0.5 block">Tes respon audio Web-Audio API.</span>
          </div>
          <button
            onClick={onTestSound}
            disabled={isMuted}
            className="px-3.5 py-1.5 rounded-lg border border-border-medium bg-surface-card text-xs font-mono font-bold text-text-primary hover:text-white hover:bg-indigo-600 cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            TES SUARA 🎵
          </button>
        </div>
      </div>
    </div>
  );
};
