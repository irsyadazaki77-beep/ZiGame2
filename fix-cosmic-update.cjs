const fs = require('fs');
let content = fs.readFileSync('src/components/games/CosmicAsteroidGame.tsx', 'utf8');

content = content.replace(/const update = \(timestamp: number\) => \{/g, 'const update = (timestamp: number, dtMs: number) => {');

fs.writeFileSync('src/components/games/CosmicAsteroidGame.tsx', content);
