import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useGameContext } from './contexts/GameContext';
import { PlayerProfile, GameStats, Achievement, RecentlyPlayedEntry } from './types';
import { useToast } from './utils/ToastContext';
import { AdminRoute } from './components/AdminRoute';

// Lazy Loaded Pages with automatic retry on dynamic import failure
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      try {
        // Retry factory import once
        return await factory();
      } catch (retryErr) {
        // Force reload if stale Vite module graph cache
        const reloadKey = 'zigame_reload_' + window.location.pathname;
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, 'true');
          window.location.reload();
        }
        throw retryErr;
      }
    }
  });
}

const Home = lazyWithRetry(() => import('./pages/Home'));
const GamesPage = lazyWithRetry(() => import('./pages/GamesPage'));
const ChallengesPage = lazyWithRetry(() => import('./pages/ChallengesPage'));
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const GamePage = lazyWithRetry(() => import('./pages/GamePage'));
const Shop = lazyWithRetry(() => import('./pages/Shop'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));

export function AppRoutes() {
  const {
    profile,
    setProfile,
    handleUpdateProfile,
    games,
    setGames,
    achievements,
    setAchievements,
    dailyMissions,
    recentlyPlayed,
    setRecentlyPlayed,
    clearRecentlyPlayed,
    handleSelectGame,
    handleScoreUpdate,
    handleGameOver,
    handleResetStats,
    masteries
  } = useGameContext();

  const { showToast } = useToast();
  const totalPlays = games.reduce((acc, g) => acc + g.plays, 0);

  const handleLogout = () => {
    window.location.reload();
  };

  const handleLoginSuccess = (
    newProfile: PlayerProfile,
    newGames: GameStats[],
    newAchievements: Achievement[],
    newRecentlyPlayed: RecentlyPlayedEntry[]
  ) => {
    setProfile(newProfile);
    setGames(newGames);
    setAchievements(newAchievements);
    setRecentlyPlayed(newRecentlyPlayed);
    showToast('Login Berhasil', 'Data kamu sudah disinkronkan.', 'success', '👋');
  };

  return (
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
      </div>
    }>
      <Routes>
        <Route 
          path="/" 
          element={
            <Home 
              profile={profile} 
              games={games} 
              onSelectGame={handleSelectGame} 
              recentlyPlayed={recentlyPlayed} 
              dailyMissions={dailyMissions} 
              achievements={achievements} 
              totalPlays={totalPlays} 
              onClearRecentlyPlayed={clearRecentlyPlayed} 
              onUpdateProfile={handleUpdateProfile} 
            />
          } 
        />
        <Route path="/games" element={<GamesPage games={games} onSelectGame={handleSelectGame} />} />
        <Route path="/challenges" element={<ChallengesPage dailyMissions={dailyMissions} profile={profile} games={games} onUpdateProfile={handleUpdateProfile} />} />
        <Route path="/leaderboard" element={<LeaderboardPage games={games} currentUsername={profile.name} />} />
        <Route path="/profile" element={
          <ProfilePage 
            profile={profile} 
            onUpdateProfile={handleUpdateProfile} 
            onResetStats={handleResetStats} 
            achievements={achievements} 
            games={games}
            recentlyPlayed={recentlyPlayed}
            totalPlays={totalPlays}
            onLogout={handleLogout}
            onLoginSuccess={handleLoginSuccess}
            onClearRecentlyPlayed={clearRecentlyPlayed}
            onSelectGame={handleSelectGame}
            masteries={masteries}
          />
        } />
        
        {/* Game Engine Route */}
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
        
        {/* Economy Route */}
        <Route
          path="/shop"
          element={<Shop profile={profile} onUpdateProfile={handleUpdateProfile} />}
        />
        
        {/* Protected Server-Authoritative Admin Route */}
        <Route 
          path="/admin" 
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } 
        />
      </Routes>
    </Suspense>
  );
}
