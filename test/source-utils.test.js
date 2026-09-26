import assert from 'node:assert/strict';
import test from 'node:test';
import { getWebRuntimePlatform, normalizePlayerSource } from '../src/utils/sourceUtils.js';

test('normalizes string URLs without rewriting their scheme', () => {
  assert.deepEqual(normalizePlayerSource('https://media.example/video.m3u8'), {
    uri: 'https://media.example/video.m3u8',
  });
  assert.deepEqual(normalizePlayerSource('file:///Movies/example.mp4'), {
    uri: 'file:///Movies/example.mp4',
  });
});

test('identifies Electron renderer separately for source resolver callbacks', () => {
  const originalWindow = globalThis.window;
  try {
    globalThis.window = { process: { versions: { electron: '30.0.0' } } };
    assert.equal(getWebRuntimePlatform(), 'electron');
    globalThis.window = {};
    assert.equal(getWebRuntimePlatform(), 'web');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
