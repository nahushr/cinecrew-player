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
