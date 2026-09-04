const fs = require('fs');

let content = fs.readFileSync('src/AppRoutes.tsx', 'utf8');

if (!content.includes('AdminDashboard')) {
  content = content.replace(
    "const Shop = React.lazy(() => import('./pages/Shop'));",
    "const Shop = React.lazy(() => import('./pages/Shop'));\nconst AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));"
  );
  
  content = content.replace(
    "</Routes>",
    `        <Route path="/admin" element={<AdminDashboard />} />\n      </Routes>`
  );
  
  fs.writeFileSync('src/AppRoutes.tsx', content);
  console.log('AppRoutes patched');
}
