import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

const logErrorPlugin = () => ({
  name: 'log-error',
  configureServer(server: any) {
    server.middlewares.use('/log_error', (req: any, res: any) => {
      let body = '';
      req.on('data', (chunk: any) => body += chunk.toString());
      req.on('end', () => {
        fs.writeFileSync('error_log.txt', body + '\n', { flag: 'a' });
        res.end('ok');
      });
    });
  }
});

export default defineConfig(() => {
  return {
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/motion')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
              return 'vendor-framework';
            }
          }
        }
      }
    },
    plugins: [
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
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^\/api\//,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-artwork-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
