const fs = require('fs');
let content = fs.readFileSync('src/hooks/useGameEngine.ts', 'utf8');

// 1. Add loopCallbackRef
content = content.replace(
  /const lastTimestampRef = useRef<number>\(0\);/,
  `const lastTimestampRef = useRef<number>(0);\n  const loopCallbackRef = useRef<((timestamp: number, deltaTime: number) => void) | null>(null);`
);

// 2. Store callback in startLoop
content = content.replace(
  /const startLoop = useCallback\(\(callback: \(timestamp: number, deltaTime: number\) => void\) => \{\n    stopLoop\(\);\n    lastTimestampRef\.current = performance\.now\(\);/,
  `const startLoop = useCallback((callback: (timestamp: number, deltaTime: number) => void) => {\n    stopLoop();\n    loopCallbackRef.current = callback;\n    lastTimestampRef.current = performance.now();`
);

// 3. Restart loop in resumeGame
content = content.replace(
  /const resumeGame = useCallback\(\(\) => \{\n    if \(gameStateRef\.current === 'paused'\) \{\n      setGameState\('playing'\);\n      lastTimestampRef\.current = performance\.now\(\);\n      if \(onResume\) onResume\(\);\n    \}\n  \}, \[onResume\]\);/,
  `const resumeGame = useCallback(() => {\n    if (gameStateRef.current === 'paused') {\n      setGameState('playing');\n      lastTimestampRef.current = performance.now();\n      if (onResume) onResume();\n      if (loopCallbackRef.current) {\n        startLoop(loopCallbackRef.current);\n      }\n    }\n  }, [onResume, startLoop]);`
);

fs.writeFileSync('src/hooks/useGameEngine.ts', content);
