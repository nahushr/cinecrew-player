import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const RECORDING_TIMEOUT_MS = 20_000;
const START_TIMEOUT_MS = 8_000;

function nativePath(uri) {
  return decodeURIComponent(String(uri).replace(/^file:\/\//, ''));
}

function fileUri(path) {
  const value = String(path || '');
  return value.startsWith('file://') ? value : `file://${value}`;
}

function getShareMetadata(uri) {
  const extension = String(uri).split('?')[0].split('.').pop()?.toLowerCase();
  const metadata = {
    '3gp': { mimeType: 'video/3gpp', UTI: 'public.3gpp' },
    flv: { mimeType: 'video/x-flv', UTI: 'com.adobe.flash.video' },
    m4v: { mimeType: 'video/x-m4v', UTI: 'com.apple.m4v-video' },
    mkv: { mimeType: 'video/x-matroska', UTI: 'org.matroska.mkv' },
    mov: { mimeType: 'video/quicktime', UTI: 'com.apple.quicktime-movie' },
    mp4: { mimeType: 'video/mp4', UTI: 'public.mpeg-4' },
    ts: { mimeType: 'video/mp2t', UTI: 'public.mpeg-2-transport-stream' },
    webm: { mimeType: 'video/webm', UTI: 'org.webmproject.webm' },
  };
  return metadata[extension] || { mimeType: 'video/mp4', UTI: 'public.mpeg-4' };
}

export function createVlcRecordingAdapter(onStatus) {
  let player = null;
  let outputDirectory = '';
  let active = false;
  let reportedRecordingPath = '';
  let resolveStart;
  let rejectStart;
  let startTimeout;
  let ticker;
  let knownFiles = new Set();
  let status = { status: 'idle', elapsedMs: 0 };
  const listeners = new Set();
  let startedAt = 0;
  let elapsedBeforePause = 0;

  const publish = (nextStatus, elapsedMs = status.elapsedMs, details = {}) => {
    status = { status: nextStatus, elapsedMs, ...details };
    onStatus?.(status);
    listeners.forEach((listener) => listener(status));
  };

  const elapsedNow = () => elapsedBeforePause + (status.status === 'recording' ? Date.now() - startedAt : 0);
  const startTicker = () => {
    if (ticker) clearInterval(ticker);
    ticker = setInterval(() => publish('recording', elapsedNow()), 1000);
  };
  const clearTicker = () => {
    if (ticker) clearInterval(ticker);
    ticker = undefined;
  };

  return {
    supportsOnDemand: true,
    isActive: () => active,
    subscribe(listener) {
      listeners.add(listener);
      listener(status);
      return () => listeners.delete(listener);
    },
    async start({ player: api }) {
      player = api;
      try {
        if (typeof player?.startNativeRecording !== 'function') {
          throw new Error('Native VLC recording is unavailable. Open this demo in its Android/iOS development build, not Expo Go.');
        }
        const root = FileSystem.cacheDirectory;
        if (!root) throw new Error('The app cache directory is unavailable.');
        outputDirectory = `${root}cinecrew-recordings/`;
        await FileSystem.makeDirectoryAsync(outputDirectory, { intermediates: true });
        knownFiles = await snapshotFiles(outputDirectory);
        reportedRecordingPath = '';

        const started = new Promise((resolve, reject) => {
          resolveStart = resolve;
          rejectStart = reject;
          startTimeout = setTimeout(() => {
            resolveStart = undefined;
            rejectStart = undefined;
            reject(new Error('VLC did not confirm that recording started.'));
          }, START_TIMEOUT_MS);
        });
        if (!player.startNativeRecording(nativePath(outputDirectory))) {
          throw new Error('The VLC native recorder is not attached to the active player.');
        }

        const startResult = await started;
        if (!startResult.requestAccepted) {
          throw new Error(startResult.error || 'VLC rejected the recording request for this media source.');
        }
        startedAt = Date.now();
        elapsedBeforePause = 0;
        active = true;
        publish('recording', 0);
        startTicker();
      } catch (error) {
        active = false;
        if (startTimeout) clearTimeout(startTimeout);
        resolveStart = undefined;
        rejectStart = undefined;
        publish('error', 0, { message: error?.message || 'Could not start VLC recording.' });
        throw error;
      }
    },
    async pause() {
      if (!active || status.status !== 'recording') return;
      elapsedBeforePause += Date.now() - startedAt;
      clearTicker();
      player?.pause?.();
      publish('paused', elapsedBeforePause);
    },
    async resume() {
      if (!active || status.status !== 'paused') return;
      startedAt = Date.now();
      player?.play?.();
      publish('recording', elapsedBeforePause);
      startTicker();
    },
    async stop() {
      if (!active) return {};
      try {
        if (!player?.stopNativeRecording?.()) {
          throw new Error('VLC could not stop the active recording.');
        }
        clearTicker();
        const { uri, info } = await waitForCompletedRecording(
          () => reportedRecordingPath,
          outputDirectory,
          knownFiles,
          RECORDING_TIMEOUT_MS,
        );
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            dialogTitle: 'Save CineCrew recording',
            ...getShareMetadata(uri),
          });
        }
        const result = { filename: uri.split('/').pop(), uri, size: info.size };
        publish('saved', elapsedNow(), result);
        return result;
      } catch (error) {
        publish('error', elapsedNow(), { message: error?.message || 'VLC could not save the recording.' });
        throw error;
      } finally {
        active = false;
        reportedRecordingPath = '';
        clearTicker();
        publish('idle', 0);
      }
    },
    onNativeRecordingState(event = {}) {
      if (event.operation === 'start' && resolveStart) {
        if (startTimeout) clearTimeout(startTimeout);
        const resolve = resolveStart;
        const reject = rejectStart;
        resolveStart = undefined;
        rejectStart = undefined;
        if (event.requestAccepted) resolve(event);
        else reject(new Error(event.error || 'VLC rejected the recording request for this media source.'));
      }
    },
    onNativeRecordingCreated(path) {
      if (path) reportedRecordingPath = path;
    },
    dispose() {
      if (startTimeout) clearTimeout(startTimeout);
      clearTicker();
      rejectStart?.(new Error('Recording adapter was disposed before recording started.'));
      listeners.clear();
    },
  };
}

async function findCompletedRecording(reportedPath, directoryUri, previousFiles) {
  const checkFile = async (uri) => {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory && info.size > 0 ? { uri, info } : null;
  };
  const reportedUri = reportedPath ? fileUri(reportedPath) : '';
  if (reportedUri) {
    const file = await checkFile(reportedUri);
    if (file) return file;
    const directory = await FileSystem.getInfoAsync(reportedUri);
    if (directory.exists && directory.isDirectory) {
      const names = await listChangedFileNames(`${reportedUri.replace(/\/$/, '')}/`, previousFiles);
      for (const name of names) {
        const result = await checkFile(`${reportedUri.replace(/\/$/, '')}/${name}`);
        if (result) return result;
      }
    }
  }

  const names = await listChangedFileNames(directoryUri, previousFiles);
  for (const name of names) {
    const result = await checkFile(`${directoryUri}${name}`);
    if (result) return result;
  }
  return null;
}

async function snapshotFiles(directoryUri) {
  const names = await FileSystem.readDirectoryAsync(directoryUri);
  const entries = await Promise.all(names.map(async (name) => {
    const info = await FileSystem.getInfoAsync(`${directoryUri}${name}`);
    return [name, info.exists && !info.isDirectory
      ? { size: info.size || 0, modificationTime: info.modificationTime || 0 }
      : null];
  }));
  return new Map(entries);
}

async function listChangedFileNames(directoryUri, previousFiles) {
  const names = await FileSystem.readDirectoryAsync(directoryUri);
  const candidates = await Promise.all(names.map(async (name) => {
    const info = await FileSystem.getInfoAsync(`${directoryUri}${name}`);
    if (!info.exists || info.isDirectory || !info.size) return null;
    const previous = previousFiles.get(name);
    const changed = !previous
      || previous.size !== info.size
      || previous.modificationTime !== (info.modificationTime || 0);
    return changed ? { name, modificationTime: info.modificationTime || 0 } : null;
  }));
  return candidates
    .filter(Boolean)
    .sort((left, right) => right.modificationTime - left.modificationTime)
    .map(({ name }) => name);
}

async function waitForCompletedRecording(getReportedPath, directoryUri, previousFiles, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let previousFingerprint = '';
  let stablePolls = 0;

  while (Date.now() < deadline) {
    const file = await findCompletedRecording(getReportedPath(), directoryUri, previousFiles);
    if (file) {
      const fingerprint = `${file.uri}:${file.info.size}`;
      stablePolls = fingerprint === previousFingerprint ? stablePolls + 1 : 0;
      previousFingerprint = fingerprint;
      // Wait for the muxer to flush and close the file before opening the share sheet.
      if (stablePolls >= 2) return file;
    } else {
      previousFingerprint = '';
      stablePolls = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error('VLC stopped, but no completed non-empty recording file appeared in the recordings folder.');
}
