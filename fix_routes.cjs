const fs = require('fs');

let content = fs.readFileSync('src/AppRoutes.tsx', 'utf8');

content = content.replace(
  /<Routes>[\s\S]*?<\/Routes>/m,
  `<Routes>
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
      </Routes>`
);

fs.writeFileSync('src/AppRoutes.tsx', content);
