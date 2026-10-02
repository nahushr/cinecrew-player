import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Electron inline and fullscreen controls expose functional 10-second seeks', () => {
  const inline = readFileSync(path.join(root, 'src/native/InlineLivePlayer.js'), 'utf8');
  const centerControls = readFileSync(path.join(root, 'src/native/media/player/CenterControls.js'), 'utf8');
  const fullscreenLayers = readFileSync(path.join(root, 'src/native/media/player/FullscreenLayers.js'), 'utf8');

  assert.match(inline, /seekButtonsVisible: isElectron\(\) && playbackDuration > 0/);
  assert.match(inline, /seekButton\(-10, 'Rewind 10 seconds', 'rewind-10'\)/);
  assert.match(inline, /seekButton\(10, 'Forward 10 seconds', 'fast-forward-10'\)/);
  assert.match(inline, /performAction\('onSeek',[\s\S]*?playbackPositionRef\.current = target/);
  assert.match(centerControls, /onSeekBy\?\.\(-10\)/);
  assert.match(centerControls, /onSeekBy\?\.\(10\)/);
  assert.match(fullscreenLayers, /showSeekButtons=\{isElectron\(\) && !props\.isLive && Number\(props\.duration\) > 0\}/);
});
