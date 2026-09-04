import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Music, SlidersHorizontal, Check } from 'lucide-react';
import { audio } from '../../utils/audio';

interface AudioSettingsPopoverProps {
  isMuted: boolean;
  onToggleMute: () => void;
  isBgmOn: boolean;
  setIsBgmOn: React.Dispatch<React.SetStateAction<boolean>>;
  isCrtFilter: boolean;
  setIsCrtFilter: React.Dispatch<React.SetStateAction<boolean>>;
  bgAmbient: string;
  setBgAmbient: (id: string) => void;
  backgroundAmbients: Array<{ id: string; name: string; color: string }>;
}

export const AudioSettingsPopover: React.FC<AudioSettingsPopoverProps> = ({
  isMuted,
  onToggleMute,
  isBgmOn,
  setIsBgmOn,
  isCrtFilter,
  setIsCrtFilter,
  bgAmbient,
  setBgAmbient,
  backgroundAmbients,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [musicVol, setMusicVol] = useState(() => audio.getMusicVolume());
  const [sfxVol, setSfxVol] = useState(() => audio.getSfxVolume());
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMusicVolChange = (val: number) => {
    setMusicVol(val);
    audio.setMusicVolume(val);
    if (val === 0) {
      setIsBgmOn(false);
    } else if (!isBgmOn) {
      setIsBgmOn(true);
    }
  };

  const handleSfxVolChange = (val: number) => {
    setSfxVol(val);
    audio.setSfxVolume(val);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => { audio.playCoin(); setIsOpen(prev => !prev); }}
        className={`w-9 h-9 rounded-xl border transition-all duration-200 flex items-center justify-center cursor-pointer ${
          isMuted
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            : isOpen
            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
        }`}
        title="Pengaturan Suara & Tampilan"
        aria-label="Pengaturan Suara & Tampilan"
        id="audio-settings-popover-btn"
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl z-50 font-sans space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
              <SlidersHorizontal size={14} className="text-indigo-400" />
              <span>Audio & Tampilan</span>
            </div>
            <button
              onClick={onToggleMute}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase transition ${
                isMuted ? 'bg-rose-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {isMuted ? 'UNMUTE' : 'MUTE SEMUA'}
            </button>
          </div>

          {/* Music Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <Music size={13} className="text-indigo-400" /> Volume Musik (BGM)
              </span>
              <span className="font-mono text-[10px] text-zinc-500">{Math.round(musicVol * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVol}
              onChange={(e) => handleMusicVolChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* SFX Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span className="flex items-center gap-1.5 font-mono text-[11px]">
                <Volume2 size={13} className="text-emerald-400" /> Volume Efek Suara (SFX)
              </span>
              <span className="font-mono text-[10px] text-zinc-500">{Math.round(sfxVol * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sfxVol}
              onChange={(e) => handleSfxVolChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          {/* CRT Filter & Backlight */}
          <div className="pt-2 border-t border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-300 font-mono text-[11px]">Filter CRT Monitor</span>
              <button
                onClick={() => setIsCrtFilter(prev => !prev)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  isCrtFilter ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  isCrtFilter ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">Warna Lampu Latar:</span>
              <div className="flex items-center gap-2">
                {backgroundAmbients.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => { audio.playCoin(); setBgAmbient(b.id); }}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-transform cursor-pointer ${
                      bgAmbient === b.id ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: b.color }}
                  >
                    {bgAmbient === b.id && <Check size={12} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
