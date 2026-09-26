import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalMediaUri } from '../src/utils/mediaUtils.js';

test('detects native local media URIs and paths', () => {
  for (const value of ['file:///Movies/sample.mp4', 'content://media/123', '/Movies/sample.mp4', './sample.mp4']) {
    assert.equal(isLocalMediaUri(value), true, value);
  }
});

test('does not classify network streams as local media', () => {
  for (const value of ['https://example.com/video.mp4', 'http://example.com/live.ts', 'rtsp://example.com/stream']) {
    assert.equal(isLocalMediaUri(value), false, value);
  }
  assert.equal(isLocalMediaUri(''), false);
});
