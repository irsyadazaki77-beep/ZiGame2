const fs = require('fs');
let code = fs.readFileSync('src/hooks/useProgressionManager.ts', 'utf8');

const newMasteryBlock = `
    // --- 2. PER-GAME MASTERY PROGRESSION ---
    setMasteries(prev => {
      const currentMastery = prev[gameId] || {
        gameId,
        xp: 0,
        level: 1,
        milestonesUnlocked: [],
        highestScore: 0,
        totalPlays: 0
      };
      
      const isPB = score > currentMastery.highestScore;
      // Basic mastery XP from play
      let masteryEarned = 25; // base per play
      if (durationSec > 30) masteryEarned += 25; // valid play
      if (isPB) masteryEarned += 150; // PB bonus
      masteryEarned += Math.floor(earnedXp * 0.5); // 50% of account XP goes to mastery
      
      const newMasteryXp = currentMastery.xp + masteryEarned;
      const masteryLvlData = progressionService.calculateMasteryLevel(newMasteryXp);
      
      const masteryLeveledUp = masteryLvlData.level > currentMastery.level;
      
      if (masteryLeveledUp && !masteryLvlData.maxLevel) {
        setTimeout(() => {
          showToast('Mastery Up!', \`Mastery \${game?.title || gameId} naik ke Lv.\${masteryLvlData.level} (\${masteryLvlData.title})!\`, 'success', '🔥');
        }, 1500); // offset toast
      }

      return {
        ...prev,
        [gameId]: {
          ...currentMastery,
          xp: newMasteryXp,
          level: masteryLvlData.level,
          highestScore: Math.max(currentMastery.highestScore, score),
          totalPlays: currentMastery.totalPlays + 1,
          lastEarnedAt: Date.now()
        }
      };
    });
`;

code = code.replace(/\/\/ --- 2\. PER-GAME MASTERY PROGRESSION ---[\s\S]*?return xpResult;/, newMasteryBlock + "\n    return xpResult;");

fs.writeFileSync('src/hooks/useProgressionManager.ts', code);
