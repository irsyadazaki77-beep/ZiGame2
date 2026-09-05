import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Gamepad2, Trophy, Target, Award, User, Sparkles, Store, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameContext } from '../../contexts/GameContext';
import { formatNumber } from '../../utils/format';
import { storageService } from '../../services/storageService';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isGamePage = location.pathname.startsWith('/game/');

  const navItems = [
    { path: '/', label: 'Beranda', icon: Gamepad2 },
    { path: '/games', label: 'Eksplorasi', icon: Trophy },
    { path: '/challenges', label: 'Tantangan', icon: Target },
    { path: '/leaderboard', label: 'Peringkat', icon: Award },
    { path: '/shop', label: 'Toko', icon: Store },
    { path: '/profile', label: 'Profil', icon: User },
  ];

  const { profile } = useGameContext();
  const [systemTime, setSystemTime] = useState<string>('');
  const [securityToast, setSecurityToast] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    let idleTimeout: NodeJS.Timeout | null = null;
    const resetIdleTimer = () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      const autolockSetting = storageService.getSessionAutolock();
      const activeUser = storageService.getActiveUser();
      if (activeUser && autolockSetting !== 'off') {
        const timeoutMs = parseInt(autolockSetting) * 60 * 1000;
        idleTimeout = setTimeout(() => {
          setSecurityToast(true);
          storageService.clearActiveUser();
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }, timeoutMs);
      }
    };
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach(e => document.addEventListener(e, resetIdleTimer, true));
    resetIdleTimer();
    return () => {
      activityEvents.forEach(e => document.removeEventListener(e, resetIdleTimer, true));
      if (idleTimeout) clearTimeout(idleTimeout);
    };
  }, []);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#080a0f] text-zinc-100 font-sans antialiased overflow-hidden selection:bg-indigo-500/30">
      
      {/* Session Autolock Warning */}
      <AnimatePresence>
        {securityToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-50 bg-red-950/90 border border-red-500/40 text-red-200 px-5 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 text-sm font-medium"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <div>Sesi tidak aktif. Mengunci otomatis demi keamanan...</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-0 h-[100dvh] relative ${isGamePage ? 'lg:pl-0 pb-0' : 'lg:pl-60 xl:pl-64 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0'}`}>
        
        {/* Top Navbar for mobile & desktop context bar */}
        {!isGamePage && (
          <header className="sticky top-0 z-40 bg-[#080a0f]/90 backdrop-blur-xl border-b border-white/[0.06] px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between flex-none">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                  <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="font-display font-black tracking-wider text-sm sm:text-base text-white">ZIGAME</span>
              </div>
              <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
                <span className="font-mono text-zinc-400">Platform Online</span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400 font-mono">{systemTime}</span>
              </div>
            </div>

            {/* Top Right Quick Stats / Profile Header */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={() => navigate('/shop')}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#121622] hover:bg-[#181e2e] border border-white/[0.06] rounded-full transition-colors cursor-pointer text-xs"
                title="Buka Toko Kosmetik"
              >
                <span className="text-xs">🪙</span>
                <span className="text-[11px] sm:text-xs font-mono font-bold text-amber-400">
                  {formatNumber(profile.coins)}
                </span>
              </button>

              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 bg-[#121622] hover:bg-[#181e2e] border border-white/[0.06] rounded-full p-1 sm:pr-3 transition-colors cursor-pointer group"
              >
                <div 
                  className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-zinc-800 text-xs sm:text-sm shadow-inner shrink-0"
                  style={{ border: `1.5px solid ${profile.colorTheme || '#6366f1'}` }}
                >
                  {profile.avatar}
                </div>
                <div className="flex-col text-left hidden md:flex">
                  <span className="text-xs font-bold text-zinc-200 group-hover:text-white truncate max-w-[90px] lg:max-w-[110px] leading-tight">
                    {profile.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 leading-tight">
                    LVL {profile.level || 1}
                  </span>
                </div>
              </button>
            </div>
          </header>
        )}

        {/* Page Content */}
        <main className={`flex-1 overflow-x-hidden ${isGamePage ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
          {children}
        </main>
      </div>

      {/* Desktop Sidebar (Left) */}
      {!isGamePage && (
        <aside className="hidden lg:flex flex-col w-60 xl:w-64 h-screen fixed left-0 top-0 bg-[#0a0d14] border-r border-white/[0.06] z-50">
          <div className="p-4 xl:p-5 flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6 xl:mb-8 px-2">
              <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20 ring-1 ring-white/10 shrink-0">
                <Gamepad2 className="w-4 h-4 xl:w-5 xl:h-5 text-white" />
              </div>
              <div>
                <div className="font-display font-black tracking-wider text-base xl:text-lg text-white leading-none">
                  ZIGAME
                </div>
                <span className="text-[9px] xl:text-[10px] font-mono text-zinc-400 tracking-widest uppercase">
                  GAMING PLATFORM
                </span>
              </div>
            </div>

            {/* Navigation List */}
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20' 
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* User Level Card & Quick Access Footer */}
            <div className="mt-auto pt-4 space-y-3">
              {/* Level Progress Widget */}
              <div 
                onClick={() => navigate('/profile')}
                className="bg-[#121622] hover:bg-[#161c2c] border border-white/[0.06] rounded-2xl p-3 xl:p-3.5 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-zinc-300 group-hover:text-white">
                    LEVEL {profile.level || 1}
                  </span>
                  <span className="text-[10px] font-mono text-indigo-400">
                    {profile.xp || 0} XP
                  </span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (((profile.xp || 0) % 100) / 100) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Version & Security Tag */}
              <div className="flex items-center justify-between px-2 text-[10px] font-mono text-zinc-400">
                <span className="flex items-center gap-1">
                  <Shield size={11} className="text-emerald-500 shrink-0" />
                  Anti-Cheat v2
                </span>
                <span>v2.6</span>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      {!isGamePage && (
        <nav 
          aria-label="Navigasi Mobile"
          className="lg:hidden fixed bottom-0 left-0 right-0 h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-[#0a0d14]/95 backdrop-blur-xl border-t border-white/[0.06] z-50 px-1 sm:px-3 flex items-center justify-around"
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center justify-center flex-1 h-full py-1 cursor-pointer min-w-0"
              >
                <div className={`relative flex items-center justify-center transition-all duration-200 ${isActive ? '-translate-y-0.5' : ''}`}>
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-200 shrink-0 ${
                    isActive ? 'text-indigo-400' : 'text-zinc-500'
                  }`} />
                </div>
                <span className={`text-[9px] sm:text-[10px] font-medium mt-0.5 transition-colors duration-200 truncate max-w-full px-0.5 ${
                  isActive ? 'text-indigo-400 font-bold' : 'text-zinc-500'
                }`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="mobile-nav-indicator"
                    className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-400" 
                  />
                )}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
