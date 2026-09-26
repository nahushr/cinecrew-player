import assert from 'node:assert/strict';
import test from 'node:test';
import { emitProgressBarTime, formatProgressBarTime } from '../src/utils/progressBarTime.js';

test('formats progress positions as zero-padded HH:MM:SS', () => {
  assert.equal(formatProgressBarTime(0), '00:00:00');
  assert.equal(formatProgressBarTime(5.9), '00:00:05');
  assert.equal(formatProgressBarTime(65), '00:01:05');
  assert.equal(formatProgressBarTime(3661), '01:01:01');
  assert.equal(formatProgressBarTime(Number.NaN), '00:00:00');
});

test('emits once for each played second and reports a committed seek immediately', () => {
  const calls = [];
  const lastSecondRef = { current: 0 };
  const notify = (time) => calls.push(time);

  assert.equal(emitProgressBarTime(0, notify, lastSecondRef), false);
  assert.equal(emitProgressBarTime(0.7, notify, lastSecondRef), false);
  assert.equal(emitProgressBarTime(1, notify, lastSecondRef), true);
  assert.equal(emitProgressBarTime(4.4, notify, lastSecondRef), true);
  assert.equal(emitProgressBarTime(5, notify, lastSecondRef, { force: true }), true);
  assert.equal(emitProgressBarTime(5.8, notify, lastSecondRef), false);
  assert.equal(emitProgressBarTime(6, notify, lastSecondRef), true);
  assert.deepEqual(calls, ['00:00:01', '00:00:02', '00:00:03', '00:00:04', '00:00:05', '00:00:06']);
});

test('a consumer callback error does not disrupt player progress', () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal(emitProgressBarTime(10, () => { throw new Error('app callback'); }, { current: null }), true);
  } finally {
    console.error = originalError;
  }
});
