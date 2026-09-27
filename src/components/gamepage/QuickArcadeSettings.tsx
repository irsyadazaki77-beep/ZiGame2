import React from 'react';
import { 
  X, 
  Volume2, 
  VolumeX, 
  Music, 
  Tv, 
  Maximize, 
  Minimize, 
  HelpCircle, 
  Compass, 
  Eye, 
  EyeOff, 
  Trophy,
  Gamepad2,
  ChevronRight
} from 'lucide-react';
import { GameStats } from '../../types';
import { audio } from '../../utils/audio';

export interface BackgroundAmbient {
  id: string;
  name: string;
  class: string;
  color: string;
}

interface QuickArcadeSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  activeGame: GameStats;
  games: GameStats[];
  recentlyPlayedIds: string[];
  onSelectGame: (id: string) => void;
  onOpenTutorial: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isBgmOn: boolean;
  setIsBgmOn: (on: boolean) => void;
  isCrtFilter: boolean;
  setIsCrtFilter: (on: boolean) => void;
  bgAmbient: string;
  setBgAmbient: (id: string) => void;
  backgroundAmbients: BackgroundAmbient[];
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  isFocusMode: boolean;
  setIsFocusMode: (on: boolean) => void;
}

export const QuickArcadeSettings: React.FC<QuickArcadeSettingsProps> = React.memo(({
  isOpen,
  onClose,
  activeGame,
  games,
  recentlyPlayedIds,
  onSelectGame,
  onOpenTutorial,
  isMuted,
  onToggleMute,
  isBgmOn,
  setIsBgmOn,
  isCrtFilter,
  setIsCrtFilter,
  bgAmbient,
  setBgAmbient,
  backgroundAmbients,
  isFullscreen,
  toggleFullscreen,
  isFocusMode,
  setIsFocusMode,
}) => {
  if (!isOpen) return null;

  // Filter out current game from game lists
  const otherGames = games.filter(g => g.id !== activeGame.id);

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      id="quick-arcade-settings-overlay"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-sm h-full bg-[#080a0f] border-l border-white/[0.08] shadow-2xl flex flex-col relative select-none animate-in slide-in-from-right duration-200"
        id="quick-arcade-settings-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06] bg-[#0c0f17]">
          <div className="flex items-center gap-2">
            <Gamepad2 className="text-indigo-400" size={18} />
            <span className="font-bold font-mono text-sm tracking-wider text-zinc-100">KONTROL CABINET</span>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            id="close-arcade-settings-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
          
          {/* Audio Section */}
          <div className="space-y-2.5">
            <h3 className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest">AUDIO & EFEK</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  audio.playCoin();
                  onToggleMute();
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  isMuted 
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                    : 'bg-white/[0.03] border-white/[0.08] text-zinc-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                <span className="text-xs font-medium">{isMuted ? 'Mute On' : 'Mute Off'}</span>
              </button>

              <button
                onClick={() => {
                  audio.playCoin();
                  setIsBgmOn(!isBgmOn);
                }}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  isBgmOn 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:bg-white/[0.06]'
                }`}
              >
                <Music size={18} className={isBgmOn ? 'animate-pulse' : ''} />
                <span className="text-xs font-medium">BGM {isBgmOn ? 'Aktif' : 'Mati'}</span>
              </button>
            </div>
          </div>

          {/* Video & Theme Section */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest">TAMPILAN & GRAFIS</h3>
            <div className="space-y-2.5">
              
              {/* CRT Toggle */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Tv size={16} className="text-cyan-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-200">CRT Retro Filter</span>
                    <span className="text-[10px] text-zinc-500">Efek layar kaca jadul</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    audio.playCoin();
                    setIsCrtFilter(!isCrtFilter);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isCrtFilter ? 'bg-indigo-600' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isCrtFilter ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Theater Mode Toggle */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div className="flex items-center gap-2.5">
                  {isFocusMode ? <EyeOff size={16} className="text-amber-400" /> : <Eye size={16} className="text-indigo-400" />}
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-200">Focus Mode</span>
                    <span className="text-[10px] text-zinc-500">Hanya tampilkan game</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    audio.playCoin();
                    setIsFocusMode(!isFocusMode);
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isFocusMode ? 'bg-indigo-600' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isFocusMode ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Fullscreen Toggle */}
              <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Maximize size={16} className="text-teal-400" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-zinc-200">Layar Penuh</span>
                    <span className="text-[10px] text-zinc-500">Gunakan seluruh layar</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    audio.playCoin();
                    toggleFullscreen();
                  }}
                  className={`px-3 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-xs font-medium text-zinc-200 active:scale-95 transition-all cursor-pointer`}
                >
                  {isFullscreen ? 'Keluar' : 'Aktifkan'}
                </button>
              </div>

              {/* Background Ambient Selector */}
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Compass size={15} className="text-indigo-400" />
                  <span className="text-xs font-medium text-zinc-200">Glow Ambient Cabinet</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {backgroundAmbients.map((amb) => (
                    <button
                      key={amb.id}
                      onClick={() => {
                        audio.playCoin();
                        setBgAmbient(amb.id);
                      }}
                      className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                        bgAmbient === amb.id 
                          ? 'border-white scale-110 ring-2 ring-indigo-500/50' 
                          : 'border-white/10 hover:border-white/40'
                      }`}
                      style={{ backgroundColor: amb.color }}
                      title={amb.name}
                      aria-label={amb.name}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Play Guide */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest">PANDUAN</h3>
            <button
              onClick={() => {
                audio.playCoin();
                onOpenTutorial();
                onClose();
              }}
              className="w-full p-3 bg-indigo-600/10 hover:bg-indigo-600/15 border border-indigo-500/20 rounded-xl text-xs font-medium text-indigo-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <HelpCircle size={15} />
              <span>Cara Bermain & Kontrol Tombol</span>
            </button>
          </div>

          {/* Quick Game Switcher */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-bold font-mono text-zinc-500 uppercase tracking-widest">KABIN GAME LAINNYA</h3>
            </div>
            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
              {otherGames.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    audio.playCoin();
                    onSelectGame(g.id);
                    onClose();
                  }}
                  className="w-full p-2 bg-white/[0.01] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] rounded-lg flex items-center justify-between transition-all cursor-pointer text-left group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{g.icon}</span>
                    <div className="min-w-0 flex flex-col">
                      <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">{g.title}</span>
                      <span className="text-[9px] text-zinc-500 truncate">{g.genre}</span>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.06] bg-[#0c0f17] flex items-center justify-between">
          <span className="text-[9px] font-mono text-zinc-600 uppercase">ZiGame Cabinet OS v2.0</span>
          <span className="text-[9px] font-mono text-indigo-500/60 font-bold uppercase tracking-wider">RETRO ARCADE</span>
        </div>
      </div>
    </div>
  );
});
