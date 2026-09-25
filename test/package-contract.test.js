import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
const declarations = readFileSync(path.join(root, 'types/index.d.ts'), 'utf8');

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object') return [];
  return Object.values(value).flatMap(exportTargets);
}

test('published package metadata and export targets are complete', () => {
  assert.equal(manifest.name, '@cinecrew/cinecrew-player');
  assert.ok(manifest.description);
  assert.equal(manifest.license, 'MIT');
  assert.ok(manifest.repository.url.includes('nahushr/cinecrew-player'));

  for (const target of exportTargets(manifest.exports)) {
    assert.ok(existsSync(path.join(root, target)), `missing package export target: ${target}`);
  }
  for (const file of ['README.md', 'LICENSE', 'NOTICE', 'types/index.d.ts']) {
    assert.ok(manifest.files.some((entry) => file.startsWith(entry)), `${file} is not included in npm files`);
  }
  assert.ok(manifest.dependencies['react-native-webview'], 'native YouTube playback requires the installed WebView dependency');
  assert.equal(manifest.dependencies['@cinecrew/react-native-vlc-media-player'], undefined);
  assert.equal(manifest.workspaces, undefined);
  assert.equal(manifest.exports['./react'].default, './src/web/index.js');
  assert.equal(manifest.exports['./electron'].default, './src/web/index.js');
  assert.equal(manifest.exports['./react-native'].default, './src/native/index.js');
  assert.equal(manifest.exports['./react-native-web'].default, './src/web/index.js');
  const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  assert.doesNotMatch(webEntry, /from ['"](?:react-native|react-native-webview|@expo\/vector-icons)['"]/);
  assert.ok(existsSync(path.join(root, 'src/native/media/YouTubeVideoPlayer.web.js')));
  assert.ok(existsSync(path.join(root, 'src/native/media/YouTubeVideoPlayer.native.js')));
  assert.doesNotMatch(declarations, /WEB_(?:AC3|NO_PROXY)_/);
  assert.doesNotMatch(readme, /proxyUrlAvailable|webPlaybackError|WEB_NO_PROXY/);
});

test('native VLC implementation is bundled inside the single player package', () => {
  assert.ok(manifest.files.includes('android/'));
  assert.ok(manifest.files.includes('packages/react-native-vlc-media-player/ios/RCTVLCPlayer/'));
  assert.ok(manifest.files.includes('packages/react-native-vlc-media-player/expo/'));
  assert.ok(manifest.files.includes('CineCrewPlayer.podspec'));
  assert.ok(manifest.files.includes('app.plugin.cjs'));
  assert.ok(existsSync(path.join(root, 'android/build.gradle')));
  assert.ok(existsSync(path.join(root, 'android/src/main/java/com/yuanzhou/vlc/ReactVlcPlayerPackage.java')));
  assert.ok(existsSync(path.join(root, 'android/.npmignore')));
  assert.equal(existsSync(path.join(root, 'react-native.config.js')), false);
  assert.equal(existsSync(path.join(root, 'packages/react-native-vlc-media-player/package.json')), false);
  assert.equal(existsSync(path.join(root, 'packages/react-native-vlc-media-player/.github/workflows/npmpublish.yml')), false);
});

test('README documents every public control and action key', () => {
  const controls = declarations.match(/export interface PlayerControls \{([\s\S]*?)\n\}/)?.[1] || '';
  const actions = declarations.match(/export interface PlayerActions \{([\s\S]*?)\n\}/)?.[1] || '';
  const controlKeys = [...controls.matchAll(/^\s*(\w+)\?: boolean;/gm)].map((match) => match[1]);
  const actionKeys = [...actions.matchAll(/^\s*(on\w+)\?: PlayerAction;/gm)].map((match) => match[1]);

  assert.ok(controlKeys.length > 0, 'no PlayerControls keys found');
  assert.ok(actionKeys.length > 0, 'no PlayerActions keys found');
  for (const key of controlKeys) assert.ok(readme.includes(`\`${key}\``), `README does not mention control ${key}`);
  for (const key of actionKeys) assert.ok(readme.includes(`\`${key}\``), `README does not mention action ${key}`);
  assert.match(readme, /npm install @cinecrew\/cinecrew-player/);
  assert.match(readme, /React \(web\)/);
  assert.match(readme, /React Native \/ Expo/);
});

test('README documents the full-player and inline-preview props', () => {
  for (const interfaceName of ['CineCrewPlayerProps', 'InlineLivePlayerProps']) {
    const block = declarations.match(new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
    const props = [...block.matchAll(/^\s*(\w+)\??:/gm)].map((match) => match[1]);
    assert.ok(props.length > 0, `no properties found for ${interfaceName}`);
    for (const prop of props) {
      assert.ok(readme.includes(`\`${prop}\``), `README does not mention ${interfaceName}.${prop}`);
    }
  }
});
