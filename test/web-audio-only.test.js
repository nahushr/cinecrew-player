import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
const webStyles = readFileSync(path.join(root, 'src/web/styles.css'), 'utf8');

test('audio-only mode keeps the switch-to-video action available', () => {
  assert.match(webEntry, /hasVideo: true,/);
  assert.match(webEntry, /hasVideo && onSwitchToVideo[\s\S]*?Switch to video/);
  assert.match(webEntry, /onClick: onSwitchToVideo/);
  assert.match(webEntry, /onSwitchToVideo: \(\) => setAudioOnlyMode\(false\)/);
});

test('audio-only mode leaves the switch card above, and interactive over, player controls', () => {
  assert.match(webStyles, /\.cinecrew-player__audio-card\s*\{[^}]*z-index:\s*6;/s);
  assert.match(webStyles, /\.cinecrew-player--audio-mode \.cinecrew-player__controls\s*\{[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/s);
});

test('audio-only control toggles off when activated a second time', () => {
  assert.match(webEntry, /callback: \(\) => setAudioOnlyMode\(!audioOnly\)/);
});
