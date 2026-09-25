import { mergeConfig } from 'vite';
import webConfig from './vite.config.js';

export default mergeConfig(webConfig, {
  resolve: {
    alias: [{ find: /^@cinecrew\/cinecrew-player$/, replacement: '@cinecrew/cinecrew-player/electron' }],
  },
  build: {
    outDir: 'dist-electron',
    emptyOutDir: true,
  },
});
