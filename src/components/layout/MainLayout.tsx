import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Gamepad2, Trophy, Target, Award, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameContext } from '../../contexts/GameContext';
import { formatNumber } from '../../utils/format';
import { storageService } from '../../services/storageService';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isGamePage = location.pathname.startsWith('/game/');

  const navItems = [
    { path: '/', label: 'HOME', icon: Gamepad2 },
    { path: '/games', label: 'GAMES', icon: Trophy },
    { path: '/challenges', label: 'CHALLENGES', icon: Target },
    { path: '/leaderboard', label: 'LEADERBOARD', icon: Award },
    { path: '/profile', label: 'PROFILE', icon: User },
  ];

  const { profile } = useGameContext();
  const [systemTime, setSystemTime] = useState<string>('');
  const [securityToast, setSecurityToast] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('id-ID', { hour12: false }));
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
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#06080F] text-zinc-100 font-sans antialiased overflow-hidden selection:bg-indigo-500/30">
      
      {/* Session Autolock Warning */}
      <AnimatePresence>
        {securityToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-4 left-1/2 z-50 bg-red-950/90 border border-red-500/50 text-red-200 px-6 py-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <div className="text-sm font-medium">Sesi tidak aktif. Mengunci otomatis demi keamanan...</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col h-[100dvh] relative ${isGamePage ? 'lg:pl-0 pb-0' : 'lg:pl-64 pb-20 lg:pb-0'}`}>
        
        {/* Top Navbar */}
        {!isGamePage && (
          <header className="sticky top-0 z-40 bg-[#06080F]/80 backdrop-blur-xl border-b border-white/[0.04] p-4 h-16 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold tracking-tight text-white">NEONPLAY</span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1 bg-[#121622] border border-white/[0.06] p-1 rounded-xl shadow-inner">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition-all duration-300 ${
                      isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute inset-0 bg-white/[0.06] rounded-lg border border-white/10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center gap-4">
              {/* Header Profile / Economy */}
              <div className="flex items-center gap-3 bg-[#121622] border border-white/[0.04] rounded-full p-1.5 pr-4 shadow-sm">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 shadow-inner">
                  <span className="text-sm font-bold text-white shadow-sm">
                    {profile.avatar}
                  </span>
                </div>
                <div className="flex flex-col hidden sm:flex">
                  <span className="text-xs font-bold text-zinc-100 truncate max-w-[100px]">{profile.name}</span>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {formatNumber(profile.coins)} COINS
                  </div>
                </div>
              </div>
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
        <aside className="hidden lg:flex flex-col w-64 h-screen fixed left-0 top-0 bg-[#0A0D14] border-r border-white/[0.04] z-50">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="font-extrabold tracking-tight text-xl text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
                NEONPLAY
              </span>
            </div>

            <div className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 ${
                      isActive 
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : ''}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto p-6 space-y-4">
            <button 
              onClick={() => navigate('/shop')}
              className="w-full relative overflow-hidden group rounded-xl p-4 border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/40 to-indigo-950/40 hover:from-fuchsia-900/40 hover:to-indigo-900/40 transition-colors"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <div className="flex items-center justify-between mb-1 relative z-10">
                <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider">NEON STORE</span>
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
              </div>
              <div className="text-sm font-medium text-zinc-300 relative z-10">Beli Avatar & Tema</div>
            </button>
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 px-2">
              <span>SYS.TIME</span>
              <span className="text-zinc-400">{systemTime}</span>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Bottom Navigation */}
      {!isGamePage && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-[#0A0D14]/90 backdrop-blur-xl border-t border-white/[0.04] z-50 px-2 flex items-center justify-around pb-safe">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center justify-center w-16 h-14"
              >
                <div className={`relative flex items-center justify-center transition-transform duration-300 ${isActive ? '-translate-y-1' : ''}`}>
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-glow"
                      className="absolute inset-0 bg-indigo-500/20 rounded-full blur-md"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className={`w-6 h-6 relative z-10 transition-colors duration-300 ${
                    isActive ? 'text-indigo-400' : 'text-zinc-600'
                  }`} />
                </div>
                <span className={`text-[9px] font-bold mt-1 tracking-wide transition-colors duration-300 ${
                  isActive ? 'text-indigo-400' : 'text-zinc-600'
                }`}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div 
                    layoutId="mobile-nav-indicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-indigo-500" 
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
