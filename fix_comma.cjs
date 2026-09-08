const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/components/games/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/perfSettings\s+gameLoopRef,/g, 'perfSettings,\n  gameLoopRef,');
  content = content.replace(/perfSettings\s+scoreRef,/g, 'perfSettings,\n  scoreRef,');
  content = content.replace(/perfSettings\s+startLoop,/g, 'perfSettings,\n  startLoop,');
  content = content.replace(/perfSettings\s+setScore,/g, 'perfSettings,\n  setScore,');
  fs.writeFileSync(file, content);
}
