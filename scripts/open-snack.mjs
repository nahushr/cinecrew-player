import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const demoDir = path.resolve(rootDir, 'examples/native-demo');

export function getSnackUrl({ platform = 'web', supportedPlatforms = 'my-device,web,android,ios' } = {}) {
  const filesObj = {};

  function walk(dir, rel = '') {
    for (const item of fs.readdirSync(dir)) {
      if (
        item.startsWith('.') ||
        item === 'node_modules' ||
        item === 'package-lock.json' ||
        item === 'README.md' ||
        item === 'metro.config.js' ||
        item === 'tsconfig.json' ||
        item === 'dist' ||
        item === 'dist-web' ||
        item === 'dist-android' ||
        item === 'dist-ios'
      ) {
        continue;
      }
      const full = path.join(dir, item);
      const r = rel ? `${rel}/${item}` : item;
      if (fs.statSync(full).isDirectory()) {
        walk(full, r);
      } else {
        filesObj[r] = {
          type: 'CODE',
          url: `https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/native-demo/${r}`,
        };
      }
    }
  }

  walk(demoDir);

  const dependencies = [
    '@cinecrew/cinecrew-player@latest',
    '@mediabunny/ac3@^1.59.0',
    'dashjs@^5.2.1',
    'flv.js@^1.6.2',
    'hls.js@^1.7.3',
    'mediabunny@^1.59.0',
    'react-native-safe-area-context@~5.7.0',
  ].join(',');

  const url = new URL('https://snack.expo.dev/');
  url.searchParams.set('name', 'CineCrew Player Demo');
  url.searchParams.set('description', 'Cross-platform video player playground for React Native & Expo');
  url.searchParams.set('sdkVersion', '57.0.0');
  url.searchParams.set('dependencies', dependencies);
  url.searchParams.set('files', JSON.stringify(filesObj));
  url.searchParams.set('preview', 'true');
  url.searchParams.set('platform', platform);
  if (supportedPlatforms) {
    url.searchParams.set('supportedPlatforms', supportedPlatforms);
  }

  return url.toString();
}

function openInBrowser(url) {
  const start =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';
  exec(`${start} "${url}"`, (err) => {
    if (err) {
      console.log('Could not open browser automatically. Please open the link above.');
    } else {
      console.log('🚀 Launched Expo Snack in your browser!');
    }
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const shouldOpen = !process.argv.includes('--no-open');
  const targetPlatform = process.argv.includes('--android')
    ? 'android'
    : process.argv.includes('--ios')
    ? 'ios'
    : 'web';

  const snackUrl = getSnackUrl({ platform: targetPlatform });
  console.log('\n================ EXPO SNACK ONE-CLICK LAUNCHER ================');
  console.log('Project:', 'examples/native-demo');
  console.log('Target Platform:', targetPlatform);
  console.log('Snack URL:\n' + snackUrl);
  console.log('===============================================================\n');

  if (shouldOpen) {
    openInBrowser(snackUrl);
  }
}
