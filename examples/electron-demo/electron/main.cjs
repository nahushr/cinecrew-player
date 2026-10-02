const path = require('node:path');
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { createVlcRecordingController } = require(app.isPackaged
  ? '@cinecrew/cinecrew-player/electron/main'
  : path.join(__dirname, '../../../src/electron/main/recording.cjs'));

let mainWindow;
let controlsWindow;
let vlcPlayer;
let playerWindowId;
let progressTimer;
let playerModulePromise;
let layoutUpdateQueue = Promise.resolve();
let cachedContentInsets = null;

const sendPlayerEvent = (type, values = {}) => {
  const target = controlsWindow && !controlsWindow.isDestroyed() ? controlsWindow : mainWindow;
  if (!target || target.isDestroyed()) return;
  target.webContents.send('cinecrew:vlc:event', { type, ...values });
};

const recordingController = createVlcRecordingController({
  app,
  getPlayer: () => vlcPlayer,
  sendEvent: sendPlayerEvent,
});

function normalizeContainerRect(rect = {}) {
  const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  return {
    x: numberOr(rect.x, 0),
    y: numberOr(rect.y, 0),
    width: Math.max(1, numberOr(rect.width, 1)),
    height: Math.max(1, numberOr(rect.height, 1)),
  };
}

async function setHostStageBounds(rect) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  const bounds = normalizeContainerRect(rect);
  const css = `position:fixed;left:${bounds.x}px;top:${bounds.y}px;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;background:#000;`;
  await mainWindow.webContents.executeJavaScript(`(() => {
    const stage = document.getElementById('cinecrew-electron-vlc-stage');
    if (!stage) return false;
    stage.style.cssText = ${JSON.stringify(css)};
    const rect = stage.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  })()`);
}

function syncControlsWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !controlsWindow || controlsWindow.isDestroyed()) return;
  const windowBounds = mainWindow.getBounds();
  const contentBounds = mainWindow.getContentBounds();
  const [contentWidth, contentHeight] = mainWindow.getContentSize();
  // Cache the normal content inset before fullscreen changes. On macOS,
  // getContentBounds() can report the old fullscreen dimensions briefly after
  // leaving fullscreen; using it then makes the transparent controls window
  // (and the VLC stage it measures) remain screen-sized over the demo page.
  const contentBoundsAreStale = contentBounds.width > windowBounds.width + 8
    || contentBounds.height > windowBounds.height + 8
    || contentBounds.width > contentWidth + 8
    || contentBounds.height > contentHeight + 8;
  if (!mainWindow.isFullScreen() && !contentBoundsAreStale) {
    cachedContentInsets = {
      x: contentBounds.x - windowBounds.x,
      y: contentBounds.y - windowBounds.y,
    };
  }
  // In fullscreen, use the full native frame so controls cover the video up
  // to the screen edges. Otherwise reconstruct the content rectangle from
  // the current window size and the last known titlebar/frame inset.
  const bounds = mainWindow.isFullScreen()
    ? windowBounds
    : contentBoundsAreStale && cachedContentInsets
      ? {
          x: windowBounds.x + cachedContentInsets.x,
          y: windowBounds.y + cachedContentInsets.y,
          width: contentWidth,
          height: contentHeight,
        }
      : contentBounds;
  controlsWindow.setBounds(bounds);
}

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
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('The LibVLC surface host is not ready.');
  await setHostStageBounds(event.args?.containerRect);
  if (vlcPlayer && playerWindowId === mainWindow.webContents.id && !vlcPlayer.destroyed) {
    await vlcPlayer.embed();
    vlcPlayer.notifyLayoutChange();
    return { ok: true };
  }
  if (vlcPlayer) await unmountPlayer();

  const { VlcPlayer } = await loadVlcModule();
  vlcPlayer = new VlcPlayer({
    window: mainWindow,
    container: '#cinecrew-electron-vlc-stage',
    vlcDir: resolveVlcDir(),
    controls: false,
    pageFullscreenButton: false,
    hardwareAcceleration: process.platform === 'darwin' ? 'videotoolbox' : 'd3d11va',
  });
  playerWindowId = mainWindow.webContents.id;
  await vlcPlayer.embed();
  bindPlayerEvents();
  return { ok: true };
}

async function unmountPlayer() {
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  await recordingController.finalizeBeforeUnmount().catch(() => {});
  if (vlcPlayer) {
    vlcPlayer.destroy();
    vlcPlayer = null;
    playerWindowId = null;
  }
  return { ok: true };
}

function registerIpc() {
  ipcMain.handle('cinecrew:vlc:mount', (event, payload = {}) => mountPlayer({ sender: event.sender, args: payload }));
  ipcMain.handle('cinecrew:vlc:unmount', unmountPlayer);
  recordingController.registerIpc(ipcMain);
  ipcMain.handle('cinecrew:window:set-fullscreen', async (_event, fullscreen) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
    const requested = Boolean(fullscreen);
    if (vlcPlayer && !vlcPlayer.destroyed) {
      // The VLC layout controller snapshots/restores the native video bounds
      // around fullscreen. Calling BrowserWindow.setFullScreen directly skips
      // that recovery and leaves the embedded surface expanded after exit.
      await vlcPlayer.setFullScreen(requested);
    } else if (mainWindow.isFullScreen() !== requested) {
      mainWindow.setFullScreen(requested);
    }
    return { ok: true, isFullscreen: mainWindow.isFullScreen() };
  });
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
  ipcMain.on('cinecrew:vlc:layout', (_event, rect) => {
    layoutUpdateQueue = layoutUpdateQueue
      .then(() => setHostStageBounds(rect))
      .then(() => vlcPlayer?.notifyLayoutChange())
      .catch((error) => {
        sendPlayerEvent('error', { message: error?.message || 'Could not update the LibVLC video layout.' });
      });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 760,
    minHeight: 560,
    backgroundColor: '#07111e',
    show: false,
    title: 'CineCrew Player · Electron LibVLC Demo',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
    query: { electronSurfaceHost: '1' },
  });

  controlsWindow = new BrowserWindow({
    ...mainWindow.getContentBounds(),
    parent: mainWindow,
    modal: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    focusable: true,
    ...(process.platform === 'darwin' ? { acceptFirstMouse: true } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: ['--cinecrew-electron-overlay'],
    },
  });
  await controlsWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
    query: { electronOverlay: '1' },
  });
  syncControlsWindowBounds();
  mainWindow.show();
  controlsWindow.showInactive();

  const syncOverlay = () => setTimeout(syncControlsWindowBounds, 0);
  const syncOverlayAfterFullscreen = () => {
    [0, 50, 150].forEach((delay) => setTimeout(syncControlsWindowBounds, delay));
  };
  for (const eventName of ['move', 'resize', 'maximize', 'unmaximize']) {
    mainWindow.on(eventName, syncOverlay);
  }
  mainWindow.on('enter-full-screen', () => {
    syncOverlayAfterFullscreen();
    sendPlayerEvent('fullscreen', { isFullscreen: true });
  });
  mainWindow.on('leave-full-screen', () => {
    syncOverlayAfterFullscreen();
    sendPlayerEvent('fullscreen', { isFullscreen: false });
  });
  mainWindow.on('focus', () => {
    if (controlsWindow && !controlsWindow.isDestroyed() && !controlsWindow.isVisible()) {
      controlsWindow.showInactive();
    }
    syncControlsWindowBounds();
  });
  mainWindow.on('minimize', () => controlsWindow?.hide());
  mainWindow.on('restore', () => {
    syncControlsWindowBounds();
    controlsWindow?.showInactive();
  });

  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (_event, _level, message) => {
      console.error('[renderer console]', message);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[renderer] process exited:', details.reason, details.exitCode);
    });
  }

  controlsWindow.on('closed', () => { controlsWindow = null; });
  mainWindow.on('closed', () => {
    controlsWindow?.close();
    controlsWindow = null;
    mainWindow = null;
  });
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
