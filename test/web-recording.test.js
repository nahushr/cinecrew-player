import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecordingDownloadLink, createVideoRecordingStream, downloadRecording } from '../src/utils/webRecording.js';

test('cross-origin capture failures allow the screen-capture fallback', () => {
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

    assert.equal(createVideoRecordingStream(video, null, () => 'FIT'), null);
  } finally {
    if (originalMediaStream === undefined) delete globalThis.MediaStream;
    else globalThis.MediaStream = originalMediaStream;
  }
});

test('OGV canvas recording keeps the decoded audio stream and supports aspect-ratio rendering', () => {
  const originalMediaStream = globalThis.MediaStream;
  const originalDocument = globalThis.document;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const tracks = [];
  class FakeMediaStream {
    constructor(items) { this.tracks = items; }
    getTracks() { return this.tracks; }
    getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
    getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
  }
  const sourceVideoTrack = { kind: 'video', stop() { tracks.push('source-video'); } };
  const outputVideoTrack = { kind: 'video', stop() { tracks.push('output-video'); } };
  const audioTrack = { kind: 'audio', stop() { tracks.push('audio'); } };
  const audioStream = new FakeMediaStream([audioTrack]);
  const drawingCalls = [];
  const canvasContext = {
    fillRect() {},
    drawImage(...args) { drawingCalls.push(args); },
    getImageData() { return {}; },
  };
  const recordingCanvas = {
    width: 0,
    height: 0,
    getContext() { return canvasContext; },
    captureStream() { return new FakeMediaStream([outputVideoTrack]); },
  };
  const ogvCanvas = {
    width: 640,
    height: 360,
    captureStream() { return new FakeMediaStream([sourceVideoTrack]); },
  };
  globalThis.MediaStream = FakeMediaStream;
  globalThis.document = { createElement(tag) { assert.equal(tag, 'canvas'); return recordingCanvas; } };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};

  try {
    const player = {
      videoWidth: 640,
      videoHeight: 360,
      __cinecrewRecordingCanvas: ogvCanvas,
      __cinecrewRecordingAudioStream: audioStream,
    };
    const fit = createVideoRecordingStream(player, null, () => 'FIT');
    assert.deepEqual(fit.stream.getVideoTracks(), [sourceVideoTrack]);
    assert.deepEqual(fit.stream.getAudioTracks(), [audioTrack]);

    const square = createVideoRecordingStream(player, null, () => '1:1');
    assert.deepEqual(square.stream.getVideoTracks(), [outputVideoTrack]);
    assert.deepEqual(square.stream.getAudioTracks(), [audioTrack]);
    assert.ok(drawingCalls.some(([source]) => source === ogvCanvas));
    assert.equal(recordingCanvas.width, 640);
    assert.equal(recordingCanvas.height, 360);

    fit.cleanup();
    square.cleanup();
    assert.ok(tracks.includes('source-video'));
    assert.ok(tracks.includes('output-video'));
    assert.ok(!tracks.includes('audio'));
  } finally {
    if (originalMediaStream === undefined) delete globalThis.MediaStream;
    else globalThis.MediaStream = originalMediaStream;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    if (originalCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
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
