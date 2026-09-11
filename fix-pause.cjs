const fs = require('fs');
let content = fs.readFileSync('src/hooks/useGameEngine.ts', 'utf8');

content = content.replace(
  /const pauseGame = useCallback\(\(\) => \{\n    if \(gameStateRef\.current === 'playing'\) \{\n      setGameState\('paused'\);/g,
  `const pauseGame = useCallback(() => {\n    if (gameStateRef.current === 'playing') {\n      setGameState('paused');\n      gameStateRef.current = 'paused';`
);

content = content.replace(
  /const triggerGameOver = useCallback\(\(finalScore\?: number\) => \{\n    stopLoop\(\);\n    setGameState\('gameover'\);/g,
  `const triggerGameOver = useCallback((finalScore?: number) => {\n    stopLoop();\n    setGameState('gameover');\n    gameStateRef.current = 'gameover';`
);

content = content.replace(
  /const triggerRestart = useCallback\(\(\) => \{\n    stopLoop\(\);\n    setScore\(0\);\n    scoreRef\.current = 0;\n    setGameState\('ready'\);/g,
  `const triggerRestart = useCallback(() => {\n    stopLoop();\n    setScore(0);\n    scoreRef.current = 0;\n    setGameState('ready');\n    gameStateRef.current = 'ready';`
);

fs.writeFileSync('src/hooks/useGameEngine.ts', content);
