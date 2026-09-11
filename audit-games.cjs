const fs = require('fs');
const path = require('path');

const gamesDir = path.join(__dirname, 'src', 'components', 'games');
const files = fs.readdirSync(gamesDir).filter(f => f.endsWith('Game.tsx') || f.endsWith('.tsx'));

const result = {
  fullyShared: [],
  partial: [],
  legacy: []
};

files.forEach(file => {
  const content = fs.readFileSync(path.join(gamesDir, file), 'utf8');
  const hasUseGameEngine = content.includes('useGameEngine');
  const hasStartLoop = content.includes('startLoop');

  if (hasUseGameEngine && hasStartLoop) {
    result.fullyShared.push(file);
  } else if (hasUseGameEngine && !hasStartLoop) {
    result.partial.push(file);
  } else {
    result.legacy.push(file);
  }
});

console.log(`Total games: ${files.length}`);
console.log(`\n=== Fully Shared (${result.fullyShared.length}) ===\n` + result.fullyShared.join('\n'));
console.log(`\n=== Partial (${result.partial.length}) ===\n` + result.partial.join('\n'));
console.log(`\n=== Legacy (${result.legacy.length}) ===\n` + result.legacy.join('\n'));
