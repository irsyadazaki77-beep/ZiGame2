const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/components/games/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix stopLoop inside some games
  content = content.replace(/stopLoop\(\);/g, 'if (gameLoopRef?.current) cancelAnimationFrame(gameLoopRef.current);');

  fs.writeFileSync(file, content);
}
