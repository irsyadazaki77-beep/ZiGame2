import React, { Suspense, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useGameContext } from './contexts/GameContext';
import { AdminRoute } from './components/AdminRoute';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { lazyWithRetry } from './utils/lazyWithRetry';

const Home = lazyWithRetry(() => import('./pages/Home'));
const GamesPage = lazyWithRetry(() => import('./pages/GamesPage'));
const GamePage = lazyWithRetry(() => import('./pages/GamePage'));
const ChallengesPage = lazyWithRetry(() => import('./pages/ChallengesPage'));
const LeaderboardPage = lazyWithRetry(() => import('./pages/LeaderboardPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const Shop = lazyWithRetry(() => import('./pages/Shop'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));

function PageLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
    </div>
  );
}

function HomeRoute() {
  const {
    profile,
    handleUpdateProfile,
    games,
    achievements,
    dailyMissions,
    recentlyPlayed,
    clearRecentlyPlayed,
    handleSelectGame
  } = useGameContext();

  const totalPlays = useMemo(() => games.reduce((acc, g) => acc + g.plays, 0), [games]);

  return (
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
  );
}

function GamesRoute() {
  const { games, handleSelectGame } = useGameContext();
  return <GamesPage games={games} onSelectGame={handleSelectGame} />;
}

function ChallengesRoute() {
  const { dailyMissions, profile, games, handleUpdateProfile } = useGameContext();
  return (
    <ChallengesPage
      dailyMissions={dailyMissions}
      profile={profile}
      games={games}
      onUpdateProfile={handleUpdateProfile}
    />
  );
}

function LeaderboardRoute() {
  const { games, profile } = useGameContext();
  return <LeaderboardPage games={games} currentUsername={profile.name} />;
}

function ProfileRoute() {
  const {
    profile,
    handleUpdateProfile,
    handleResetStats,
    achievements,
    games,
    recentlyPlayed,
    clearRecentlyPlayed,
    handleSelectGame,
    masteries
  } = useGameContext();

  const totalPlays = useMemo(() => games.reduce((acc, g) => acc + g.plays, 0), [games]);

  return (
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
  );
}

function GamePageRoute() {
  const { games, profile, dailyMissions, handleScoreUpdate, handleGameOver } = useGameContext();
  return (
    <GamePage
      games={games}
      profile={profile}
      dailyMissions={dailyMissions}
      onScoreUpdate={handleScoreUpdate}
      onGameOver={handleGameOver}
    />
  );
}

function ShopRoute() {
  const { profile, handleUpdateProfile } = useGameContext();
  return <Shop profile={profile} onUpdateProfile={handleUpdateProfile} />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route
          path="/"
          element={
            <AppErrorBoundary>
              <HomeRoute />
            </AppErrorBoundary>
          }
        />
        <Route
          path="/games"
          element={
            <AppErrorBoundary>
              <GamesRoute />
            </AppErrorBoundary>
          }
        />
        <Route
          path="/challenges"
          element={
            <AppErrorBoundary>
              <ChallengesRoute />
            </AppErrorBoundary>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <AppErrorBoundary>
              <LeaderboardRoute />
            </AppErrorBoundary>
          }
        />
        <Route
          path="/profile"
          element={
            <AppErrorBoundary>
              <ProfileRoute />
            </AppErrorBoundary>
          }
        />

        {/* Game Engine Route */}
        <Route
          path="/game/:gameId"
          element={
            <AppErrorBoundary>
              <GamePageRoute />
            </AppErrorBoundary>
          }
        />

        {/* Economy Route */}
        <Route
          path="/shop"
          element={
            <AppErrorBoundary>
              <ShopRoute />
            </AppErrorBoundary>
          }
        />

        {/* Protected Server-Authoritative Admin Route */}
        <Route
          path="/admin"
          element={
            <AppErrorBoundary>
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            </AppErrorBoundary>
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
