import React from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  Minimize2, 
  Maximize2, 
  Users,
  HelpCircle
} from 'lucide-react';
import { GameStats } from '../../types';
import { audio } from '../../utils/audio';
import { AudioSettingsPopover } from './AudioSettingsPopover';

export interface BackgroundAmbient {
  id: string;
  name: string;
  class: string;
  color: string;
}

interface GamePageHeaderProps {
  activeGame: GameStats;
  currentAmbient: BackgroundAmbient;
  backgroundAmbients: BackgroundAmbient[];
  bgAmbient: string;
  setBgAmbient: (id: string) => void;
  isCrtFilter: boolean;
  setIsCrtFilter: React.Dispatch<React.SetStateAction<boolean>>;
  onRestart: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isBgmOn: boolean;
  setIsBgmOn: React.Dispatch<React.SetStateAction<boolean>>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigateHome: () => void;
  onOpenTutorial: () => void;
}

export const GamePageHeader: React.FC<GamePageHeaderProps> = ({
  activeGame,
  backgroundAmbients,
  bgAmbient,
  setBgAmbient,
  isCrtFilter,
  setIsCrtFilter,
  onRestart,
  isMuted,
  onToggleMute,
  isBgmOn,
  setIsBgmOn,
  isFullscreen,
  toggleFullscreen,
  isSidebarOpen,
  setIsSidebarOpen,
  onNavigateHome,
  onOpenTutorial,
}) => {
  return (
    <div 
      className="flex-none h-14 md:h-16 z-40 flex items-center justify-between px-4 md:px-6 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 shadow-md select-none"
      id="arcade-top-navbar"
    >
      {/* Left: Back & Game Info */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { audio.playCoin(); onNavigateHome(); }}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors cursor-pointer"
          aria-label="Kembali ke Lobi"
          title="Kembali ke Lobi"
          id="back-to-lobby-btn"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="w-px h-5 bg-zinc-800"></div>

        <div className="flex items-center gap-2.5">
          <span className="text-2xl shrink-0" aria-hidden="true">{activeGame.icon}</span>
          <div className="flex flex-col">
            <h1 className="font-display font-black text-xs md:text-sm tracking-wider uppercase text-zinc-100">
              {activeGame.title}
            </h1>
            <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest leading-none mt-0.5">
              {activeGame.genre || 'Arcade'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Uncluttered Clean Action Controls */}
      <div className="flex items-center gap-2">
        {/* Tutorial Guide Button */}
        <button
          onClick={() => { audio.playCoin(); onOpenTutorial(); }}
          className="px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 font-mono font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          title="Panduan Cara Bermain"
          aria-label="Panduan Cara Bermain"
          id="header-tutorial-btn"
        >
          <HelpCircle size={14} className="text-indigo-400" />
          <span className="hidden sm:inline">Panduan</span>
        </button>

        {/* Quick Restart */}
        <button
          onClick={onRestart}
          className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Restart Game"
          aria-label="Restart Game"
          id="quick-restart-btn"
        >
          <RefreshCw size={15} />
        </button>

        {/* Unified Audio & Display Popover */}
        <AudioSettingsPopover
          isMuted={isMuted}
          onToggleMute={onToggleMute}
          isBgmOn={isBgmOn}
          setIsBgmOn={setIsBgmOn}
          isCrtFilter={isCrtFilter}
          setIsCrtFilter={setIsCrtFilter}
          bgAmbient={bgAmbient}
          setBgAmbient={setBgAmbient}
          backgroundAmbients={backgroundAmbients}
        />

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-900 hidden sm:flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Layar Penuh"
          aria-label="Toggle Layar Penuh"
          id="header-fullscreen-btn"
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {/* Community / Leaderboard Drawer Toggle */}
        <button
          onClick={() => { audio.playCoin(); setIsSidebarOpen(prev => !prev); }}
          className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs hidden lg:flex items-center gap-1.5 transition cursor-pointer ${
            isSidebarOpen
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
          }`}
          title="Tutup/Buka Komunitas & Leaderboard"
          aria-label="Toggle Komunitas"
          id="header-sidebar-toggle-btn"
        >
          <Users size={14} />
          <span>Komunitas</span>
        </button>
      </div>
    </div>
  );
};
