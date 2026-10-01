import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePlaybackStartTime } from '../src/utils/playbackTime.js';

test('parses an HH:MM:SS or MM:SS playback start time', () => {
  assert.equal(parsePlaybackStartTime('00:00:00'), 0);
  assert.equal(parsePlaybackStartTime('00:01:05'), 65);
  assert.equal(parsePlaybackStartTime('01:01:01'), 3661);
  assert.equal(parsePlaybackStartTime('12:34:56.5'), 45296.5);
  assert.equal(parsePlaybackStartTime('3:23'), 203);
  assert.equal(parsePlaybackStartTime('03:23'), 203);
});

test('also accepts seconds and rejects malformed or negative start times', () => {
  assert.equal(parsePlaybackStartTime(65.5), 65.5);
  assert.equal(parsePlaybackStartTime('01:60:00'), null);
  assert.equal(parsePlaybackStartTime('1:2:3'), null);
  assert.equal(parsePlaybackStartTime(-1), null);
  assert.equal(parsePlaybackStartTime(Number.NaN), null);
  assert.equal(parsePlaybackStartTime(undefined), null);
});
