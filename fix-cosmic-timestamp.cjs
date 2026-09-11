const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

content = content.replace(/const delta = \(timestamp - lastTimeRef\.current\) \/ 16\.666;\n    lastTimeRef\.current = timestamp;/g, 'const delta = dtMs / 16.666;');

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
