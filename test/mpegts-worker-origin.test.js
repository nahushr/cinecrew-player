import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('vendored MPEG-TS worker messages reject cross-origin senders', () => {
  const source = readFileSync(path.join(root, 'vendor/mpegts.js/mpegts.js'), 'utf8');
  const guardedHandlers = source.match(
    /addEventListener\("message",\s*function\s*\((\w+)\)\s*\{\s*if\s*\(\1\.origin\s*!==\s*self\.location\.origin\)\s*return;/g,
  );

  assert.equal(guardedHandlers?.length, 2, 'both dedicated-worker message handlers must validate origin');
});
