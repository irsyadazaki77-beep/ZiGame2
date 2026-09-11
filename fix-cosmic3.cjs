const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

content = content.replace(/setIsPlaying\(true\);/g, '');
content = content.replace(/setGameOver\(false\);/g, '');
content = content.replace(/setScore\(0\);/g, 'updateScore(0);');
content = content.replace(/lastTimeRef\.current = performance\.now\(\);/g, '');
content = content.replace(/if \(!lastTimeRef\.current\) lastTimeRef\.current = time;/g, '');
content = content.replace(/const delta = Math\.min\(\(time - lastTimeRef\.current\) \/ 16\.66, 3\);/g, 'const delta = dtMs / 16.66;');
content = content.replace(/lastTimeRef\.current = time;/g, '');

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
