const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/components/games/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('} = useGameEngine(')) {
    // Check if scoreRef is used
    if (content.includes('scoreRef') && !content.includes('scoreRef,')) {
      content = content.replace('} = useGameEngine(', '  scoreRef,\n  } = useGameEngine(');
    }
    // Check if gameLoopRef is used
    if (content.includes('gameLoopRef') && !content.includes('gameLoopRef,')) {
      content = content.replace('} = useGameEngine(', '  gameLoopRef,\n  } = useGameEngine(');
    }
    // Check if startLoop is used
    if (content.includes('startLoop') && !content.includes('startLoop,')) {
      content = content.replace('} = useGameEngine(', '  startLoop,\n  } = useGameEngine(');
    }
    // Check if setScore is used
    if (content.includes('setScore') && !content.includes('setScore,')) {
      content = content.replace('} = useGameEngine(', '  setScore,\n  } = useGameEngine(');
    }
    fs.writeFileSync(file, content);
  }
}
