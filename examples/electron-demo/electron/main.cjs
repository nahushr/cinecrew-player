const path = require('node:path');
const { app, BrowserWindow, ipcMain, Menu } = require('electron');

let mainWindow;
let vlcPlayer;
let playerWindowId;
let progressTimer;
let playerModulePromise;

const sendPlayerEvent = (type, values = {}) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('cinecrew:vlc:event', { type, ...values });
};

function resolveVlcDir() {
  if (process.env.CINECREW_VLC_DIR) return process.env.CINECREW_VLC_DIR;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'vlc', process.platform === 'darwin' ? 'macos' : 'windows');
  }
  if (process.platform === 'darwin') return '/Applications/VLC.app/Contents/MacOS';
  if (process.platform === 'win32') return path.join(process.env.ProgramFiles || 'C:\\Program Files', 'VideoLAN', 'VLC');
  throw new Error('The LibVLC desktop demo currently supports macOS and Windows.');
}

function publishProgress() {
  if (!vlcPlayer || !vlcPlayer.isEmbedded() || !vlcPlayer.source) return;
  try {
    const currentTime = Math.max(0, Number(vlcPlayer.getTime()) || 0);
    const duration = Math.max(0, Number(vlcPlayer.getLength()) || 0);
    sendPlayerEvent('progress', {
      currentTime,
      duration,
      position: duration > 0 ? Math.min(1, currentTime / duration) : 0,
    });
  } catch {
    // LibVLC can temporarily report no active media while switching sources.
  }
}

function readAudioTracks() {
  try {
    return vlcPlayer.getAudioTracks().map((track) => ({
      id: String(track.id),
      name: track.name || track.description || `Audio ${track.id}`,
    }));
  } catch {
    return [];
  }
}

function bindPlayerEvents() {
  vlcPlayer.on('playing', () => {
    sendPlayerEvent('playing', { audioTracks: readAudioTracks() });
    sendPlayerEvent('buffering', { isBuffering: false });
  });
  vlcPlayer.on('paused', () => sendPlayerEvent('paused'));
  vlcPlayer.on('buffering', (event) => {
    const value = typeof event === 'number' ? event : Number(event?.cache ?? event?.value ?? 100);
    sendPlayerEvent('buffering', { isBuffering: value < 100 });
  });
  vlcPlayer.on('endReached', () => sendPlayerEvent('ended'));
  vlcPlayer.on('error', (error) => sendPlayerEvent('error', {
    message: error?.message || String(error || 'libVLC reported an unknown playback error.'),
  }));
  vlcPlayer.on('audioTrackChanged', () => sendPlayerEvent('tracks', { audioTracks: readAudioTracks() }));
  progressTimer = setInterval(publishProgress, 250);
}

async function loadVlcModule() {
  if (!playerModulePromise) playerModulePromise = import('electron-vlc-player');
  return playerModulePromise;
}

async function mountPlayer(event) {
  if (vlcPlayer && playerWindowId === event.sender.id && !vlcPlayer.destroyed) {
    await vlcPlayer.embed();
    return { ok: true };
  }
  if (vlcPlayer) await unmountPlayer();

  const { VlcPlayer } = await loadVlcModule();
  const hostWindow = BrowserWindow.fromWebContents(event.sender);
  if (!hostWindow) throw new Error('Could not find the Electron window for the VLC renderer.');
  vlcPlayer = new VlcPlayer({
    window: hostWindow,
    container: '#cinecrew-electron-vlc-stage',
    vlcDir: resolveVlcDir(),
    controls: false,
    pageFullscreenButton: false,
    hardwareAcceleration: process.platform === 'darwin' ? 'videotoolbox' : 'd3d11va',
  });
  playerWindowId = event.sender.id;
  await vlcPlayer.embed();
  bindPlayerEvents();
  return { ok: true };
}

async function unmountPlayer() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  if (vlcPlayer) {
    vlcPlayer.destroy();
    vlcPlayer = null;
    playerWindowId = null;
  }
  return { ok: true };
}

function registerIpc() {
  ipcMain.handle('cinecrew:vlc:mount', mountPlayer);
  ipcMain.handle('cinecrew:vlc:unmount', unmountPlayer);
  ipcMain.handle('cinecrew:vlc:load', async (_event, payload = {}) => {
    if (!vlcPlayer?.isEmbedded()) throw new Error('LibVLC is not mounted yet.');
    const source = String(payload.source || '').trim();
    if (!/^(https?:|file:)/i.test(source)) {
      throw new Error('LibVLC expects an HTTP(S) stream URL or a local file URL.');
    }
    vlcPlayer.setSource(source, { autoplay: payload.paused !== true });
    vlcPlayer.setRate(Math.max(0.25, Math.min(2, Number(payload.playbackRate) || 1)));
    vlcPlayer.setVolume(Math.max(0, Math.min(100, Number(payload.volume) || 0)));
    vlcPlayer.setMute(payload.muted === true);
    return { ok: true };
  });
  ipcMain.handle('cinecrew:vlc:set-paused', (_event, paused) => {
    vlcPlayer?.setPaused(Boolean(paused));
    return { ok: true };
  });
  ipcMain.handle('cinecrew:vlc:set-volume', (_event, payload = {}) => {
    if (vlcPlayer?.isEmbedded()) {
      vlcPlayer.setVolume(Math.max(0, Math.min(100, Number(payload.volume) || 0)));
      vlcPlayer.setMute(payload.muted === true);
    }
    return { ok: true };
  });
  ipcMain.handle('cinecrew:vlc:set-rate', (_event, rate) => {
    if (vlcPlayer?.isEmbedded()) vlcPlayer.setRate(Math.max(0.25, Math.min(2, Number(rate) || 1)));
    return { ok: true };
  });
  ipcMain.handle('cinecrew:vlc:set-audio-track', (_event, trackId) => {
    const numericTrackId = Number(trackId);
    if (vlcPlayer?.isEmbedded() && Number.isInteger(numericTrackId)) vlcPlayer.setAudioTrack(numericTrackId);
    return { ok: true };
  });
  ipcMain.handle('cinecrew:vlc:set-audio-only', () => ({ ok: true }));
  ipcMain.handle('cinecrew:vlc:set-aspect-ratio', (_event, ratio) => {
    if (!vlcPlayer?.isEmbedded()) return { ok: true };
    const value = String(ratio || '').trim();
    const vlcAspect = ['FIT', 'FILL', 'FILL_SCREEN', 'STRETCH', 'AUTO'].includes(value.toUpperCase()) ? '' : value;
    vlcPlayer.setAspectRatio(vlcAspect);
    return { ok: true };
  });
  ipcMain.handle('cinecrew:vlc:seek', (_event, position) => {
    if (vlcPlayer?.isEmbedded()) vlcPlayer.setPosition(Math.max(0, Math.min(0.999, Number(position) || 0)));
    return { ok: true };
  });
  ipcMain.handle('cinecrew:vlc:seek-to', (_event, time) => {
    if (vlcPlayer?.isEmbedded()) vlcPlayer.setTime(Math.max(0, Number(time) || 0));
    return { ok: true };
  });
  ipcMain.on('cinecrew:vlc:layout', () => vlcPlayer?.notifyLayoutChange());
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#07111e',
    title: 'CineCrew Player · Electron LibVLC Demo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (app.isPackaged) await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  else await mainWindow.loadURL('http://127.0.0.1:5180');

  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (details) => {
      console.error('[renderer console]', details);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[renderer] process exited:', details.reason, details.exitCode);
    });
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  registerIpc();
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('before-quit', () => { void unmountPlayer(); });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
