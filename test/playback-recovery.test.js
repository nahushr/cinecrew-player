import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { playPlayer, resumePlayerAfterSeek } from '../src/utils/playbackRecovery.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

test('a seek from the ended state resumes only after an asynchronous seek completes', async () => {
  const calls = [];
  let finishSeek;
  const seekResult = new Promise((resolve) => { finishSeek = resolve; });
  const recovery = resumePlayerAfterSeek({ play: () => calls.push('play') }, seekResult, true);

  assert.deepEqual(calls, []);
  calls.push('seek complete');
  finishSeek();
  await recovery;
  assert.deepEqual(calls, ['seek complete', 'play']);
});

test('a normal seek does not unpause an intentionally paused player', () => {
  let playCalls = 0;
  resumePlayerAfterSeek({ play: () => { playCalls += 1; } }, undefined, false);
  assert.equal(playCalls, 0);
});

test('restart and ended-seek recovery are connected to every player backend', () => {
  const nativePlayer = read('src/native/MediaPlayerView.js');
  const webPlayer = read('src/web/index.js');
  const electronAdapter = read('src/native/media/ElectronVideoPlayer.js');
  const webAdapter = read('src/native/media/WebVideoPlayer.web.js');
  const expoAdapter = read('src/native/media/player/ExoVideoFallback.js');
  const vlcAdapter = read('packages/react-native-vlc-media-player/VLCPlayer.js');

  assert.match(nativePlayer, /playbackEndedRef\.current = true/);
  assert.match(nativePlayer, /resumeAfterEndedSeek\(seekResult\)/);
  assert.match(nativePlayer, /playPlayer\(player\)/);
  assert.match(webPlayer, /const wasEnded = video\?\.ended === true/);
  assert.match(webPlayer, /if \(wasEnded && video\)[\s\S]*?playPlayer\(video\)/);
  assert.match(electronAdapter, /play\(\)\s*\{\s*return invokePlayer\('cinecrew:vlc:set-paused', false\)/);
  assert.match(webAdapter, /play\(\)\s*\{[\s\S]*?video\.play\(\)/);
  assert.match(expoAdapter, /play\(\)\s*\{\s*withActivePlayer\(\(activePlayer\) => activePlayer\.play\(\)\)/);
  assert.match(vlcAdapter, /play: \(\) => setNativeProps\(\{ paused: false \}\)/);
});

test('playback recovery safely contains rejected play promises and thrown backend errors', async () => {
  const rejected = playPlayer({ play: () => Promise.reject(new Error('ended stream')) });
  await rejected;
  assert.equal(playPlayer({ play: () => { throw new Error('backend unavailable'); } }), undefined);
});
