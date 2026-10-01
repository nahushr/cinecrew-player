const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createVlcRecordingController } = require('../src/electron/main/recording.cjs');

test('the package-owned Electron recorder starts, finalizes, and returns its file', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cinecrew-recording-'));
  const events = [];
  const source = 'https://example.test/live.ts';
  let currentTime = 12345;
  const player = {
    source,
    isEmbedded: () => true,
    isPaused: () => false,
    getTime: () => currentTime,
    setSource: (nextSource, options) => {
      assert.equal(nextSource, source);
      if (!options.mediaOptions.some((option) => option.startsWith(':sout='))) return;
      const sout = options.mediaOptions.find((option) => option.startsWith(':sout=')).slice(':sout='.length);
      const outputPath = sout.match(/dst="(.+)"\}\}$/)?.[1];
      assert.ok(outputPath, 'LibVLC stream output should include the generated destination path');
      fs.writeFileSync(outputPath, Buffer.from('recorded transport stream'));
    },
  };
  const controller = createVlcRecordingController({
    app: { getPath: () => directory },
    getPlayer: () => player,
    sendEvent: (type, values) => events.push({ type, ...values }),
  });
  const ipcChannels = new Set();
  controller.registerIpc({ handle: (channel) => ipcChannels.add(channel) });
  assert.deepEqual([...ipcChannels].sort(), [
    'cinecrew:vlc:record-pause',
    'cinecrew:vlc:record-resume',
    'cinecrew:vlc:record-start',
    'cinecrew:vlc:record-stop',
  ]);

  try {
    const started = await controller.start();
    assert.match(started.filename, /^cinecrew-.*\.ts$/);
    assert.equal(controller.isActive(), true);
    assert.ok(events.some((event) => event.type === 'recording' && event.status === 'recording'));

    currentTime = 23456;
    const stopped = await controller.stop();
    assert.equal(stopped.path, started.path);
    assert.equal(stopped.size, Buffer.byteLength('recorded transport stream'));
    assert.equal(controller.isActive(), false);
    assert.ok(events.some((event) => event.type === 'recording' && event.status === 'stopped'));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('pausing the package-owned Electron recorder keeps playback running and joins resumed segments', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cinecrew-recording-pause-'));
  const source = 'https://example.test/live.ts';
  const contents = [];
  let currentTime = 12000;
  let playbackPauseCalls = 0;
  let playbackResumeCalls = 0;
  const player = {
    source,
    isEmbedded: () => true,
    isPaused: () => false,
    getTime: () => currentTime,
    pause: () => { playbackPauseCalls += 1; },
    play: () => { playbackResumeCalls += 1; },
    setSource: (nextSource, options) => {
      assert.equal(nextSource, source);
      const sout = options.mediaOptions.find((option) => option.startsWith(':sout='));
      if (!sout) return;
      const outputPath = sout.slice(':sout='.length).match(/dst="(.+?)"/)?.[1];
      assert.ok(outputPath);
      const bytes = Buffer.from(`segment-${contents.length + 1}`);
      contents.push(bytes);
      fs.writeFileSync(outputPath, bytes);
    },
  };
  const controller = createVlcRecordingController({
    app: { getPath: () => directory },
    getPlayer: () => player,
  });

  try {
    const started = await controller.start();
    currentTime = 25000;
    await controller.pause();
    assert.equal(controller.isActive(), true);
    assert.equal(playbackPauseCalls, 0, 'pausing capture must not pause the player');
    currentTime = 41000;
    await controller.resume();
    assert.equal(playbackResumeCalls, 0, 'resuming capture must not change player playback state');
    currentTime = 53000;
    const completed = await controller.stop();
    const expected = Buffer.concat(contents);
    assert.equal(completed.path, started.path);
    assert.equal(completed.size, expected.length);
    assert.deepEqual(fs.readFileSync(completed.path), expected);
    assert.equal(controller.isActive(), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
