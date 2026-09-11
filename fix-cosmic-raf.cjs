const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

content = content.replace(/gameLoopRef\.current = requestAnimationFrame\(update\);/g, 'startLoop(update);');

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
