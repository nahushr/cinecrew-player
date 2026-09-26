import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'flv-mime-type',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.includes('.flv')) {
            res.setHeader('Content-Type', 'video/x-flv');
            res.setHeader('Accept-Ranges', 'bytes');
          }
          next();
        });
      },
    },
  ],
  server: { host: '0.0.0.0' },
  resolve: { dedupe: ['react', 'react-dom'] },
});
