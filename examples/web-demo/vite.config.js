import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0' },
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: { include: ['@cinecrew/cinecrew-player/react'] },
});
