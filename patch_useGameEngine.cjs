const fs = require('fs');
let code = fs.readFileSync('src/hooks/useGameEngine.ts', 'utf8');

// 1. Add scoreRef
code = code.replace(
  "const [score, setScore] = useState<number>(0);",
  "const [score, setScore] = useState<number>(0);\n  const scoreRef = useRef<number>(0);"
);

// 2. Update updateScore to set scoreRef
code = code.replace(
  "setScore(newScore);",
  "setScore(newScore);\n    scoreRef.current = newScore;"
);

// 3. Update addScore to set scoreRef
code = code.replace(
  "const newScore = prev + amount;",
  "const newScore = prev + amount;\n      scoreRef.current = newScore;"
);

// 4. Export scoreRef and gameLoopRef
code = code.replace(
  "stopLoop,",
  "stopLoop,\n    scoreRef,\n    gameLoopRef: animFrameRef,"
);

fs.writeFileSync('src/hooks/useGameEngine.ts', code);
