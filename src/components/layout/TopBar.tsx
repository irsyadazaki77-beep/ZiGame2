import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, PanelLeft, Sparkles, Store, Sun, Moon } from 'lucide-react';
import { useGameContext } from '../../contexts/GameContext';
import { formatNumber } from '../../utils/format';
import { audio } from '../../utils/audio';

interface TopBarProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  isSidebarCollapsed, 
  onToggleSidebar 
}) => {
  const navigate = useNavigate();
  const { profile, theme, toggleTheme } = useGameContext();
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
    <header className="sticky top-0 z-40 bg-surface-base/90 backdrop-blur-xl border-b border-border-subtle px-3 sm:px-5 lg:px-6 h-13 sm:h-14 flex items-center justify-between flex-none pt-safe transition-colors duration-150">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Brand Logo */}
        <div 
          onClick={() => navigate('/')}
          className="md:hidden flex items-center gap-2 cursor-pointer select-none"
        >
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Gamepad2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-black tracking-wider text-sm text-text-primary">ZIGAME</span>
        </div>

        {/* Desktop / Tablet Sidebar Toggle Icon */}
        <div className="hidden md:flex items-center gap-2">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg bg-surface-subtle hover:bg-surface-card-hover text-text-secondary hover:text-text-primary transition cursor-pointer"
              title="Toggle Sidebar ([)"
              aria-label="Toggle Sidebar"
            >
              <PanelLeft size={16} />
            </button>
          )}

          <div className="flex items-center gap-2 text-xs text-text-secondary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
            <span className="text-text-secondary">Server Ready</span>
            <span className="text-text-muted">•</span>
            <span className="text-text-secondary font-mono text-[11px]">{systemTime}</span>
          </div>
        </div>
      </div>

      {/* Top Right Quick Stats / Profile Header */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Toggle Theme Button */}
        <button
          onClick={() => { audio.playCoin(); toggleTheme(); }}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-subtle border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-card-hover transition-all duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden"
          title={theme === 'light' ? 'Beralih ke Tema Gelap' : 'Beralih ke Tema Terang'}
          aria-label="Ganti Tema Visual"
        >
          {theme === 'light' ? <Moon size={14} className="text-zinc-600 dark:text-zinc-300" /> : <Sun size={14} className="text-amber-400" />}
        </button>

        {/* Shop Coin Button */}
        <button
          onClick={() => navigate('/shop')}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-surface-subtle hover:bg-surface-card-hover border border-border-subtle rounded-full transition-colors cursor-pointer text-xs active:scale-95"
          title="Buka Toko Kosmetik"
          aria-label="Koin Toko"
        >
          <span className="text-xs">🪙</span>
          <span className="text-[11px] sm:text-xs font-mono font-bold text-amber-500">
            {formatNumber(profile.coins)}
          </span>
        </button>

        {/* User Profile Pill */}
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 bg-surface-subtle hover:bg-surface-card-hover border border-border-subtle rounded-full p-1 sm:pr-3 transition-colors cursor-pointer group active:scale-95 text-text-primary"
          aria-label="Profil Pengguna"
        >
          <div 
            className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-surface-base text-xs sm:text-sm shadow-inner shrink-0"
            style={{ border: `1.5px solid ${profile.colorTheme || '#6366f1'}` }}
          >
            {profile.avatar}
          </div>
          <div className="flex-col text-left hidden sm:flex">
            <span className="text-xs font-bold text-text-primary group-hover:text-accent-primary transition truncate max-w-[90px] lg:max-w-[120px] leading-tight">
              {profile.name}
            </span>
            <span className="text-[10px] font-mono text-text-secondary leading-tight">
              LVL {profile.level || 1}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};
