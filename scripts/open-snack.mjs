import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Snack } from 'snack-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const demoDir = path.resolve(rootDir, 'examples/native-demo');

// Permanent saved Snack ID on Expo Snack servers
export const SNACK_ID = 'poOvF7mPAfDv3UTxY4OrB';

export function getSavedSnackUrl({ platform = 'web', preview = true } = {}) {
  const url = new URL(`https://snack.expo.dev/${SNACK_ID}`);
  if (platform) url.searchParams.set('platform', platform);
  if (preview) url.searchParams.set('preview', 'true');
  return url.toString();
}

export async function saveSnackAsync() {
  const files = {};
  function walk(dir, rel = '') {
    for (const item of fs.readdirSync(dir)) {
      if (
        item.startsWith('.') ||
        item === 'node_modules' ||
        item === 'package-lock.json' ||
        item === 'README.md' ||
        item === 'metro.config.js' ||
        item === 'tsconfig.json'
      ) {
        continue;
      }
      const full = path.join(dir, item);
      const r = rel ? `${rel}/${item}` : item;
      if (fs.statSync(full).isDirectory()) {
        walk(full, r);
      } else {
        files[r] = {
          type: 'CODE',
          contents: fs.readFileSync(full, 'utf8'),
        };
      }
    }
  }

  walk(demoDir);

  const pkg = JSON.parse(fs.readFileSync(path.join(demoDir, 'package.json'), 'utf8'));
  const dependencies = {};
  for (const [name, version] of Object.entries(pkg.dependencies || {})) {
    if (name === 'expo' || name === 'react' || name === 'react-dom' || name === 'react-native' || name === 'react-native-web') {
      continue;
    }
    dependencies[name] = { version };
  }

  const snack = new Snack({
    name: 'CineCrew Player Demo',
    description: 'Cross-platform video player playground for React Native & Expo',
    sdkVersion: '54.0.0',
    files,
    dependencies,
  });

  const res = await snack.saveAsync();
  return { id: res.id, url: `https://snack.expo.dev/${res.id}` };
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
  const shouldSave = process.argv.includes('--save');
  const targetPlatform = process.argv.includes('--android')
    ? 'android'
    : process.argv.includes('--ios')
    ? 'ios'
    : 'web';

  (async () => {
    let snackUrl = getSavedSnackUrl({ platform: targetPlatform });
    if (shouldSave) {
      console.log('Uploading updated demo files to Expo Snack...');
      const saved = await saveSnackAsync();
      snackUrl = `${saved.url}?platform=${targetPlatform}&preview=true`;
      console.log('Saved new Snack ID:', saved.id);
    }

    console.log('\n================ EXPO SNACK ONE-CLICK LAUNCHER ================');
    console.log('Project: examples/native-demo');
    console.log('Snack ID:', SNACK_ID);
    console.log('Target Platform:', targetPlatform);
    console.log('Snack URL:\n' + snackUrl);
    console.log('===============================================================\n');

    if (shouldOpen) {
      openInBrowser(snackUrl);
    }
  })();
}
