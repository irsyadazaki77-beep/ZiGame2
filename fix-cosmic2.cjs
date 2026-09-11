const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

// Remove the sync refs effect entirely
content = content.replace(
  /  useEffect\(\(\) => \{\n    isPlayingRef\.current = isPlaying;\n    gameOverRef\.current = gameOver;\n    scoreRef\.current = score;\n  \}, \[isPlaying, gameOver, score\]\);\n/g,
  ``
);
content = content.replace(/  const isPlayingRef = useRef\(false\);\n/g, '');
content = content.replace(/  const gameOverRef = useRef\(false\);\n/g, '');

content = content.replace(
  /  \}, \[isPlaying, gameOver\]\);/g,
  `  }, [gameState]);`
);

content = content.replace(
  /    if \(!isPlayingRef\.current \|\| gameOverRef\.current \) return;/g,
  `    if (gameState !== 'playing') return;`
);

content = content.replace(
  /    if \(!canvas \|\| !isPlayingRef\.current \|\| gameOverRef\.current \) return;/g,
  `    if (!canvas || gameState !== 'playing') return;`
);

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
