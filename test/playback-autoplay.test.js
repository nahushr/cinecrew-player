import assert from 'node:assert/strict';
import test from 'node:test';
import { attemptVideoPlayback } from '../src/native/media/web/playbackAutoplay.js';

test('autoplay fallback retries muted only when the browser blocks playback', async () => {
  const calls = [];
  const video = { muted: false };
  const player = {
    play: async () => {
      calls.push(video.muted);
      if (!video.muted) throw Object.assign(new Error('Gesture required'), { name: 'NotAllowedError' });
    },
  };

  await attemptVideoPlayback(player, video, { current: false });

  assert.deepEqual(calls, [false, true]);
  assert.equal(video.muted, true);
});

test('autoplay fallback leaves paused playback untouched', async () => {
  let playCalls = 0;
  const video = { muted: false };
  const player = { play: async () => { playCalls += 1; } };

  await attemptVideoPlayback(player, video, { current: true });

  assert.equal(playCalls, 0);
  assert.equal(video.muted, false);
});
