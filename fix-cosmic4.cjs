const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

content = content.replace(/if \(!lastTimeRef\.current\) lastTimeRef\.current = time;\n/g, '');
content = content.replace(/const delta = Math\.min\(\(time - lastTimeRef\.current\) \/ 16\.66, 3\);\n/g, 'const delta = dtMs / 16.66;\n');
content = content.replace(/lastTimeRef\.current = time;\n/g, '');

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
