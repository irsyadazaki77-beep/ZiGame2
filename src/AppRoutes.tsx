import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useGameContext } from './contexts/GameContext';
import { AdminRoute } from './components/AdminRoute';

import Home from './pages/Home';
import GamesPage from './pages/GamesPage';

// Lazy Loaded Pages with exponential backoff retry on dynamic import failure
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  delayMs = 350
) {
  return React.lazy(async () => {
    let currentDelay = delayMs;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        if (attempt === retries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay *= 1.8;
      }
    }
    return factory();
  });
}

const GamePage = lazyWithRetry(() => import('./pages/GamePage'));
const ChallengesPage = lazyWithRetry(() => import('./pages/ChallengesPage'));
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const Shop = lazyWithRetry(() => import('./pages/Shop'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));

export function AppRoutes() {
  const {
    profile,
    handleUpdateProfile,
    games,
    achievements,
    dailyMissions,
    recentlyPlayed,
    clearRecentlyPlayed,
    handleSelectGame,
    handleScoreUpdate,
    handleGameOver,
    handleResetStats,
    masteries
  } = useGameContext();

  const totalPlays = games.reduce((acc, g) => acc + g.plays, 0);

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

        {/* Legacy Route Redirects */}
        <Route path="/quests" element={<Navigate to="/challenges" replace />} />
        <Route path="/stats" element={<Navigate to="/profile" replace />} />
        <Route path="/settings" element={<Navigate to="/profile" replace />} />
        <Route path="/login" element={<Navigate to="/profile" replace />} />

        {/* Catch-All 404 Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

