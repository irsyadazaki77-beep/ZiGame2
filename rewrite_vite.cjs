const fs = require('fs');

let content = fs.readFileSync('vite.config.ts', 'utf8');

if (!content.includes('vite-plugin-pwa')) {
  content = content.replace(
    "import path from 'path';",
    "import path from 'path';\nimport { VitePWA } from 'vite-plugin-pwa';"
  );
  
  content = content.replace(
    "plugins: [react(), tailwindcss(), logErrorPlugin()],",
    `plugins: [
      react(), 
      tailwindcss(), 
      logErrorPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'ZIGAME',
          short_name: 'ZIGAME',
          description: 'Kumpulan game arkade retro-cyber modern',
          theme_color: '#09090b',
          background_color: '#09090b',
          display: 'standalone',
          icons: [
            {
              src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%2309090b'/%3E%3Cpath d='M25 80 L35 25 L65 25 L75 80 Z' fill='none' stroke='%23ef4444' stroke-width='6' stroke-linejoin='round'/%3E%3Cpath d='M15 70 L85 70' stroke='%2306b6d4' stroke-width='5' stroke-linecap='round'/%3E%3Ccircle cx='50' cy='40' r='10' fill='%23ef4444'/%3E%3Cline x1='50' y1='40' x2='50' y2='70' stroke='%2306b6d4' stroke-width='6' stroke-linecap='round'/%3E%3C/svg%3E",
              sizes: '192x192',
              type: 'image/svg+xml'
            }
          ]
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\\//],
          runtimeCaching: [
            {
              urlPattern: /^\\/api\\//,
              handler: 'NetworkOnly',
            }
          ]
        }
      })
    ],`
  );
  
  fs.writeFileSync('vite.config.ts', content);
  console.log('vite.config.ts updated with PWA');
} else {
  console.log('already has PWA');
}
