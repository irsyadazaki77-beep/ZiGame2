const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

// Component props & hooks
content = content.replace(
  /export default function CosmicAsteroidGame\(\{ onGameOver, onScoreUpdate, highScore \}: CosmicAsteroidGameProps\) \{/,
  `export default function CosmicAsteroidGame({ onGameOver, onScoreUpdate, highScore }: CosmicAsteroidGameProps) {\n  const { gameState, score, updateScore, startLoop, stopLoop, startWithCountdown, setupCanvasContext, triggerGameOver } = useGameEngine({ onScoreUpdate, onGameOver, maxDpr: 2 });`
);

// Delete old state if it still exists
content = content.replace(/  const \[isPlaying, setIsPlaying\] = useState\(false\);\n/g, ``);
content = content.replace(/  const \[gameOver, setGameOver\] = useState\(false\);\n/g, ``);
content = content.replace(/  const \[score, setScore\] = useState\(0\);\n/g, ``);
content = content.replace(/  const \[muted, setMuted\] = useState\(false\);\n/g, ``);
content = content.replace(/  const gameLoopRef = useRef<number>\(0\);\n/g, ``);
content = content.replace(/  const lastTimeRef = useRef<number>\(0\);\n/g, ``);

// Start
content = content.replace(
  /  const startNewGame = \(\) => \{\n    setScore\(0\);\n    setIsPlaying\(true\);\n    setGameOver\(false\);\n\n    shipPosRef\.current = \{ x: CANVAS_WIDTH \/ 2, y: CANVAS_HEIGHT \/ 2 \};\n    shipAngleRef\.current = -Math\.PI \/ 2;\n    bulletsRef\.current = \[\];\n    asteroidsRef\.current = \[\];\n    particlesRef\.current = \[\];\n    floatingTextsRef\.current = \[\];\n    lastTimeRef\.current = performance\.now\(\);\n    keysPressedRef\.current = \{\};\n\n    if \(gameLoopRef\.current\) cancelAnimationFrame\(gameLoopRef\.current\);\n    gameLoopRef\.current = requestAnimationFrame\(update\);\n  \};/,
  `  const startNewGame = () => {\n    shipPosRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };\n    shipAngleRef.current = -Math.PI / 2;\n    bulletsRef.current = [];\n    asteroidsRef.current = [];\n    particlesRef.current = [];\n    floatingTextsRef.current = [];\n    keysPressedRef.current = {};\n    startWithCountdown(() => {\n      startLoop(update);\n    });\n  };`
);

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
