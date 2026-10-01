const fs = require('node:fs/promises');
const path = require('node:path');

function createVlcRecordingController({ app, getPlayer, sendEvent }) {
  let activeRecording = null;

  async function waitForRecordingFile(filePath) {
    let lastSize = 0;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const file = await fs.stat(filePath);
        if (file.size > 0 && file.size === lastSize) return file;
        lastSize = file.size;
      } catch {
        // LibVLC can take a moment to close and flush its output file.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (lastSize > 0) return fs.stat(filePath);
    throw new Error('LibVLC finished without writing a recording file.');
  }

  async function start() {
    const player = getPlayer();
    if (!player?.isEmbedded?.() || !player.source) throw new Error('LibVLC is not ready to record.');
    if (activeRecording) throw new Error('A recording is already in progress.');

    const directory = path.join(app.getPath('videos'), 'CineCrew Recordings');
    await fs.mkdir(directory, { recursive: true });
    const filePath = path.join(directory, `cinecrew-${new Date().toISOString().replace(/[:.]/g, '-')}.ts`);
    const source = player.source;
    const startTimeMs = Math.max(0, Number(player.getTime()) || 0);
    const wasPaused = player.isPaused();
    const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const sout = `#duplicate{dst=display,dst=std{access=file,mux=ts,dst="${escapedPath}"}}`;

    player.setSource(source, {
      autoplay: !wasPaused,
      mediaOptions: [`:start-time=${startTimeMs / 1000}`, `:sout=${sout}`, ':sout-keep'],
    });
    activeRecording = { path: filePath, source, startTimeMs };
    sendEvent?.('recording', { status: 'recording', path: filePath });
    return { ok: true, path: filePath, filename: path.basename(filePath) };
  }

  async function stop() {
    const player = getPlayer();
    if (!activeRecording || !player?.isEmbedded?.()) throw new Error('There is no active recording.');
    const recording = activeRecording;
    const resumeTimeMs = Math.max(0, Number(player.getTime()) || recording.startTimeMs);
    const wasPaused = player.isPaused();

    // Reload the source to close LibVLC's stream-output writer, then continue
    // from the same timestamp without leaving playback in recording mode.
    player.setSource(recording.source, {
      autoplay: !wasPaused,
      mediaOptions: [`:start-time=${resumeTimeMs / 1000}`],
    });
    activeRecording = null;
    const file = await waitForRecordingFile(recording.path);
    sendEvent?.('recording', { status: 'stopped', path: recording.path, size: file.size });
    return { ok: true, path: recording.path, filename: path.basename(recording.path), size: file.size };
  }

  async function finalizeBeforeUnmount() {
    if (!activeRecording) return null;
    return stop();
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('cinecrew:vlc:record-start', start);
    ipcMain.handle('cinecrew:vlc:record-stop', stop);
  }

  return {
    start,
    stop,
    registerIpc,
    finalizeBeforeUnmount,
    isActive: () => Boolean(activeRecording),
  };
}

module.exports = { createVlcRecordingController };
