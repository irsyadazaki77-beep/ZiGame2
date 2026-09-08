const fs = require('fs');

let content = fs.readFileSync('src/components/games/CyberTetrisGame.tsx', 'utf8');

// CyberTetris uses startLoop instead of start, but maybe it just meant a function named startLoop
if (!content.includes('const startLoop = () => {')) {
   content = content.replace(/startLoop/g, 'startGame');
}

fs.writeFileSync('src/components/games/CyberTetrisGame.tsx', content);

