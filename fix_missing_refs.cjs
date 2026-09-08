const fs = require('fs');

const filesToFix = [
  'src/components/games/BlockMatchGame.tsx',
  'src/components/games/CosmicAsteroidGame.tsx',
  'src/components/games/CyberSlasherGame.tsx',
  'src/components/games/CyberTetrisGame.tsx',
  'src/components/games/MazeRunnerGame.tsx',
  'src/components/games/MemoryGridGame.tsx',
  'src/components/games/MemoryPathGame.tsx'
];

for (const file of filesToFix) {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('const scoreRef = useRef')) {
    // Insert after component declaration
    content = content.replace(/export default function \w+\(.*\) \{/, match => match + '\n  const scoreRef = React.useRef(0);');
    // Ensure React is imported or use just useRef if imported
    if (content.includes('useRef')) {
      content = content.replace('const scoreRef = React.useRef(0);', 'const scoreRef = useRef(0);');
    }
  }
  
  if (['CosmicAsteroidGame.tsx', 'CyberSlasherGame.tsx'].some(f => file.includes(f))) {
     if (!content.includes('const gameLoopRef = useRef')) {
        content = content.replace(/export default function \w+\(.*\) \{/, match => match + '\n  const gameLoopRef = useRef<number>();');
     }
  }
  
  fs.writeFileSync(file, content);
}
