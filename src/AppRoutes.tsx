import React, { Suspense } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useGameContext } from './contexts/GameContext';
import { PlayerProfile, GameStats, Achievement, RecentlyPlayedEntry } from './types';
import { useToast } from './utils/ToastContext';

// Pages
const Home = React.lazy(() => import('./pages/Home'));
const GamesPage = React.lazy(() => import('./pages/GamesPage'));
const ChallengesPage = React.lazy(() => import('./pages/ChallengesPage'));
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const GamePage = React.lazy(() => import('./pages/GamePage'));
const Shop = React.lazy(() => import('./pages/Shop'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));

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
  } = useGameContext();

  const navigate = useNavigate();
  const { masteries } = useGameContext();
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
        <Route path="/" element={<Home profile={profile} games={games} onSelectGame={handleSelectGame} recentlyPlayed={recentlyPlayed} dailyMissions={dailyMissions} achievements={achievements} totalPlays={totalPlays} onClearRecentlyPlayed={clearRecentlyPlayed} onUpdateProfile={handleUpdateProfile} />} />
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
              onGameOver={handleGameOver as any} // signature differs slightly
            />
          } 
        />
        
        {/* Economy Route */}
        <Route
          path="/shop"
          element={<Shop profile={profile} onUpdateProfile={handleUpdateProfile} />}
        />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Suspense>
  );
}
