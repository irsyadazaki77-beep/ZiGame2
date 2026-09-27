import React from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  Settings,
  Users
} from 'lucide-react';
import { GameStats } from '../../types';
import { audio } from '../../utils/audio';

interface GamePageHeaderProps {
  activeGame: GameStats;
  onRestart: () => void;
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const GamePageHeader: React.FC<GamePageHeaderProps> = React.memo(({
  activeGame,
  onRestart,
  onNavigateHome,
  onOpenSettings,
  isSidebarOpen,
  setIsSidebarOpen,
}) => {
  return (
    <div 
      className="relative flex-none h-12 sm:h-14 w-full z-40 flex items-center justify-between px-3 sm:px-4 bg-zinc-950/95 backdrop-blur-md border-b border-white/[0.06] shadow-sm select-none"
      id="arcade-top-navbar"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Left: Back & Game Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => { audio.playCoin(); onNavigateHome(); }}
          className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] cursor-pointer"
          aria-label="Kembali ke Lobi"
          title="Kembali ke Lobi"
          id="back-to-lobby-btn"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="w-px h-4 sm:h-5 bg-white/[0.08]"></div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <span className="text-base sm:text-lg shrink-0" aria-hidden="true">{activeGame.icon}</span>
          <div className="flex flex-col min-w-0">
            <h1 className="font-semibold text-xs sm:text-sm text-zinc-100 leading-tight truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">
              {activeGame.title}
            </h1>
            <span className="text-[9px] sm:text-[10px] text-zinc-400 font-normal leading-none mt-0.5 truncate">
              {activeGame.genre || 'Arcade'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Highly Consolidated Action Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Quick Restart */}
        <button
          onClick={onRestart}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border border-white/[0.08] bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] cursor-pointer"
          title="Restart Game"
          aria-label="Restart Game"
          id="quick-restart-btn"
        >
          <RefreshCw size={14} />
        </button>

        {/* Community Sidebar Toggle (Only on larger screens or sidebar toggleable) */}
        <button
          onClick={() => { audio.playCoin(); setIsSidebarOpen(prev => !prev); }}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border flex items-center justify-center transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] cursor-pointer ${
            isSidebarOpen
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
              : 'bg-zinc-900 border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.08]'
          }`}
          title="Buka Chat & Skor Komunitas"
          aria-label="Toggle Komunitas"
          id="header-sidebar-toggle-btn"
        >
          <Users size={14} />
        </button>

        {/* Cabinet Control settings trigger */}
        <button
          onClick={() => { audio.playCoin(); onOpenSettings(); }}
          className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl border border-white/[0.08] bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all duration-150 ease-out hover:scale-[1.03] active:scale-[0.97] cursor-pointer shadow-md shadow-indigo-950/40"
          title="Kontrol Cabinet & Pengaturan"
          aria-label="Pengaturan"
          id="header-settings-btn"
        >
          <Settings size={14} className="animate-spin-slow" />
          <span className="hidden xs:inline">Cabinet</span>
        </button>
      </div>
    </div>
  );
});
