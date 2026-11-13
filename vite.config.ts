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
      let rejected = false;
      req.on('data', (chunk: any) => {
        if (rejected) return;
        body += chunk.toString();
        if (body.length > 65536) {
          rejected = true;
          res.statusCode = 413;
          res.end('Payload too large');
        }
      });
      req.on('end', () => {
        if (rejected) return;
        if (body.length > 65536) {
          res.statusCode = 413;
          res.end('Payload too large');
          return;
        }
        fs.appendFile('error_log.txt', body + '\n', () => {
          res.end('ok');
        });
      });
    });
  },
  transform(code: string, id: string) {
    if (id.includes('vite/dist/client/client.mjs')) {
      return code.replace(
        'const createWebSocketModuleRunnerTransport = (options) => {',
        'const createWebSocketModuleRunnerTransport = () => ({ connect() {}, disconnect() {}, send() {} }); const _origCreateWS = (options) => {'
      );
    }
    return null;
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
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
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
        includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          id: '/',
          name: 'ZIGAME - Retro Cyber Arcade',
          short_name: 'ZIGAME',
          description: 'Kumpulan game arkade retro-cyber modern dengan mode offline penuh.',
          theme_color: '#080a0f',
          background_color: '#080a0f',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^\/api\//,
              handler: 'NetworkOnly',
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-artwork-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 14 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            }
          ]
        },
        devOptions: {
          enabled: process.env.ENABLE_PWA_DEV === 'true',
          type: 'module',
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      entries: ['index.html', 'src/**/*.{ts,tsx}'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'three',
        'three/addons/environments/RoomEnvironment.js',
        'motion/react',
        'lucide-react',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
      ],
    },
    server: {
      hmr: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
