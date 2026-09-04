const fs = require('fs');

let content = fs.readFileSync('src/hooks/useGameProgress.ts', 'utf8');

const xpLogic = `
    // --- Meta Progression (XP & Level) ---
    const durationSeconds = sessionDuration ? Math.floor(sessionDuration / 1000) : 0;
    const earnedXp = Math.floor(finalScore / 10) + durationSeconds * 2;
    const newTotalXp = (profile.xp || 0) + earnedXp;
    let newLevel = profile.level || 1;
    let levelUp = false;
    
    // Simple level formula: Level = floor(sqrt(XP / 100)) + 1
    const calculatedLevel = Math.floor(Math.sqrt(newTotalXp / 100)) + 1;
    if (calculatedLevel > newLevel) {
      newLevel = calculatedLevel;
      levelUp = true;
      showToast('Level Up!', \`Kamu mencapai Level \${newLevel}! (+\${earnedXp} XP)\`, 'success', '⭐');
      audio.playLevelUp();
    } else {
      // showToast('XP Gained', \`+\${earnedXp} XP\`, 'success', '✨');
    }
    
    const nextProfileUpdates: Partial<typeof profile> = {
      streak: newStreak,
      lastPlayDate: todayStr,
      xp: newTotalXp,
      level: newLevel,
      totalPlaytimeSec: (profile.totalPlaytimeSec || 0) + durationSeconds
    };
    // -------------------------------------
`;

// Replace `let newStreak = profile.streak || 0; ... newStreak = 1; }`
// We'll just replace the whole streak block.
const streakRegex = /let newStreak = profile\.streak \|\| 0;[\s\S]*?newStreak = 1;\s*}/m;
const streakBlockMatch = content.match(streakRegex);

if (streakBlockMatch) {
  content = content.replace(streakBlockMatch[0], streakBlockMatch[0] + xpLogic);
}

// Replace the part where it updates profile inside economyService callback
content = content.replace(
  `onUpdateProfile({
              ...profile,
              coins: serverCoins,
              streak: newStreak,
              lastPlayDate: todayStr
            });`,
  `onUpdateProfile({
              ...profile,
              ...nextProfileUpdates,
              coins: serverCoins
            });`
);

// Add fallback if server update fails or we're offline
// Wait, currently if economyService fails or we don't have internet, it might not update profile.
// Let's add the offline profile update.
const checkMissionsCall = `checkMissions('score', gameId, finalScore, isHighScore);`;
content = content.replace(
  checkMissionsCall,
  `// Optimistic update if economy sync is slow
    onUpdateProfile({
      ...profile,
      ...nextProfileUpdates
    });
    
    ${checkMissionsCall}`
);

fs.writeFileSync('src/hooks/useGameProgress.ts', content);
console.log('useGameProgress.ts updated');
