const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

content = content.replace(
  "<Icon className={\\`w-4 h-4 \\${stat.color}\\`} />",
  "<Icon className={`w-4 h-4 ${stat.color}`} />"
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
