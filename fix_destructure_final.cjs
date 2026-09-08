const fs = require('fs');
const glob = require('glob');
const files = glob.sync('src/components/games/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Find the useGameEngine destructuring block
  const match = content.match(/(const|let) \{([^}]*)\} = useGameEngine\(/);
  if (match) {
    let destructure = match[2];
    let original = destructure;
    
    // Add missing exports if they are used in the file
    if (content.match(/\bscoreRef\b/) && !destructure.includes('scoreRef')) {
      destructure += ', scoreRef';
    }
    if (content.match(/\bgameLoopRef\b/) && !destructure.includes('gameLoopRef')) {
      destructure += ', gameLoopRef';
    }
    if (content.match(/\bstartLoop\b/) && !destructure.includes('startLoop')) {
      destructure += ', startLoop';
    }
    if (content.match(/\bstopLoop\b/) && !destructure.includes('stopLoop')) {
      destructure += ', stopLoop';
    }
    
    if (original !== destructure) {
       content = content.replace(match[0], `const {${destructure}} = useGameEngine(`);
       fs.writeFileSync(file, content);
    }
  }
}
