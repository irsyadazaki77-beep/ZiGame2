const fs = require('fs');
let content = fs.readFileSync('src/hooks/useGameEngine.ts', 'utf8');

content = content.replace(
  /  const stopLoop = useCallback\(\(\) => \{\n    if \(animFrameRef\.current !== null\) \{\n      cancelAnimationFrame\(animFrameRef\.current\);\n      animFrameRef\.current = null;\n    \}\n  \}, \[\]\);/,
  `  const stopLoop = useCallback(() => {\n    if (animFrameRef.current !== null) {\n      cancelAnimationFrame(animFrameRef.current);\n      animFrameRef.current = null;\n      performanceService.registerRafEnd();\n    }\n  }, []);`
);

content = content.replace(
  /        performanceService\.registerRafEnd\(\);\n        stopLoop\(\);/g,
  `        stopLoop();`
);

content = content.replace(
  /      \} else \{\n        performanceService\.registerRafEnd\(\);\n      \}/g,
  `      } else {\n        stopLoop();\n      }`
);

fs.writeFileSync('src/hooks/useGameEngine.ts', content);
