import { useToast } from './utils/ToastContext';
import { formatNumber } from "./utils/format";
import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Trophy, Target, Award, User, Sparkles } from 'lucide-react';
import { audio } from './utils/audio';
import { PlayerProfile as ProfileType, GameStats, Achievement } from './types';

// Pages
const Home = React.lazy(() => import('./pages/Home'));
const GamesPage = React.lazy(() => import('./pages/GamesPage'));
const ChallengesPage = React.lazy(() => import('./pages/ChallengesPage'));
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const GamePage = React.lazy(() => import('./pages/GamePage'));
const Shop = React.lazy(() => import('./pages/Shop'));

import { auth, onAuthStateChanged, isFirebaseReady } from './services/firebase';
import { syncDataToCloud, fetchCloudData } from './services/sync';

// Data & Config
import { INITIAL_GAMES } from './data/games';
import { INITIAL_ACHIEVEMENTS } from './data/achievements';

// Hooks & Error Boundary
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { usePlayerProfile } from './hooks/usePlayerProfile';
import { useGameProgress } from './hooks/useGameProgress';
import { storageService } from './services/storageService';

export default function App() {
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

  const { showToast } = useToast();

  // Separated states
  const { profile, setProfile, handleUpdateProfile } = usePlayerProfile();
  
  const {
    games,
    setGames,
    achievements,
    setAchievements,
    dailyMissions,
    setDailyMissions,
    recentlyPlayed,
    setRecentlyPlayed,
    clearRecentlyPlayed,
    handleSelectGame,
    handleScoreUpdate,
    handleGameOver,
    handleResetStats,
  } = useGameProgress(profile, handleUpdateProfile, showToast);

  // HUD and Toast Elements
  const [systemTime, setSystemTime] = useState<string>('');
  const [securityToast, setSecurityToast] = useState(false);

  useEffect(() => {
    if (profile.settings?.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }, [profile.settings?.reducedMotion]);

  // Firebase Auth listener
  useEffect(() => {
    if (!isFirebaseReady() || !auth) return;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log("User logged in:", user.uid);
        const cloudData = await fetchCloudData();
        if (cloudData) {
          if (cloudData.profile) setProfile(cloudData.profile);
          if (cloudData.games) {
            const mergedGames = INITIAL_GAMES.map(initialGame => {
              const found = cloudData.games.find((g: GameStats) => g.id === initialGame.id);
              return found ? { ...initialGame, plays: found.plays, highScore: found.highScore } : initialGame;
            });
            setGames(mergedGames);
          }
          if (cloudData.achievements) {
            const mergedAchievements = INITIAL_ACHIEVEMENTS.map(initialAch => {
              const found = cloudData.achievements.find((a: Achievement) => a.id === initialAch.id);
              return found ? { ...initialAch, unlocked: found.unlocked, unlockedAt: found.unlockedAt } : initialAch;
            });
            setAchievements(mergedAchievements);
          }
          if (cloudData.missions) setDailyMissions(cloudData.missions);
          if (cloudData.recentlyPlayed) {
            setRecentlyPlayed(cloudData.recentlyPlayed);
          }
          showToast('Sinkronisasi Sukses', 'Data berhasil dimuat dari cloud.', 'success', '☁️');
        } else {
          // New user, sync current local data to cloud
          syncDataToCloud(profile, games, achievements, dailyMissions, recentlyPlayed);
        }
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Sync to cloud whenever important data changes, debounced
  useEffect(() => {
    if (isFirebaseReady() && auth?.currentUser) {
      const timer = setTimeout(() => {
        syncDataToCloud(profile, games, achievements, dailyMissions, recentlyPlayed);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [profile, games, achievements, dailyMissions, recentlyPlayed]);

  // Tick the clock on mount
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('id-ID', { hour12: false }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // Session Auto-Lock (Idle Detection Security)
  useEffect(() => {
    let idleTimeout: NodeJS.Timeout | null = null;

    const resetIdleTimer = () => {
      if (idleTimeout) clearTimeout(idleTimeout);

      const autolockSetting = storageService.getSessionAutolock();
      const activeUser = storageService.getActiveUser();

      if (activeUser && autolockSetting !== 'off') {
        const timeoutMs = parseInt(autolockSetting) * 60 * 1000;
        idleTimeout = setTimeout(() => {
          audio.playGameOver();
          handleLogout();
          setSecurityToast(true);
          setTimeout(() => setSecurityToast(false), 6000);
        }, timeoutMs);
      }
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetIdleTimer));

    resetIdleTimer();

    return () => {
      if (idleTimeout) clearTimeout(idleTimeout);
      events.forEach(event => window.removeEventListener(event, resetIdleTimer));
    };
  }, [profile]);

  // Removed neon exploding particles click listener to make UI cleaner

  const handleLoginSuccess = (userProfile: ProfileType, userGames: GameStats[], userAchievements: Achievement[], userRecentlyPlayed: any[]) => {
    setProfile(userProfile);
    let gamesToSave = INITIAL_GAMES;
    if (userGames && userGames.length > 0) {
      gamesToSave = INITIAL_GAMES.map(initialGame => {
        const found = userGames.find((g: GameStats) => g.id === initialGame.id);
        return found ? { ...initialGame, plays: found.plays, highScore: found.highScore } : initialGame;
      });
      setGames(gamesToSave);
    }
    
    let achievementsToSave = INITIAL_ACHIEVEMENTS;
    if (userAchievements && userAchievements.length > 0) {
      achievementsToSave = INITIAL_ACHIEVEMENTS.map(initialAch => {
        const found = userAchievements.find((a: Achievement) => a.id === initialAch.id);
        return found ? { ...initialAch, unlocked: found.unlocked, unlockedAt: found.unlockedAt } : initialAch;
      });
      setAchievements(achievementsToSave);
    }
    
    if (userRecentlyPlayed) {
      setRecentlyPlayed(userRecentlyPlayed);
      storageService.saveRecentlyPlayed(userRecentlyPlayed);
    }
    
    storageService.saveProfile(userProfile);
    storageService.saveGamesStats(gamesToSave);
    storageService.saveAchievements(achievementsToSave);
    
    navigate('/');
  };

  const handleLogout = () => {
    const guestProfile: ProfileType = {
      name: 'ARKADE_X',
      avatar: '👾',
      colorTheme: '#6366f1',
      coins: 0,
    };
    setProfile(guestProfile);
    setGames(INITIAL_GAMES);
    setAchievements(INITIAL_ACHIEVEMENTS);
    setRecentlyPlayed([]);
    
    storageService.saveProfile(guestProfile);
    storageService.saveGamesStats(INITIAL_GAMES);
    storageService.saveAchievements(INITIAL_ACHIEVEMENTS);
    storageService.saveRecentlyPlayed([]);
    storageService.clearActiveUser();
    
    navigate('/');
  };

  const totalPlays = games.reduce((sum, g) => sum + g.plays, 0);

  return (
    <AppErrorBoundary>
    <div className={`${isGamePage ? "h-[100dvh] overflow-hidden" : "min-h-screen"} bg-[#080a0f] text-zinc-100 font-sans flex flex-col relative overflow-x-hidden selection:bg-indigo-600 selection:text-white`}>
      {/* Background subtle grid and ambient lighting */}
      <div className="absolute inset-0 bg-grid-subtle opacity-60 pointer-events-none z-0"></div>
      <div 
        className="absolute top-0 inset-x-0 h-[400px] pointer-events-none transition-all duration-1000 z-0 opacity-20"
        style={{
          background: `radial-gradient(circle at 50% -20%, ${profile.colorTheme || '#6366f1'} 0%, transparent 70%)`
        }}
      />

      {/* Desktop & Tablet Top Header */}
      {!isGamePage && (
        <header 
          className="sticky top-0 z-40 w-full bg-[#0b0e15]/90 backdrop-blur-md border-b border-white/[0.07] transition-colors"
        >
          <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl h-16 flex justify-between items-center gap-4">
            {/* Logo */}
            <div 
              className="flex items-center gap-3 cursor-pointer select-none group shrink-0" 
              onClick={() => { audio.playCoin(); navigate('/'); }}
            >
              <div 
                className="w-10 h-10 rounded-xl bg-zinc-900/90 border border-white/10 flex items-center justify-center relative overflow-hidden transition-all duration-300 group-hover:border-indigo-500/50 group-hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              >
                <Gamepad2 size={20} style={{ color: profile.colorTheme || '#6366f1' }} className="transition-transform group-hover:scale-110" />
              </div>
              <div className="flex flex-col">
                <div className="font-display font-black text-base sm:text-lg tracking-wider text-white leading-tight">
                  ZI<span style={{ color: profile.colorTheme || '#6366f1' }}>GAME</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest leading-none">
                  ARCADE V2.5
                </span>
              </div>
            </div>

            {/* Center Desktop Navigation Tabs */}
            <nav className="hidden lg:flex items-center gap-1 bg-[#121622] border border-white/[0.06] p-1 rounded-xl shadow-inner">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    aria-label={item.label}
                    onClick={() => { audio.playCoin(); navigate(item.path); }}
                    className={`relative px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all duration-200 flex items-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                      isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeHeaderTab"
                        className="absolute inset-0 rounded-lg -z-10 bg-indigo-600/15 border border-indigo-500/30"
                        style={{
                          backgroundColor: `${profile.colorTheme || '#6366f1'}18`,
                          borderColor: `${profile.colorTheme || '#6366f1'}40`
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <Icon size={14} style={{ color: isActive ? (profile.colorTheme || '#6366f1') : undefined }} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Quick Stats & User Widget */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {/* Daily Streak */}
              {profile.streak !== undefined && profile.streak > 0 && (
                <div 
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121622] border border-orange-500/20 text-orange-400 font-mono text-xs font-bold shadow-sm"
                  title={`Streak Bermain: ${profile.streak} Hari Berturut-turut`}
                >
                  <span>🔥</span>
                  <span>{profile.streak} <span className="text-[10px] text-zinc-500 font-normal uppercase">Hari</span></span>
                </div>
              )}

              {/* Coins Wallet */}
              <div 
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#121622] border border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition-colors"
                onClick={() => { audio.playCoin(); navigate('/shop'); }}
                title="Buka Toko Kosmetik & Hadiah"
              >
                <span className="text-sm">🪙</span>
                <span className="text-xs sm:text-sm font-mono font-bold text-amber-400">
                  {formatNumber(profile.coins)}
                </span>
              </div>

              {/* User Avatar Button */}
              <div 
                className="flex items-center gap-2 p-1 pr-2.5 rounded-full bg-[#121622] border border-white/10 hover:border-white/20 cursor-pointer transition-all active:scale-95" 
                title={`Profil: ${profile.name}`}
                onClick={() => { audio.playCoin(); navigate('/profile'); }}
              >
                <div 
                  className="w-7 h-7 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-sm shadow-sm"
                  style={{ borderColor: profile.colorTheme || '#6366f1' }}
                >
                  {profile.avatar}
                </div>
                <span className="hidden md:inline text-xs font-mono font-bold text-zinc-300 max-w-[90px] truncate">
                  {profile.name}
                </span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 w-full flex flex-col relative ${!isGamePage ? 'pb-24 lg:pb-8' : ''}`}>
        <React.Suspense fallback={
          <div className="h-[60vh] w-full flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Memuat ZiGame...</span>
          </div>
        }>
          <Routes location={location} key={location.pathname}>
            <Route 
              path="/" 
              element={
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
                  <Home 
                    games={games}
                    dailyMissions={dailyMissions} 
                    achievements={achievements} 
                    profile={profile} 
                    totalPlays={totalPlays} 
                    recentlyPlayed={recentlyPlayed}
                    onClearRecentlyPlayed={clearRecentlyPlayed}
                    onSelectGame={handleSelectGame}
                    onUpdateProfile={handleUpdateProfile}
                  />
                </div>
              } 
            />
            <Route 
              path="/games" 
              element={
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
                  <GamesPage 
                    games={games}
                    onSelectGame={handleSelectGame}
                  />
                </div>
              } 
            />
            <Route 
              path="/challenges" 
              element={
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
                  <ChallengesPage 
                    profile={profile}
                    games={games}
                    dailyMissions={dailyMissions}
                    onUpdateProfile={handleUpdateProfile}
                  />
                </div>
              } 
            />
            <Route 
              path="/leaderboard" 
              element={
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
                  <LeaderboardPage 
                    games={games}
                    currentUsername={profile.name}
                  />
                </div>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
                  <ProfilePage 
                    profile={profile}
                    games={games}
                    achievements={achievements}
                    recentlyPlayed={recentlyPlayed}
                    totalPlays={totalPlays}
                    onUpdateProfile={handleUpdateProfile}
                    onResetStats={handleResetStats}
                    onLogout={handleLogout}
                    onLoginSuccess={handleLoginSuccess}
                    onClearRecentlyPlayed={clearRecentlyPlayed}
                    onSelectGame={handleSelectGame}
                  />
                </div>
              } 
            />
            <Route 
              path="/shop" 
              element={
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl">
                  <Shop 
                    profile={profile}
                    onUpdateProfile={handleUpdateProfile}
                  />
                </div>
              } 
            />
            <Route 
              path="/game/:gameId" 
              element={
                <GamePage 
                  games={games} 
                  profile={profile}
                  dailyMissions={dailyMissions}
                  onScoreUpdate={handleScoreUpdate}
                  onGameOver={handleGameOver}
                />
              } 
            />
            {/* Fallback Legacy Routes redirecting to unified hubs */}
            <Route path="/quests" element={<div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl"><ChallengesPage profile={profile} games={games} dailyMissions={dailyMissions} onUpdateProfile={handleUpdateProfile} /></div>} />
            <Route path="/stats" element={<div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl"><ProfilePage profile={profile} games={games} achievements={achievements} recentlyPlayed={recentlyPlayed} totalPlays={totalPlays} onUpdateProfile={handleUpdateProfile} onResetStats={handleResetStats} onLogout={handleLogout} onLoginSuccess={handleLoginSuccess} onClearRecentlyPlayed={clearRecentlyPlayed} onSelectGame={handleSelectGame} /></div>} />
            <Route path="/login" element={<div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl"><ProfilePage profile={profile} games={games} achievements={achievements} recentlyPlayed={recentlyPlayed} totalPlays={totalPlays} onUpdateProfile={handleUpdateProfile} onResetStats={handleResetStats} onLogout={handleLogout} onLoginSuccess={handleLoginSuccess} onClearRecentlyPlayed={clearRecentlyPlayed} onSelectGame={handleSelectGame} /></div>} />
            <Route path="/settings" element={<div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-7xl"><ProfilePage profile={profile} games={games} achievements={achievements} recentlyPlayed={recentlyPlayed} totalPlays={totalPlays} onUpdateProfile={handleUpdateProfile} onResetStats={handleResetStats} onLogout={handleLogout} onLoginSuccess={handleLoginSuccess} onClearRecentlyPlayed={clearRecentlyPlayed} onSelectGame={handleSelectGame} /></div>} />
          </Routes>
        </React.Suspense>
      </main>

      {/* Clean Desktop Footer */}
      {!isGamePage && (
        <footer className="hidden lg:flex h-14 bg-[#0b0e15]/80 backdrop-blur-md border-t border-white/[0.06] px-6 text-xs text-zinc-500 font-mono items-center justify-between mt-auto relative z-20">
          <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                Server Online
              </span>
              <span className="text-zinc-700">•</span>
              <span>12,402 Arkader Aktif</span>
            </div>
            <div className="flex items-center gap-6 text-zinc-500">
              <span>ZiGame Engine v2.5</span>
              <span className="text-zinc-700">•</span>
              <span>© 2026 ZIGAME ARCADE</span>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Navigation Bar (5 core destinations) */}
      {!isGamePage && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[#0b0e15]/95 border-t border-white/[0.08] backdrop-blur-xl flex justify-around items-center px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-50 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                aria-label={item.label}
                onClick={() => { audio.playCoin(); navigate(item.path); }}
                className="relative flex flex-col items-center justify-center gap-1 flex-1 min-h-[48px] py-1 transition-all cursor-pointer select-none active:scale-95"
                style={{
                  color: isActive ? (profile.colorTheme || '#6366f1') : '#71717a'
                }}
              >
                <Icon size={18} />
                <span className={`text-[10px] font-mono tracking-wider uppercase ${isActive ? 'font-bold text-white' : 'text-zinc-500'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div 
                    className="w-1.5 h-1.5 rounded-full absolute bottom-0.5 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                    style={{ backgroundColor: profile.colorTheme || '#6366f1' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Security lockout toast */}
      <AnimatePresence>
        {securityToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-red-950/95 backdrop-blur-md border border-red-500/50 rounded-2xl p-4 shadow-2xl z-[100] flex items-start gap-3.5"
            id="security-lockout-toast"
          >
            <div className="p-2 bg-red-900/40 rounded-xl text-red-500 text-lg shrink-0">
              🛡️
            </div>
            <div>
              <h4 className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">
                Sesi Akun Dikunci
              </h4>
              <p className="text-xs text-zinc-300 font-sans mt-1 leading-normal">
                Sesi Anda otomatis keluar demi keamanan enkripsi data karena tidak ada aktivitas. Silakan masuk kembali.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </AppErrorBoundary>
  );
}
