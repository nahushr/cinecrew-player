import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0' },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: '@cinecrew/cinecrew-player/styles.css', replacement: path.resolve(__dirname, '../../src/web/styles.css') },
      { find: '@cinecrew/cinecrew-player/react', replacement: path.resolve(__dirname, '../../src/web/index.js') },
      { find: '@cinecrew/cinecrew-player', replacement: path.resolve(__dirname, '../../src/web/index.js') },
    ],
  },
});
