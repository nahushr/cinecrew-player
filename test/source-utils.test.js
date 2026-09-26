import assert from 'node:assert/strict';
import test from 'node:test';
import { getYouTubeVideoId, getWebRuntimePlatform, normalizePlayerSource } from '../src/utils/sourceUtils.js';
import { buildYouTubePlayerHtml } from '../src/utils/youtubeHtml.js';

test('normalizes string URLs without rewriting their scheme', () => {
  assert.deepEqual(normalizePlayerSource('https://media.example/video.m3u8'), {
    uri: 'https://media.example/video.m3u8',
  });
  assert.deepEqual(normalizePlayerSource('file:///Movies/example.mp4'), {
    uri: 'file:///Movies/example.mp4',
  });
});

test('recognizes common YouTube URL shapes and explicit YouTube IDs', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(getYouTubeVideoId(`https://www.youtube.com/watch?v=${id}`), id);
  assert.equal(getYouTubeVideoId(`https://youtu.be/${id}?si=share`), id);
  assert.equal(getYouTubeVideoId(`https://youtube.com/shorts/${id}`), id);
  assert.equal(getYouTubeVideoId({ type: 'youtube', id }), id);
  assert.equal(getYouTubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
});

test('builds an embedded YouTube player document without external navigation', () => {
  const html = buildYouTubePlayerHtml('dQw4w9WgXcQ', false, { title: 'Example title', poster: 'https://example.test/poster.jpg' });
  assert.match(html, /youtube\.com\/iframe_api/);
  assert.match(html, /cinecrewPlayerCommand/);
  assert.match(html, /autoplay:0/);
  assert.match(html, /controls:1/);
  assert.match(html, /setActionHandler\('play'/);
  assert.match(html, /Example title/);
  assert.throws(() => buildYouTubePlayerHtml('invalid-id'), /valid YouTube video ID/);
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
