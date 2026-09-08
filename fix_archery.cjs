const fs = require('fs');
let code = fs.readFileSync('src/components/games/ArcheryNeoGame.tsx', 'utf8');

const newStartGame = `  const startGame = useCallback(() => {
    audio.playCoin();
    updateScore(0);
    setArrows(15);
    setStage(1);
    activeOrbs.current = [];
    activeLasers.current = [];
    turretAngle.current = -Math.PI / 2;
    
    startWithCountdown(() => {
      startLoop((t, d) => gameStep(t, d));
    });
  }, [updateScore, startWithCountdown, startLoop, gameStep]);
`;

code = code.replace("  return (", newStartGame + "\n  return (");
fs.writeFileSync('src/components/games/ArcheryNeoGame.tsx', code);
