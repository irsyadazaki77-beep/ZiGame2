const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

// Imports
content = content.replace(
  /import React, \{ useEffect, useRef, useState \} from 'react';/,
  `import React, { useEffect, useRef, useState } from 'react';\nimport { useGameEngine } from '../../hooks/useGameEngine';`
);

// Component props & hooks
content = content.replace(
  /export default function CosmicAsteroidGame\(\{ onGameOver, onScoreUpdate \}: CosmicAsteroidGameProps\) \{/,
  `export default function CosmicAsteroidGame({ onGameOver, onScoreUpdate, highScore }: CosmicAsteroidGameProps) {\n  const { gameState, score, updateScore, startLoop, stopLoop, startWithCountdown, setupCanvasContext, triggerGameOver } = useGameEngine({ onScoreUpdate, onGameOver, maxDpr: 2 });`
);

// Remove old state
content = content.replace(/  const \[isPlaying, setIsPlaying\] = useState\(false\);\n/g, ``);
content = content.replace(/  const \[gameOver, setGameOver\] = useState\(false\);\n/g, ``);
content = content.replace(/  const \[score, setScore\] = useState\(0\);\n/g, ``);
content = content.replace(/  const \[muted, setMuted\] = useState\(false\);\n/g, ``);
content = content.replace(/  const gameLoopRef = useRef<number>\(0\);\n/g, ``);
content = content.replace(/  const lastTimeRef = useRef<number>\(0\);\n/g, ``);

// Adjust startNewGame
content = content.replace(
  /  const startNewGame = \(\) => \{\n[\s\S]*?    gameLoopRef\.current = requestAnimationFrame\(update\);\n  \};/,
  `  const startNewGame = () => {\n    shipPosRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };\n    shipAngleRef.current = -Math.PI / 2;\n    bulletsRef.current = [];\n    asteroidsRef.current = [];\n    particlesRef.current = [];\n    floatingTextsRef.current = [];\n    keysPressedRef.current = {};\n    startWithCountdown(() => {\n      startLoop(update);\n    });\n  };`
);

// Fix update function signature
content = content.replace(
  /  const update = \(time: number\) => \{/,
  `  const update = (time: number, dtMs: number) => {`
);

// Inside update, replace time delta
content = content.replace(
  /    if \(!lastTimeRef\.current\) lastTimeRef\.current = time;\n    const delta = Math\.min\(\(time - lastTimeRef\.current\) \/ 16\.66, 3\);\n    lastTimeRef\.current = time;/,
  `    const delta = dtMs / 16.66;`
);

content = content.replace(
  /          setScore\(prev => \{\n            const next = prev \+ 20;\n            onScoreUpdate\(next\);\n            return next;\n          \}\);/g,
  `          updateScore(score + 20);`
);

content = content.replace(
  /        setGameOver\(true\);\n        setIsPlaying\(false\);\n        shakeRef\.current = 24;\n        floatingTextsRef\.current\.push\(\{\n          x: shipX,\n          y: shipY - 15,\n          text: "WRECKED!!",\n          color: '#ef4444',\n          alpha: 1\.0,\n          vy: -1\.0\n        \}\);\n[\s\S]*?        onGameOver\(score\);/m,
  `        shakeRef.current = 24;\n        floatingTextsRef.current.push({\n          x: shipX,\n          y: shipY - 15,\n          text: "WRECKED!!",\n          color: '#ef4444',\n          alpha: 1.0,\n          vy: -1.0\n        });\n        triggerGameOver();`
);

content = content.replace(
  /    gameLoopRef\.current = requestAnimationFrame\(update\);\n  \};/g,
  `  };`
);

content = content.replace(
  /  const getGameState = \(\) => \{\n    if \(!isPlaying && score === 0\) return 'ready';\n    if \(!isPlaying\) return 'gameover';\n    return 'playing';\n  \};/g,
  ``
);

// JSX
content = content.replace(/\{isPlaying && \(/g, `{gameState === 'playing' && (`);
content = content.replace(/gameState=\{getGameState\(\)\}/g, `gameState={gameState}`);

// listeners
content = content.replace(
  /  useEffect\(\(\) => \{\n    const handleKeyDown = \(e: KeyboardEvent\) => \{/,
  `  useEffect(() => {\n    if (gameState !== 'playing') return;\n    const handleKeyDown = (e: KeyboardEvent) => {`
);
content = content.replace(
  /    return \(\) => \{\n      window\.removeEventListener\('keydown', handleKeyDown\);\n      window\.removeEventListener\('keyup', handleKeyUp\);\n    \};\n  \}, \[\]\);/,
  `    return () => {\n      window.removeEventListener('keydown', handleKeyDown);\n      window.removeEventListener('keyup', handleKeyUp);\n    };\n  }, [gameState]);`
);

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
