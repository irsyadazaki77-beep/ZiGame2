import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, PanelLeft, Sparkles, Store } from 'lucide-react';
import { useGameContext } from '../../contexts/GameContext';
import { formatNumber } from '../../utils/format';

interface TopBarProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  isSidebarCollapsed, 
  onToggleSidebar 
}) => {
  const navigate = useNavigate();
  const { profile } = useGameContext();
  const [systemTime, setSystemTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    };

    updateTime();
    const clockInterval = setInterval(updateTime, 30000);
    return () => clearInterval(clockInterval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-[#080a0f]/90 backdrop-blur-xl border-b border-white/[0.06] px-3 sm:px-5 lg:px-6 h-13 sm:h-14 flex items-center justify-between flex-none pt-safe">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Brand Logo */}
        <div 
          onClick={() => navigate('/')}
          className="md:hidden flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Gamepad2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-black tracking-wider text-sm text-white">ZIGAME</span>
        </div>

        {/* Desktop / Tablet Sidebar Toggle Icon */}
        <div className="hidden md:flex items-center gap-2">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition cursor-pointer"
              title="Toggle Sidebar ([)"
              aria-label="Toggle Sidebar"
            >
              <PanelLeft size={16} />
            </button>
          )}

          <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
            <span className="text-zinc-400">Server Ready</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400 font-mono text-[11px]">{systemTime}</span>
          </div>
        </div>
      </div>

      {/* Top Right Quick Stats / Profile Header */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Shop Coin Button */}
        <button
          onClick={() => navigate('/shop')}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-[#121622] hover:bg-[#181e2e] border border-white/[0.06] rounded-full transition-colors cursor-pointer text-xs active:scale-95"
          title="Buka Toko Kosmetik"
          aria-label="Koin Toko"
        >
          <span className="text-xs">🪙</span>
          <span className="text-[11px] sm:text-xs font-mono font-bold text-amber-400">
            {formatNumber(profile.coins)}
          </span>
        </button>

        {/* User Profile Pill */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 bg-[#121622] hover:bg-[#181e2e] border border-white/[0.06] rounded-full p-1 sm:pr-3 transition-colors cursor-pointer group active:scale-95"
          aria-label="Profil Pengguna"
        >
          <div 
            className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-zinc-800 text-xs sm:text-sm shadow-inner shrink-0"
            style={{ border: `1.5px solid ${profile.colorTheme || '#6366f1'}` }}
          >
            {profile.avatar}
          </div>
          <div className="flex-col text-left hidden sm:flex">
            <span className="text-xs font-bold text-zinc-200 group-hover:text-white truncate max-w-[90px] lg:max-w-[120px] leading-tight">
              {profile.name}
            </span>
            <span className="text-[10px] font-mono text-zinc-400 leading-tight">
              LVL {profile.level || 1}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};
