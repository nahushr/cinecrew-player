import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createFullscreenPlaybackState } from '../src/utils/fullscreenPlaybackState.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

test('native inline fullscreen retries the saved position until VLC reports it resumed', () => {
  const inline = read('src/native/InlineLivePlayer.js');

  assert.match(inline, /pendingSeekRef\.current = playbackPositionRef\.current/);
  assert.match(inline, /applyPendingSeek\(current\)/);
  assert.match(inline, /Math\.abs\(observedPosition - target\) <= 1/);
  assert.match(inline, /now - pendingSeekAttemptAtRef\.current < 400/);
});

test('native full-player fullscreen captures current playback and restores it after surface recreation', () => {
  const player = read('src/native/MediaPlayerView.js');

  assert.match(player, /const position = Number\(fullscreenSeekRestoreRef\.current\?\.target \?\? lastKnownTimeRef\.current/);
  assert.match(player, /fullscreenSeekRestoreRef\.current = \{[\s\S]*?target: position/);
  assert.match(player, /const observedTime = progress\.seconds/);
  assert.match(player, /player\.seek\(Math\.max\(0, Math\.min\(1, playerTarget \/ playerDuration\)\)\)/);
});

test('fullscreen carries the current timestamp, including fractional seconds, for a new VLC player', () => {
  assert.deepEqual(createFullscreenPlaybackState(true, 125.75), {
    isFullscreen: true,
    currentTime: 125.75,
    startTime: 125.75,
    position: 125.75,
    progressTime: '00:02:05',
  });
  assert.equal(createFullscreenPlaybackState(false, '01:02:03').startTime, 3723);
  assert.equal(createFullscreenPlaybackState(true, 0).startTime, 0);
});

test('the native demo passes fullscreen position through the callback before remounting the player', () => {
  const player = read('src/native/MediaPlayerView.js');
  const actions = read('examples/native-demo/src/hooks/useDemoPlayerActions.js');
  const app = read('examples/native-demo/App.js');
  assert.match(player, /invokeAction\('onFullscreen', toggleFullscreen, createFullscreenPlaybackState\(/);
  assert.match(actions, /onFullscreenChange\?\.\(isFullscreen, payload\)/);
  assert.match(app, /if \(resumeAt !== undefined && resumeAt !== null\) setStartTime\(resumeAt\);\s+setPromotedFullscreen\(isFullscreen\);/);
  assert.match(app, /onFullscreenChange: handleFullscreenChange/);
});

test('web inline fullscreen keeps the existing media element and its playback timeline', () => {
  const web = read('src/web/index.js');
  const surfaceStart = web.indexOf('function WebPlayerSurface(');
  const surfaceEnd = web.indexOf('function WebAudioOnlyCard(', surfaceStart);
  const surface = web.slice(surfaceStart, surfaceEnd);
  const inlineStart = web.indexOf('export const InlineLivePlayer = React.memo(');
  const inlinePlayer = web.slice(inlineStart);

  assert.match(web, /\(\) => toggleBrowserFullscreen\(playerRef\.current\)/);
  assert.match(surface, /key: directVideoSource \?/);
  assert.doesNotMatch(surface, /key:[^\n]*fullscreen/);
  assert.match(inlinePlayer, /startTime,/);
  assert.match(inlinePlayer, /inlinePreview: true/);
});
