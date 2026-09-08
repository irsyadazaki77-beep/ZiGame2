const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameProgress.ts', 'utf8');

const newCheckMissions = `
  const checkMissions = (eventType: 'play' | 'score', gameId: string, value: number, isHighScore: boolean = false) => {
    const today = getTodayDateString();
    let updated = false;
    
    // Find game genre
    const game = games.find(g => g.id === gameId);
    const genre = game ? game.genre : 'Unknown';

    const updatedMissions = dailyMissions.map(m => {
      if (m.date !== today || m.completed) return m;
      
      let newProgress = m.progress;
      let shouldComplete = false;
      let newMetadata = m.metadata ? { ...m.metadata } : undefined;
      
      if (eventType === 'play') {
        if (m.type === 'play_count') {
          // Play count increment handled in score event (session completion) or here
          // We'll require minimal time, so maybe let's handle play_count in 'score' event to ensure valid sessions
        }
      } else if (eventType === 'score') {
        if (m.type === 'play_count') {
           newProgress += 1;
        } else if (m.type === 'score_target' && m.gameId === gameId) {
          if (value >= m.target) {
            newProgress = m.target;
          }
        } else if (m.type === 'beat_pb' && isHighScore) {
          newProgress = 1;
        } else if (m.type === 'total_score') {
          newProgress += value;
        } else if (m.type === 'play_genre_count') {
          if (!newMetadata) newMetadata = { genresPlayed: [] };
          if (!newMetadata.genresPlayed) newMetadata.genresPlayed = [];
          if (!newMetadata.genresPlayed.includes(genre)) {
            newMetadata.genresPlayed.push(genre);
            newProgress = newMetadata.genresPlayed.length;
          }
        }
      }
      
      if (newProgress >= m.target && !m.completed) {
        newProgress = m.target;
        shouldComplete = true;
        showToast('Misi Harian Selesai', \`\${m.description} (+\${m.rewardCoins} Coins)\`, 'success', '🎯');
      }
      
      if (newProgress !== m.progress || shouldComplete) {
        updated = true;
        return { ...m, progress: newProgress, completed: shouldComplete, metadata: newMetadata };
      }
      return m;
    });

    if (updated) {
      setDailyMissions(updatedMissions);
      storageService.saveDailyMissions(updatedMissions);
      
      const newlyCompletedMissions = updatedMissions.filter(m => m.completed && dailyMissions.find(om => om.id === m.id && !om.completed));
      if (newlyCompletedMissions.length > 0) {
        import('../services/economyService').then(({ economyService }) => {
          newlyCompletedMissions.forEach(m => {
            economyService.claimReward(m.id, 'daily_mission', profile.name).then(res => {
              if (res.success && res.newBalance !== undefined) {
                onUpdateProfile({
                  ...profile,
                  coins: res.newBalance
                });
              }
            });
          });
        });
      }
    }
  };
`;

code = code.replace(/const checkMissions = \([\s\S]*?if \(!ach\.unlocked && ach\.gameId === gameId\) \{/, newCheckMissions + "\n  const checkAchievements = (gameId: string, currentScore: number) => {\n    let newlyUnlocked = false;\n    const unlockedIds: string[] = [];\n    const updatedAchievements = achievements.map((ach) => {\n      if (!ach.unlocked && ach.gameId === gameId) {");

// Also, the old logic used `checkMissions('play', gameId, 1);` in handleSelectGame. Let's fix handleSelectGame to not increment play_count.
code = code.replace(/checkMissions\('play', gameId, 1\);/g, "// checkMissions('play', gameId, 1);");
fs.writeFileSync('src/hooks/useGameProgress.ts', code);
