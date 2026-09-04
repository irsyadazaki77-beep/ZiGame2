const fs = require('fs');
let content = fs.readFileSync('src/contexts/GameContext.tsx', 'utf8');

// Add import for useProgressionManager and GameMastery
content = content.replace(
  "import { useGameProgress } from '../hooks/useGameProgress';",
  "import { useGameProgress } from '../hooks/useGameProgress';\nimport { useProgressionManager } from '../hooks/useProgressionManager';\nimport { GameMastery } from '../types';"
);

// Add masteries to context type
content = content.replace(
  "handleResetStats: () => void;\n}",
  "handleResetStats: () => void;\n  masteries: Record<string, GameMastery>;\n}"
);

// Call hook and pass processGameSession to useGameProgress
content = content.replace(
  "const gameProgress = useGameProgress(profile, handleUpdateProfile, showToast);",
  "const { masteries, processGameSession } = useProgressionManager(profile, handleUpdateProfile, INITIAL_GAMES);\n  const gameProgress = useGameProgress(profile, handleUpdateProfile, showToast, processGameSession);"
);

// Expose masteries
content = content.replace(
  "<GameContext.Provider value={{ profile, setProfile, handleUpdateProfile, ...gameProgress }}>",
  "<GameContext.Provider value={{ profile, setProfile, handleUpdateProfile, masteries, ...gameProgress }}>"
);

fs.writeFileSync('src/contexts/GameContext.tsx', content);
console.log('GameContext patched');
