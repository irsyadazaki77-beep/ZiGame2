const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const adminRoutes = `
  // Live Ops Configuration
  let currentSeasonConfig = {
    season: "S3",
    name: "Cyber Genesis",
    multiplier: 1.2,
    activeEvents: ["double_xp_weekend"]
  };
  
  app.get("/api/live-ops/config", (req, res) => {
    res.json({ success: true, config: currentSeasonConfig });
  });

  app.post("/api/admin/force-sync", createRateLimiter("admin", 10), (req, res) => {
    // Requires admin validation in real app
    res.json({ success: true, message: "Forced economy sync across all active sessions." });
  });
`;

if (!content.includes('/api/live-ops/config')) {
  content = content.replace(
    "app.post(\"/api/gamble\"",
    `${adminRoutes}\n\n  app.post("/api/gamble"`
  );
  fs.writeFileSync('server.ts', content);
  console.log('Server updated with Live Ops routes');
}
