import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { WEB_PLAYER_STYLES } from '../src/web/inlineStyles.generated.js';

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
  assert.equal(manifest.dependencies['react-native-webview'], undefined, 'the package no longer bundles an embedded-video WebView');
  assert.equal(manifest.dependencies['@cinecrew/react-native-vlc-media-player'], undefined);
  assert.equal(manifest.workspaces, undefined);
  assert.equal(manifest.exports['./react'].default, './src/web/index.js');
  assert.equal(manifest.exports['./electron'].default, './src/web/index.js');
  assert.equal(manifest.exports['./react-native'].default, './src/native/index.js');
  assert.equal(manifest.exports['./react-native-web'].default, './src/web/index.js');
  assert.equal(manifest.dependencies['@expo/vector-icons'], '^15.0.2');
  assert.equal(manifest.dependencies['@react-native-community/slider'], '^5.1.2');
  assert.equal(manifest.dependencies['expo-video'], '>=2.0.0 || ~55.0.21 || ~57.0.2');
  assert.equal(manifest.dependencies['react-native-safe-area-context'], '^5.6.2');
  assert.equal(manifest.dependencies['react-native-svg'], '^15.15.3');
  const expoWebApp = readFileSync(path.join(root, 'examples/expo-web-demo/App.js'), 'utf8');
  const expoWebViewport = readFileSync(path.join(root, 'examples/expo-web-demo/src/components/PlayerViewport.web.js'), 'utf8');
  assert.match(expoWebApp, /\.\/src\/components\/PlayerViewport\.web\.js/);
  assert.match(expoWebViewport, /@cinecrew\/cinecrew-player\/(?:react-native-web|web)/);
  assert.doesNotMatch(expoWebViewport, /@cinecrew\/cinecrew-player\/native/);
  const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  assert.doesNotMatch(webEntry, /from ['"](?:react-native|react-native-webview|@expo\/vector-icons)['"]/);
  assert.doesNotMatch(webEntry, /import ['"]\.\/styles\.css['"]/);
  assert.match(webEntry, /installWebPlayerStyles\(\)/);
  const generatedWebStyles = readFileSync(path.join(root, 'src/web/inlineStyles.generated.js'), 'utf8');
  const sourceStyles = readFileSync(path.join(root, 'src/web/styles.css'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(generatedWebStyles, /export const WEB_PLAYER_STYLES/);
  assert.equal(WEB_PLAYER_STYLES, sourceStyles);
  assert.ok(existsSync(path.join(root, 'src/web/installStyles.js')));
  const demoSamples = readFileSync(path.join(root, 'examples/web-demo/src/samples.js'), 'utf8');
  assert.doesNotMatch(demoSamples, /youtube/i, 'the Vite demo no longer advertises YouTube as a playable sample');
  assert.equal(existsSync(path.join(root, 'src/native/media/YouTubeVideoPlayer.web.js')), false);
  assert.equal(existsSync(path.join(root, 'src/native/media/YouTubeVideoPlayer.native.js')), false);
  assert.doesNotMatch(declarations, /youtubeVideoId|isYouTube/i);
  assert.doesNotMatch(declarations, /WEB_(?:AC3|NO_PROXY)_/);
  assert.doesNotMatch(readme, /proxyUrlAvailable|webPlaybackError|WEB_NO_PROXY/);
});

test('drawer modes map to right overlay, resized video, and platform modal layouts', () => {
  const nativeDrawer = readFileSync(path.join(root, 'src/native/media/LiveChatDrawer.js'), 'utf8');
  const nativePlayer = readFileSync(path.join(root, 'src/native/MediaPlayerView.js'), 'utf8');
  const webPlayer = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  const webStyles = readFileSync(path.join(root, 'src/web/styles.css'), 'utf8');

  assert.match(declarations, /PlayerDrawerMode = 'overlay' \| 'resize' \| 'modal'/);
  assert.match(nativeDrawer, /drawerMode === 'modal' && !isWeb\(\)/);
  assert.match(nativeDrawer, /drawerMode === 'modal' && isWeb\(\)/);
  assert.match(nativeDrawer, /drawerMode === 'resize' && !popupMode/);
  assert.match(nativeDrawer, /drawerLandscape: \{[\s\S]*?right: 0/);
  assert.match(nativeDrawer, /bottomModalDrawer: \{/);
  assert.match(nativePlayer, /const resizeDrawerOpen = drawerMode === 'resize'\s+&& showLiveChat\s+&& windowWidth >= windowHeight/);
  assert.match(nativePlayer, /landscapeFullWidth=\{props\.isLandscape\}/);
  assert.match(nativeDrawer, /const fullscreenLandscape = \(fullscreen \|\| landscapeFullWidth\)[\s\S]*?windowWidth >= windowHeight/);
  assert.match(nativeDrawer, /fullscreenTopInset[\s\S]*fullscreenBottomInset/);
  assert.match(webPlayer, /cinecrew-player__modal-backdrop/);
  assert.match(webPlayer, /aria-modal/);
  assert.match(webStyles, /\.cinecrew-player__panel\.is-modal/);

  for (const demoFile of [
    'examples/web-demo/src/components/SourceControls.jsx',
    'examples/expo-web-demo/src/components/SourceControls.js',
    'examples/native-demo/src/components/SourceControls.js',
  ]) {
    assert.match(readFileSync(path.join(root, demoFile), 'utf8'), /value: 'modal'|value="modal"/);
  }
});

test('native fullscreen video taps dismiss controls and landscape drawers overlay full-width video', () => {
  const nativePlayer = readFileSync(path.join(root, 'src/native/MediaPlayerView.js'), 'utf8');
  const nativeDrawer = readFileSync(path.join(root, 'src/native/media/LiveChatDrawer.js'), 'utf8');

  assert.match(nativePlayer, /const handleFullscreenTouchEnd = useCallback/);
  assert.match(nativePlayer, /onTouchEnd=\{isFullscreen \? handleFullscreenTouchEnd : undefined\}/);
  assert.match(nativePlayer, /onTouchStart=\{markControlSurfaceTouch\}/);
  assert.match(nativeDrawer, /fullscreenLandscapeStyle = fullscreenLandscape/);
  assert.match(nativeDrawer, /width: Math\.max\(0, windowWidth - fullscreenLeftInset - fullscreenRightInset\)/);
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

test('Vite demo lockfile includes Linux optional native build bindings', () => {
  const demoRoot = path.join(root, 'examples/web-demo');
  const demoManifest = JSON.parse(readFileSync(path.join(demoRoot, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(path.join(demoRoot, 'package-lock.json'), 'utf8'));
  const lockedDemoManifest = lock.packages[''];
  const rolldown = lock.packages['node_modules/rolldown'];
  const rolldownBinding = lock.packages['node_modules/@rolldown/binding-linux-x64-gnu'];
  const lightningcss = lock.packages['node_modules/lightningcss'];
  const lightningcssBinding = lock.packages['node_modules/lightningcss-linux-x64-gnu'];

  assert.ok(rolldown.optionalDependencies['@rolldown/binding-linux-x64-gnu']);
  assert.equal(rolldownBinding.version, rolldown.optionalDependencies['@rolldown/binding-linux-x64-gnu']);
  assert.deepEqual(rolldownBinding.os, ['linux']);
  assert.deepEqual(rolldownBinding.cpu, ['x64']);
  assert.equal(rolldownBinding.optional, true);
  assert.ok(lightningcss.optionalDependencies['lightningcss-linux-x64-gnu']);
  assert.equal(lightningcssBinding.version, lightningcss.optionalDependencies['lightningcss-linux-x64-gnu']);
  assert.deepEqual(lightningcssBinding.os, ['linux']);
  assert.deepEqual(lightningcssBinding.cpu, ['x64']);
  assert.equal(lightningcssBinding.optional, true);
  assert.equal(demoManifest.dependencies['@cinecrew/cinecrew-player'], 'latest');
  assert.equal(demoManifest.scripts['update:player'], 'npm install --no-save @cinecrew/cinecrew-player@latest');
  assert.equal(lockedDemoManifest.dependencies['@cinecrew/cinecrew-player'], 'latest');
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

test('progress-bar callback is public, documented, and connected on web and native', () => {
  const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  const nativeEntry = readFileSync(path.join(root, 'src/native/MediaPlayerView.js'), 'utf8');
  const formatter = readFileSync(path.join(root, 'src/utils/progressBarTime.js'), 'utf8');

  assert.match(declarations, /onProgressBarChange\?: \(time: string\) => void/);
  assert.match(declarations, /showProgressBar\?: boolean/);
  assert.match(readme, /`onProgressBarChange`[\s\S]*`HH:MM:SS`/);
  assert.match(webEntry, /const progressBarCallback = progressBarVisible \? onProgressBarChange : undefined/);
  assert.match(webEntry, /showProgressBar !== false[\s\S]*isControlEnabled\(controlOverrides, 'seek', true\)[\s\S]*!isLive/);
  assert.match(webEntry, /duration > 0 && progressBarVisible/);
  assert.match(webEntry, /emitProgressBarTime\(Number\(video\.currentTime\) \|\| 0, progressBarCallback/);
  assert.match(nativeEntry, /const progressBarCallback = progressBarVisible \? onProgressBarChange : undefined/);
  assert.match(nativeEntry, /showProgressBar !== false[\s\S]*controls\.seek !== false[\s\S]*!isLive[\s\S]*!isInlinePreview/);
  assert.match(nativeEntry, /controls: \{ \.\.\.controls, seek: progressBarVisible \}/);
  assert.match(nativeEntry, /emitProgressBarTime\(progress\.seconds, progressBarCallback/);
  assert.match(formatter, /padStart\(2, '0'\)/);
});

test('startTime is public and wired through full, inline, web, and native playback', () => {
  const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  const nativeEntry = readFileSync(path.join(root, 'src/native/MediaPlayerView.js'), 'utf8');
  const nativeInline = readFileSync(path.join(root, 'src/native/InlineLivePlayer.js'), 'utf8');
  const webNativePlayer = readFileSync(path.join(root, 'src/native/media/WebVideoPlayer.web.js'), 'utf8');
  const ogvPlayer = readFileSync(path.join(root, 'src/native/media/web/useWebOgvPlayback.web.js'), 'utf8');

  assert.match(declarations, /interface CineCrewPlayerProps[\s\S]*startTime\?: number \| string/);
  assert.match(declarations, /interface InlineLivePlayerProps[\s\S]*startTime\?: number \| string/);
  assert.match(readme, /`startTime`[\s\S]*`HH:MM:SS`/);
  assert.match(nativeEntry, /parsePlaybackStartTime\(startTime\)/);
  assert.match(nativeEntry, /handleSeekTo\(requestedStartTime\)/);
  assert.match(nativeInline, /pendingSeekRef\.current = playbackPositionRef\.current/);
  assert.match(nativeInline, /playerInstance\.seek\(/);
  assert.match(webEntry, /startTime,[\s\S]*onLoadedMetadata: applyInitialTime/);
  assert.match(webNativePlayer, /startTime: requestedStartTime/);
  assert.match(ogvPlayer, /player\.currentTime = Math\.min\(initialTime, duration\)/);
});

test('compact inline titles are bottom-anchored and the Vite source controls stay streamlined', () => {
  const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  const webStyles = readFileSync(path.join(root, 'src/web/styles.css'), 'utf8');
  const nativeInline = readFileSync(path.join(root, 'src/native/InlineLivePlayer.js'), 'utf8');
  const sourceControls = readFileSync(path.join(root, 'examples/web-demo/src/components/SourceControls.jsx'), 'utf8');
  const demoStyles = readFileSync(path.join(root, 'examples/web-demo/src/style.css'), 'utf8');
  const topOverlay = nativeInline.match(/style: styles\.topRow \},([\s\S]*?)style: styles\.center \}/)?.[1] || '';

  assert.match(webEntry, /inlinePreview && title \? h\('span', \{ className: 'cinecrew-player__inline-title'/);
  assert.match(webStyles, /\.cinecrew-player__inline-title\s*\{/);
  assert.doesNotMatch(topOverlay, /styles\.title/);
  assert.match(nativeInline, /style: styles\.bottomRow \},[\s\S]*?styles\.title/);
  assert.doesNotMatch(sourceControls, /Treat source as live/);
  assert.match(demoStyles, /\.file-source-row\s*\{[^}]*padding-top:\s*12px/);
});

test('web player keeps chat paging automatic and exposes customizable aspect modes', () => {
  const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  const webStyles = readFileSync(path.join(root, 'src/web/styles.css'), 'utf8');
  const recording = readFileSync(path.join(root, 'src/utils/webRecording.js'), 'utf8');
  const nativeEntry = readFileSync(path.join(root, 'src/native/MediaPlayerView.js'), 'utf8');

  assert.match(declarations, /aspectRatios\?: Array<AspectRatio \| AspectRatioOption>/);
  assert.match(declarations, /defaultAspectRatio\?: AspectRatio/);
  assert.match(webEntry, /if \(name === 'onAspectRatioChange'\) callback = callback \|\| props\.onAspectRatioChange/);
  assert.match(webEntry, /onScroll:[\s\S]*loadOlderMessages/);
  assert.doesNotMatch(webEntry, /See more messages/);
  assert.doesNotMatch(webEntry, /name: 'videoOnly'/);
  assert.match(webStyles, /cinecrew-player__menu-option\.is-selected/);
  assert.match(webStyles, /cinecrew-player__controls\.is-recording/);
  assert.match(recording, /new MediaRecorder|MediaRecorder/);
  assert.match(recording, /canvas\.captureStream/);
  assert.doesNotMatch(webEntry, /youtube|youtubeVideoId/i);
  assert.doesNotMatch(nativeEntry, /youtube|youtubeVideoId/i);
  assert.doesNotMatch(webStyles, /cinecrew-player--youtube/i);
});

test('back action is app-owned and the Vite demo shows its callback in a snackbar', () => {
  const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  const nativeEntry = readFileSync(path.join(root, 'src/native/MediaPlayerView.js'), 'utf8');
  const demoActions = readFileSync(path.join(root, 'examples/web-demo/src/hooks/useDemoPlayerActions.js'), 'utf8');

  assert.match(webEntry, /action\('onBack', undefined/);
  assert.match(nativeEntry, /'onBack',[\s\S]*?undefined/);
  assert.match(demoActions, /onBack:[\s\S]*?notify\('Back'/);
  assert.match(declarations, /User-owned navigation event\. The player does not close or navigate on its own\./);
});

test('web audio-only artwork and spacing scale to the player container', () => {
  const webStyles = readFileSync(path.join(root, 'src/web/styles.css'), 'utf8');
  const audioPoster = webStyles.match(/\.cinecrew-player__audio-poster\s*\{([^}]*)\}/)?.[1] || '';
  const audioPlaceholder = webStyles.match(/\.cinecrew-player__audio-placeholder\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(webStyles, /container-type:\s*size;[\s\S]*container-name:\s*cinecrew-player/);
  assert.match(audioPoster, /width:\s*min\(160px,\s*30cqh,\s*28cqw\)/);
  assert.match(audioPlaceholder, /width:\s*min\(160px,\s*30cqh,\s*28cqw\)/);
  assert.match(webStyles, /@container cinecrew-player \(max-width: 360px\)/);
  assert.match(webStyles, /-webkit-line-clamp:\s*2/);
  assert.doesNotMatch(`${audioPoster}${audioPlaceholder}`, /\d+vw/);
});
