import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordingDownloadLink, createVideoRecordingStream, downloadRecording } from '../src/utils/webRecording.js';

test('cross-origin capture failures explain the browser recording limitation', () => {
  const originalMediaStream = globalThis.MediaStream;
  globalThis.MediaStream = class FakeMediaStream {};
  try {
    const video = {
      captureStream() {
        const error = new Error('Cannot capture from element with cross-origin data');
        error.name = 'SecurityError';
        throw error;
      },
    };

    assert.throws(
      () => createVideoRecordingStream(video, null, () => 'FIT'),
      /local or CORS-enabled source/,
    );
  } finally {
    if (originalMediaStream === undefined) delete globalThis.MediaStream;
    else globalThis.MediaStream = originalMediaStream;
  }
});

test('recording download attaches a named link and activates it from the user action', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const calls = [];
  const link = {
    style: {},
    click() { calls.push(['click', this.href, this.download]); },
    remove() { calls.push(['remove']); },
  };

  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:recording-test' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: (url) => calls.push(['revoke', url]) });
  globalThis.document = {
    body: { appendChild(node) { calls.push(['append', node]); } },
    createElement(tag) { assert.equal(tag, 'a'); return link; },
  };
  globalThis.window = { setTimeout(callback, delay) { calls.push(['schedule-revoke', delay]); return 1; } };

  try {
    const downloadLink = createRecordingDownloadLink({ size: 3 }, 'sample recording');
    assert.equal(downloadLink.url, 'blob:recording-test');
    assert.match(downloadLink.filename, /^sample-recording-.*\.webm$/);
    assert.equal(downloadRecording({ size: 3 }, 'sample recording'), true);
    assert.equal(link.href, 'blob:recording-test');
    assert.match(link.download, /^sample-recording-.*\.webm$/);
    assert.deepEqual(calls.map(([name]) => name), ['append', 'click', 'remove', 'schedule-revoke']);
    assert.equal(downloadRecording({ size: 0 }, 'empty'), false);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
    else delete URL.createObjectURL;
    if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
    else delete URL.revokeObjectURL;
  }
});
