import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { invokePlayerAction } from '../src/utils/invokePlayerAction.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('built-in action runs before its app callback and keeps its return value', () => {
  const calls = [];
  const payload = { muted: true };
  const result = invokePlayerAction(
    (actionPayload) => {
      calls.push(['core', actionPayload]);
      return 'core-result';
    },
    (actionPayload) => calls.push(['callback', actionPayload]),
    payload,
    {},
  );

  assert.deepEqual(calls, [['core', payload], ['callback', payload]]);
  assert.equal(result, 'core-result');
});

test('app callback runs after an asynchronous built-in action resolves', async () => {
  const calls = [];
  const result = invokePlayerAction(
    async () => {
      calls.push('core-start');
      await Promise.resolve();
      calls.push('core-finish');
      return 42;
    },
    () => calls.push('callback'),
  );

  assert.deepEqual(calls, ['core-start']);
  assert.equal(await result, 42);
  assert.deepEqual(calls, ['core-start', 'core-finish', 'callback']);
});

test('app-owned back callback runs without a built-in navigation action', () => {
  const calls = [];
  const result = invokePlayerAction(
    undefined,
    (payload) => calls.push(['back', payload]),
    { title: 'Episode 1' },
  );

  assert.equal(result, undefined);
  assert.deepEqual(calls, [['back', { title: 'Episode 1' }]]);
});

test('a throwing app callback does not undo or reject the built-in action', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(invokePlayerAction(() => 'played', () => { throw new Error('consumer callback'); }), 'played');
    assert.equal(await invokePlayerAction(async () => 'paused', () => { throw new Error('consumer callback'); }), 'paused');
  } finally {
    console.error = originalError;
  }
});

test('web, native, and inline player paths share core-first callback ordering', () => {
  for (const file of [
    'src/web/index.js',
    'src/native/MediaPlayerView.js',
    'src/native/InlineLivePlayer.js',
  ]) {
    const source = readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /invokePlayerAction\(/, `${file} must invoke the shared core-first action helper`);
  }
});

test('inline fullscreen expands its own player instead of promoting to the standard player', () => {
  const webEntry = readFileSync(path.join(root, 'src/web/index.js'), 'utf8');
  const nativeEntry = readFileSync(path.join(root, 'src/native/InlineLivePlayer.js'), 'utf8');
  const webFullscreenStart = webEntry.indexOf('const toggleFullscreen =');
  const webFullscreenEnd = webEntry.indexOf('const openPanel', webFullscreenStart);
  const webFullscreenAction = webEntry.slice(webFullscreenStart, webFullscreenEnd);
  const nativeFullscreenStart = nativeEntry.indexOf('const openFullscreen =');
  const nativeFullscreenEnd = nativeEntry.indexOf('const nativeMediaOptions', nativeFullscreenStart);
  const nativeFullscreenAction = nativeEntry.slice(nativeFullscreenStart, nativeFullscreenEnd);
  const webInlinePlayer = webEntry.slice(webEntry.indexOf('export const InlineLivePlayer ='));

  assert.match(webFullscreenAction, /playerRef\.current\?\.requestFullscreen\?\./);
  assert.doesNotMatch(webFullscreenAction, /onPromotePreview/);
  assert.doesNotMatch(webInlinePlayer, /onPromotePreview: onFullscreen/);
  assert.match(nativeFullscreenAction, /setFullscreen\(/);
  assert.doesNotMatch(nativeFullscreenAction, /onFullscreen\(/);
  assert.match(nativeEntry, /React\.createElement\(Modal, \{\s*visible: fullscreen/);
});
