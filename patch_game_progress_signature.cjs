const fs = require('fs');
let content = fs.readFileSync('src/hooks/useGameProgress.ts', 'utf8');

// Replace signature
content = content.replace(
  "showToast: (title: string, message: string, type: 'success' | 'error' | 'info', icon?: string) => void\n) => {",
  "showToast: (title: string, message: string, type: 'success' | 'error' | 'info', icon?: string) => void,\n  processGameSession: (gameId: string, score: number, durationMs: number) => any\n) => {"
);

// Replace XP block
const xpBlockRegex = /\s*\/\/ --- Meta Progression \(XP & Level\) ---[\s\S]*?\/\/ -------------------------------------/m;
content = content.replace(xpBlockRegex, "\n    const xpResult = processGameSession(gameId, finalScore, sessionDuration || 0);\n");

// Replace the nextProfileUpdates usage
content = content.replace(
  `onUpdateProfile({
      ...profile,
      ...nextProfileUpdates
    });`,
  `onUpdateProfile({
      ...profile,
      streak: newStreak,
      lastPlayDate: todayStr
    });`
);

content = content.replace(
  `onUpdateProfile({
              ...profile,
              ...nextProfileUpdates,
              coins: serverCoins
            });`,
  `onUpdateProfile({
              ...profile,
              streak: newStreak,
              lastPlayDate: todayStr,
              coins: serverCoins
            });`
);


fs.writeFileSync('src/hooks/useGameProgress.ts', content);
console.log('useGameProgress patched');
