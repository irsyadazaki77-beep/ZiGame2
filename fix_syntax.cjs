const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/components/games/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Just aggressively fix missing commas before the added properties.
  // We added scoreRef, gameLoopRef, startLoop, setScore immediately before `} = useGameEngine(`
  content = content.replace(/([a-zA-Z0-9]+)\s+gameLoopRef,/g, '$1,\n  gameLoopRef,');
  content = content.replace(/([a-zA-Z0-9]+)\s+scoreRef,/g, '$1,\n  scoreRef,');
  content = content.replace(/([a-zA-Z0-9]+)\s+startLoop,/g, '$1,\n  startLoop,');
  content = content.replace(/([a-zA-Z0-9]+)\s+setScore,/g, '$1,\n  setScore,');
  fs.writeFileSync(file, content);
}
