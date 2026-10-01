const fs = require('node:fs/promises');
const nodeFs = require('node:fs');
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

  async function mergeSegments(recording) {
    const outputPath = recording.finalPath;
    const output = await fs.open(outputPath, 'w');
    try {
      for (const segment of recording.segments) {
        for await (const chunk of nodeFs.createReadStream(segment)) {
          await output.writeFile(chunk);
        }
      }
    } finally {
      await output.close();
    }
    for (const segment of recording.segments) await fs.unlink(segment).catch(() => {});
    return waitForRecordingFile(outputPath);
  }

  async function writeSegment(recording) {
    const player = getPlayer();
    if (!player?.isEmbedded?.() || !player.source) throw new Error('LibVLC is not ready to record.');
    const filePath = `${recording.finalPath}.segment-${recording.segments.length + 1}`;
    const startTimeMs = Math.max(0, Number(player.getTime()) || 0);
    const wasPaused = player.isPaused();
    const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const sout = `#duplicate{dst=display,dst=std{access=file,mux=ts,dst="${escapedPath}"}}`;

    player.setSource(recording.source, {
      autoplay: !wasPaused,
      mediaOptions: [`:start-time=${startTimeMs / 1000}`, `:sout=${sout}`, ':sout-keep'],
    });
    recording.currentSegment = filePath;
    recording.paused = false;
    sendEvent?.('recording', { status: 'recording', path: filePath });
    return { ok: true, path: filePath };
  }

  async function start() {
    const player = getPlayer();
    if (!player?.isEmbedded?.() || !player.source) throw new Error('LibVLC is not ready to record.');
    if (activeRecording) throw new Error('A recording is already in progress.');

    const directory = path.join(app.getPath('videos'), 'CineCrew Recordings');
    await fs.mkdir(directory, { recursive: true });
    const finalPath = path.join(directory, `cinecrew-${new Date().toISOString().replace(/[:.]/g, '-')}.ts`);
    activeRecording = {
      finalPath,
      source: player.source,
      segments: [],
      currentSegment: null,
      paused: false,
    };
    try {
      const segment = await writeSegment(activeRecording);
      return { ...segment, path: finalPath, filename: path.basename(finalPath) };
    } catch (error) {
      activeRecording = null;
      throw error;
    }
  }

  async function pause() {
    const player = getPlayer();
    const recording = activeRecording;
    if (!recording || recording.paused || !recording.currentSegment || !player?.isEmbedded?.()) {
      throw new Error('There is no active recording to pause.');
    }
    const resumeTimeMs = Math.max(0, Number(player.getTime()) || 0);
    const wasPaused = player.isPaused();
    player.setSource(recording.source, {
      autoplay: !wasPaused,
      mediaOptions: [`:start-time=${resumeTimeMs / 1000}`],
    });
    const completedSegment = recording.currentSegment;
    recording.currentSegment = null;
    await waitForRecordingFile(completedSegment);
    recording.segments.push(completedSegment);
    recording.paused = true;
    sendEvent?.('recording', { status: 'paused', path: completedSegment });
    return { ok: true };
  }

  async function resume() {
    const recording = activeRecording;
    if (!recording || !recording.paused) throw new Error('There is no paused recording to resume.');
    return writeSegment(recording);
  }

  async function stop() {
    const player = getPlayer();
    if (!activeRecording || !player?.isEmbedded?.()) throw new Error('There is no active recording.');
    const recording = activeRecording;
    if (recording.currentSegment) {
      const resumeTimeMs = Math.max(0, Number(player.getTime()) || 0);
      const wasPaused = player.isPaused();
      // Close only the recording segment; the normal player keeps running.
      player.setSource(recording.source, {
        autoplay: !wasPaused,
        mediaOptions: [`:start-time=${resumeTimeMs / 1000}`],
      });
      const completedSegment = recording.currentSegment;
      recording.currentSegment = null;
      await waitForRecordingFile(completedSegment);
      recording.segments.push(completedSegment);
    }
    if (!recording.segments.length) throw new Error('LibVLC did not produce any recording segments.');
    const file = await mergeSegments(recording);
    activeRecording = null;
    const result = { ok: true, path: recording.finalPath, filename: path.basename(recording.finalPath), size: file.size };
    sendEvent?.('recording', { status: 'stopped', ...result });
    return result;
  }

  async function finalizeBeforeUnmount() {
    if (!activeRecording) return null;
    return stop();
  }

  function registerIpc(ipcMain) {
    ipcMain.handle('cinecrew:vlc:record-start', start);
    ipcMain.handle('cinecrew:vlc:record-pause', pause);
    ipcMain.handle('cinecrew:vlc:record-resume', resume);
    ipcMain.handle('cinecrew:vlc:record-stop', stop);
  }

  return {
    start,
    pause,
    resume,
    stop,
    registerIpc,
    finalizeBeforeUnmount,
    isActive: () => Boolean(activeRecording),
  };
}

module.exports = { createVlcRecordingController };
