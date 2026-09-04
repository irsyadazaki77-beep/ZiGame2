import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
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
    plugins: [react(), tailwindcss(), logErrorPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
