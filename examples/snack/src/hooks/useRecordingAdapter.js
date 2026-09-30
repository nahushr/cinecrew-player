import { useRef } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { isAndroid, nativePath } from '../constants';

export function useRecordingAdapter(setStatus) {
  const adapterRef = useRef(null);
  if (!adapterRef.current) {
    let playerApi;
    let recordingPath = '';
    let resolvePath;
    let timer;
    let active = false;
    let current = { status: 'idle', elapsedMs: 0 };
    const listeners = new Set();
    const publish = (status, elapsedMs = 0) => {
      current = { status, elapsedMs };
      listeners.forEach((listener) => listener(current));
    };
    adapterRef.current = {
      supportsOnDemand: true,
      isActive: () => active,
      subscribe(listener) { listeners.add(listener); listener(current); return () => listeners.delete(listener); },
      async start({ player }) {
        playerApi = player;
        const dir = new Directory(Paths.cache, 'cinecrew-recordings');
        dir.create({ intermediates: true, idempotent: true });
        const outputFile = new File(dir, `cinecrew-${Date.now()}.ts`);
        recordingPath = outputFile.uri;
        const commandPath = isAndroid() ? nativePath(dir.uri) : nativePath(recordingPath);
        active = !!playerApi?.startNativeRecording?.(commandPath);
        if (!active) throw new Error('VLC recording is not available in Expo Go. Use the Android/iOS development build to record media.');
        publish('recording', 0);
        setStatus('VLC recording started');
      },
      async pause() { if (active) { playerApi?.pause?.(); publish('paused', current.elapsedMs); } },
      async resume() { if (active) { playerApi?.play?.(); publish('recording', current.elapsedMs); } },
      async stop() {
        if (!active) return {};
        const result = new Promise((resolve, reject) => {
          resolvePath = resolve;
          timer = setTimeout(() => reject(new Error('VLC did not report the completed recording path.')), 20_000);
        });
        if (!playerApi?.stopNativeRecording?.()) throw new Error('VLC could not stop the recording.');
        const complete = await result;
        active = false;
        clearTimeout(timer);
        const uri = complete.startsWith('file://') ? complete : `file://${complete}`;
        const file = new File(uri);
        if (!file.exists || !(file.size > 0)) throw new Error('VLC returned an empty or missing recording file.');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { dialogTitle: 'Save CineCrew recording', mimeType: 'video/mp2t', UTI: 'public.mpeg-2-transport-stream' });
        }
        publish('idle', 0);
        setStatus(`Recording ready · ${Math.round(file.size / 1024)} KB`);
        return { filename: uri.split('/').pop(), uri, size: file.size };
      },
      onNativeRecordingCreated(path) {
        if (!resolvePath) return;
        clearTimeout(timer);
        resolvePath(path || recordingPath);
        resolvePath = undefined;
      },
    };
  }
  return adapterRef.current;
}
