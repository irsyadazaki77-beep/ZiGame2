const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

// Imports
content = content.replace(
  /import \{ useState, useEffect, useRef \} from 'react';/,
  `import { useState, useEffect, useRef } from 'react';\nimport { useGameEngine } from '../../hooks/useGameEngine';`
);

// Component props
content = content.replace(
  /export default function CosmicAsteroidGame\(\{ onGameOver, onScoreUpdate \}: CosmicAsteroidGameProps\) \{/,
  `export default function CosmicAsteroidGame({ onGameOver, onScoreUpdate, highScore }: CosmicAsteroidGameProps) {\n  const { gameState, score, updateScore, startLoop, stopLoop, startWithCountdown, setupCanvasContext, triggerGameOver } = useGameEngine({ onScoreUpdate, onGameOver, maxDpr: 2 });`
);

// Remove old state
content = content.replace(/  const \[isPlaying, setIsPlaying\] = useState\(false\);\n  const \[gameOver, setGameOver\] = useState\(false\);\n  const \[score, setScore\] = useState\(0\);\n  const \[muted, setMuted\] = useState\(false\);/, ``);
content = content.replace(/  const gameLoopRef = useRef<number>\(0\);/, ``);
content = content.replace(/  const lastTimeRef = useRef<number>\(0\);/, ``);

// Adjust startNewGame
content = content.replace(
  /  const startNewGame = \(\) => \{\n    setScore\(0\);\n    setIsPlaying\(true\);\n    setGameOver\(false\);\n\n    shipPosRef\.current = \{ x: CANVAS_WIDTH \/ 2, y: CANVAS_HEIGHT \/ 2 \};\n    shipAngleRef\.current = -Math\.PI \/ 2;\n    bulletsRef\.current = \[\];\n    asteroidsRef\.current = \[\];\n    particlesRef\.current = \[\];\n    floatingTextsRef\.current = \[\];\n    lastTimeRef\.current = performance\.now\(\);\n    keysPressedRef\.current = \{\};\n\n    if \(gameLoopRef\.current\) cancelAnimationFrame\(gameLoopRef\.current\);\n    gameLoopRef\.current = requestAnimationFrame\(update\);\n  \};/,
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

// Inside update, replace setScore
content = content.replace(
  /          setScore\(prev => \{\n            const next = prev \+ 20;\n            onScoreUpdate\(next\);\n            return next;\n          \}\);/,
  `          updateScore(score + 20);`
);

// Replace GameOver
content = content.replace(
  /        setGameOver\(true\);\n        setIsPlaying\(false\);\n[\s\S]*?        onGameOver\(score\);/m,
  `        triggerGameOver();`
);

// Delete old requestAnimationFrame in update
content = content.replace(
  /    gameLoopRef\.current = requestAnimationFrame\(update\);\n  \};/g,
  `  };`
);

// Replace getGameState
content = content.replace(
  /  const getGameState = \(\) => \{\n    if \(!isPlaying && score === 0\) return 'ready';\n    if \(!isPlaying\) return 'gameover';\n    return 'playing';\n  \};/g,
  ``
);

// Replace JSX
content = content.replace(/\{isPlaying && \(/g, `{gameState === 'playing' && (`);
content = content.replace(/gameState=\{getGameState\(\)\}/g, `gameState={gameState}`);

// Listeners cleanup
content = content.replace(
  /  useEffect\(\(\) => \{\n    const handleKeyDown = \(e: KeyboardEvent\) => \{/,
  `  useEffect(() => {\n    if (gameState !== 'playing') return;\n    const handleKeyDown = (e: KeyboardEvent) => {`
);
content = content.replace(
  /    return \(\) => \{\n      window\.removeEventListener\('keydown', handleKeyDown\);\n      window\.removeEventListener\('keyup', handleKeyUp\);\n    \};\n  \}, \[\]\);/,
  `    return () => {\n      window.removeEventListener('keydown', handleKeyDown);\n      window.removeEventListener('keyup', handleKeyUp);\n    };\n  }, [gameState]);`
);

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
