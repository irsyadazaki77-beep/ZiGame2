const fs = require('fs');
let content = fs.readFileSync('src/pages/GamePage.tsx', 'utf8');

content = content.replace(
  /  useEffect\(\(\) => \{\n    return \(\) => \{\n      document\.body\.style\.overflow = '';\n    \};\n  \}, \[\]\);/g,
  `  useEffect(() => {\n    return () => {\n      document.body.style.overflow = '';\n      audio.stopAllSounds();\n    };\n  }, []);`
);

fs.writeFileSync('src/pages/GamePage.tsx', content);
