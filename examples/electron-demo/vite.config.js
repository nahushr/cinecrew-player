import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformAsync } from '@babel/core';
import transformReactJsx from '@babel/plugin-transform-react-jsx';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(demoDir, '../..');
const resolveDemoPackageModule = (packageName) => {
  const packageDir = path.join(demoDir, 'node_modules', packageName);
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const entry = packageJson.module || packageJson.exports?.['.']?.import || packageJson.main;
  return path.resolve(packageDir, entry);
};

export default defineConfig({
  root: demoDir,
  // React Native libraries (including the player's icon sets) expect Metro's
  // development flag to exist as a compile-time global.
  define: { __DEV__: 'false' },
  // The packaged app loads its renderer from file:// rather than an HTTP host.
  // Relative asset URLs keep Vite's bundles resolvable inside the DMG.
  base: './',
  plugins: [
    {
      name: 'transform-shared-react-native-jsx',
      enforce: 'pre',
      async transform(code, id) {
        if (!/\.js(?:\?.*)?$/.test(id)) return null;
        const sharedDemoSource = !id.includes('/node_modules/')
          && (id.startsWith(repoRoot) || id.includes('/examples/native-demo/'));
        const iconSource = /\/node_modules\/(?:@expo\/vector-icons|react-native-vector-icons)\//.test(id);
        if (!sharedDemoSource && !iconSource) return null;
        const result = await transformAsync(code, {
          filename: id,
          babelrc: false,
          configFile: false,
          plugins: [[transformReactJsx, { runtime: 'automatic' }]],
          sourceMaps: true,
        });
        return result ? { code: result.code, map: result.map } : null;
      },
    },
    react(),
  ],
  resolve: {
    extensions: ['.web.js', '.web.jsx', '.js', '.jsx', '.mjs', '.ts', '.tsx', '.json'],
    alias: [
      {
        find: /^expo-font$/,
        replacement: path.join(demoDir, 'src/shims/expo-font.js'),
      },
      {
        find: /^@react-native-community\/slider$/,
        replacement: path.join(demoDir, 'src/shims/slider.jsx'),
      },
      {
        find: './media/WebVideoPlayer',
        replacement: path.join(demoDir, 'src/shims/empty-web-player.jsx'),
      },
      {
        find: '../../packages/react-native-vlc-media-player/VLCPlayer.js',
        replacement: path.join(demoDir, 'src/shims/empty-vlc-player.jsx'),
      },
      {
        find: /^@cinecrew\/cinecrew-player$/,
        replacement: path.join(repoRoot, 'src/native/index.js'),
      },
      {
        find: /^mediabunny$/,
        replacement: resolveDemoPackageModule('mediabunny'),
      },
      {
        find: /^@mediabunny\/ac3$/,
        replacement: resolveDemoPackageModule('@mediabunny/ac3'),
      },
      {
        find: /^flv\.js$/,
        replacement: resolveDemoPackageModule('flv.js'),
      },
      {
        find: /^hls\.js$/,
        replacement: resolveDemoPackageModule('hls.js'),
      },
      {
        find: /^dashjs$/,
        replacement: resolveDemoPackageModule('dashjs'),
      },
      {
        find: /^react-native$/,
        replacement: path.join(demoDir, 'src/shims/react-native.js'),
      },
    ],
    dedupe: [
      'react',
      'react-dom',
      'react-native-web',
      'react-native-safe-area-context',
      '@expo/vector-icons',
      '@react-native/normalize-colors',
      'prop-types',
      'inline-style-prefixer',
      '@react-native-community/slider',
    ],
  },
  // Shared React Native sources contain JSX in .js and optional native-only
  // imports. Let Vite's normal plugin transform those modules instead of
  // pre-scanning them as plain JavaScript during dev-server startup.
  optimizeDeps: {
    noDiscovery: true,
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react-native-web',
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
  build: { outDir: path.join(demoDir, 'dist'), emptyOutDir: true },
});
