const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { pathToFileURL } = require('url');

const isOverlayWindow = process.argv.includes('--cinecrew-electron-overlay');

const invokeChannels = new Set([
  'cinecrew:vlc:mount',
  'cinecrew:vlc:unmount',
  'cinecrew:vlc:load',
  'cinecrew:vlc:set-paused',
  'cinecrew:vlc:set-volume',
  'cinecrew:vlc:set-rate',
  'cinecrew:vlc:set-audio-track',
  'cinecrew:vlc:set-audio-only',
  'cinecrew:vlc:set-aspect-ratio',
  'cinecrew:vlc:seek',
  'cinecrew:vlc:seek-to',
  'cinecrew:vlc:unmount',
]);
const sendChannels = new Set(['cinecrew:vlc:layout']);
const listeners = new Map();

contextBridge.exposeInMainWorld('cinecrewRuntime', {
  isElectron: true,
  isElectronOverlay: isOverlayWindow,
});
contextBridge.exposeInMainWorld('cinecrewVlc', {
  invoke(channel, payload) {
    if (!invokeChannels.has(channel)) return Promise.reject(new Error(`Unsupported VLC request: ${channel}`));
    return ipcRenderer.invoke(channel, payload);
  },
  send(channel, payload) {
    if (!sendChannels.has(channel)) throw new Error(`Unsupported VLC event: ${channel}`);
    ipcRenderer.send(channel, payload);
  },
  on(channel, listener) {
    if (channel !== 'cinecrew:vlc:event' || typeof listener !== 'function') return;
    const wrapped = (_event, payload) => listener({}, payload);
    const channelListeners = listeners.get(channel) || new Map();
    channelListeners.set(listener, wrapped);
    listeners.set(channel, channelListeners);
    ipcRenderer.on(channel, wrapped);
  },
  removeListener(channel, listener) {
    const wrapped = listeners.get(channel)?.get(listener);
    if (!wrapped) return;
    ipcRenderer.removeListener(channel, wrapped);
    listeners.get(channel).delete(listener);
  },
  getFileUrl(file) {
    const filePath = webUtils.getPathForFile(file);
    if (!filePath) throw new Error('Electron could not resolve the selected local file.');
    return pathToFileURL(filePath).href;
  },
});
