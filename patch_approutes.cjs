const fs = require('fs');
let content = fs.readFileSync('src/AppRoutes.tsx', 'utf8');

content = content.replace(
  "recentlyPlayed={recentlyPlayed}",
  "recentlyPlayed={recentlyPlayed}\n            masteries={masteries}"
);

content = content.replace(
  "const navigate = useNavigate();",
  "const navigate = useNavigate();\n  const { masteries } = useGameContext();"
);

fs.writeFileSync('src/AppRoutes.tsx', content);
console.log('AppRoutes patched with masteries');
