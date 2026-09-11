const fs = require('fs');
let content = fs.readFileSync('src/hooks/useGameEngine.ts', 'utf8');

content = content.replace(
  /const resumeGame = useCallback\(\(\) => \{\n    if \(gameStateRef\.current === 'paused'\) \{\n      setGameState\('playing'\);/g,
  `const resumeGame = useCallback(() => {\n    if (gameStateRef.current === 'paused') {\n      setGameState('playing');\n      gameStateRef.current = 'playing';`
);

content = content.replace(
  /const startWithCountdown = useCallback\(\(onCountdownEnd\?: \(\) => void\) => \{\n[\s\S]*?        audio\.playCountdownGo\(\);\n        setGameState\('playing'\);/g,
  `const startWithCountdown = useCallback((onCountdownEnd?: () => void) => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setGameState('countdown');
    gameStateRef.current = 'countdown';
    setCountdown(3);
    setScore(0);
    scoreRef.current = 0;
    audio.playCountdownTick();
    let current = 3;
    countdownTimerRef.current = setInterval(() => {
      current--;
      if (current > 0) {
        setCountdown(current);
        audio.playCountdownTick();
      } else {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        audio.playCountdownGo();
        setGameState('playing');
        gameStateRef.current = 'playing';`
);

fs.writeFileSync('src/hooks/useGameEngine.ts', content);
