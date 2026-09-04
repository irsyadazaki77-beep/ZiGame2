const fs = require('fs');
let content = fs.readFileSync('src/AppRoutes.tsx', 'utf8');

// Remove masteries from Home
content = content.replace(
  "recentlyPlayed={recentlyPlayed}\n            masteries={masteries}",
  "recentlyPlayed={recentlyPlayed}"
);

// Add masteries to ProfilePage
content = content.replace(
  "onClearRecentlyPlayed={clearRecentlyPlayed}",
  "onClearRecentlyPlayed={clearRecentlyPlayed}\n            masteries={masteries}"
);

fs.writeFileSync('src/AppRoutes.tsx', content);
console.log('AppRoutes fixed');
