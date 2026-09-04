const fs = require('fs');

let content = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
content = content.replace(
  "import { ShieldAlert, Users, TrendingUp, DollarSign, Target, Settings, CheckCircle2 } from 'lucide-react';",
  "import { ShieldAlert, Users, TrendingUp, DollarSign, Target, Settings, CheckCircle2, RefreshCw } from 'lucide-react';"
);

fs.writeFileSync('src/pages/AdminDashboard.tsx', content);
