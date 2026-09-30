import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');

test('audio-only mode keeps the switch-to-video action available', () => {
  assert.match(webEntry, /hasVideo: true,/);
  assert.match(webEntry, /hasVideo && onSwitchToVideo[\s\S]*?Switch to video/);
});
