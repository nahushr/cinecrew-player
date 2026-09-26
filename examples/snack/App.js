import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player';

const RAW = 'https://raw.githubusercontent.com/nahushr/cinecrew-player/main/examples/web-demo/public';
const SAMPLES = [
  { id: 'hls', label: 'HLS', title: 'Caminandes · HLS', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'm3u8' },
  { id: 'ts', label: 'MPEG-TS', title: 'Big Buck Bunny · MPEG-TS', url: `${RAW}/big-buck-bunny.ts`, type: 'mpegts' },
  { id: 'mp4', label: 'MP4', title: 'Big Buck Bunny · MP4', url: `${RAW}/big-buck-bunny.mp4`, type: 'mp4' },
  { id: 'mkv', label: 'MKV', title: 'Big Buck Bunny · MKV', url: `${RAW}/big-buck-bunny.mkv`, type: 'matroska' },
  { id: 'mov', label: 'MOV', title: 'Big Buck Bunny · MOV', url: `${RAW}/big-buck-bunny.mov`, type: 'mov' },
  { id: 'm4v', label: 'M4V', title: 'Big Buck Bunny · M4V', url: `${RAW}/big-buck-bunny.m4v`, type: 'mp4' },
  { id: '3gp', label: '3GP', title: 'Big Buck Bunny · 3GP', url: `${RAW}/big-buck-bunny.3gp`, type: '3gpp' },
  { id: 'flv', label: 'FLV', title: 'Ocean · FLV', url: `${RAW}/sample_960x400_ocean_with_audio.flv`, type: 'flv' },
  { id: 'ogv', label: 'OGV', title: 'Echo · OGV', url: `${RAW}/echo-hereweare.ogv`, type: 'ogg' },
  { id: 'webm', label: 'WebM', title: 'Ocean · WebM', url: `${RAW}/sample_960x400_ocean_with_audio.webm`, type: 'webm' },
];
const THEME = {
  accentColor: '#16c7d9', backgroundColor: '#07111e', controlBackground: '#14253a',
  controlColor: '#f8fbff', surfaceColor: '#102033', borderRadius: 16,
};
const ALL_CONTROLS = {
  back: true, playPause: true, seek: true, restart: true, lock: true, mute: true,
  aspectRatio: true, audioOnly: true, audioTracks: true, playbackRate: true,
  fullscreen: true, recording: true, liveChat: true, epg: true, diagnostics: true,
};

const nativePath = (uri) => decodeURIComponent(String(uri).replace(/^file:\/\//, ''));
const isAndroid = () => Platform.OS === 'android';

function ChoiceChip({ label, selected, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SampleSection({ selected, onSelect }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Video formats</Text>
      <View style={styles.chipList}>
        {SAMPLES.map((sample) => (
          <ChoiceChip key={sample.id} label={sample.label} selected={selected.id === sample.id} onPress={() => onSelect(sample)} />
        ))}
      </View>
    </View>
  );
}

function SourceSection({ url, onChangeUrl, onLoadUrl, onPickFile }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Stream URL</Text>
      <TextInput
        accessibilityLabel="Media URL"
        value={url}
        onChangeText={onChangeUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="Paste a direct media URL"
        placeholderTextColor="#8396ad"
        style={styles.input}
      />
      <View style={styles.buttonRow}>
        <ActionButton title="Load URL" onPress={onLoadUrl} primary />
        <ActionButton title="Choose local file" onPress={onPickFile} />
      </View>
    </View>
  );
}

function ActionButton({ title, onPress, primary = false }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, primary && styles.actionPrimary]}><Text style={styles.actionText}>{title}</Text></Pressable>;
}

function OptionRow({ label, value, onChange }) {
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionText}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#087f91' }} thumbColor={value ? '#16c7d9' : '#edf6ff'} />
    </View>
  );
}

function SnackPlayer({ inline, source, visible, playerRef, integrations, onBack, onError, onPlaying }) {
  if (inline) {
    return (
      <InlineLivePlayer
        key={source.uri}
        source={{ ...source, isLive: true, mediaType: 'live' }}
        title={source.title}
        height={300}
        isActive
        paused={false}
        controls={{ playPause: true, mute: true, fullscreen: true }}
        theme={THEME}
        onError={onError}
        onPlaying={onPlaying}
      />
    );
  }
  if (!visible) return null;
  return (
    <CineCrewPlayer
      key={source.uri}
      ref={playerRef}
      source={source}
      title={source.title}
      mediaId={source.id}
      isLive={source.isLive}
      autoPlay
      controls={ALL_CONTROLS}
      integrations={integrations}
      actions={{ onBack }}
      features={{ diagnostics: true }}
      theme={THEME}
      onError={onError}
      onPlaying={onPlaying}
    />
  );
}

function useRecordingAdapter(setStatus) {
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

export default function App() {
  const [sample, setSample] = useState(SAMPLES[2]);
  const [url, setUrl] = useState(SAMPLES[2].url);
  const [inline, setInline] = useState(false);
  const [live, setLive] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [status, setStatus] = useState('Ready');
  const playerRef = useRef(null);
  const recording = useRecordingAdapter(setStatus);
  const integrations = useMemo(() => ({
    recording,
    liveChat: {
      pollIntervalMs: 15_000,
      loadMessages: async () => [
        { id: 'm1', username: 'CineCrew', textContent: 'Welcome to the VLC demo!', createdAt: Date.now() },
        { id: 'm2', username: 'Viewer', textContent: 'Test the chat drawer and player actions.', createdAt: Date.now() - 25_000 },
      ],
      sendMessage: async ({ comment }) => setStatus(`Chat message sent: ${comment}`),
    },
    epg: { loadListings: async () => [{ title: 'Now playing', description: 'Sample programme guide', startMs: Date.now() - 600_000, endMs: Date.now() + 600_000 }, { title: 'Up next', description: 'Upcoming programme', startMs: Date.now() + 600_000, endMs: Date.now() + 1_800_000 }] },
  }), [recording]);

  const source = { id: sample.id, uri: sample.url, title: sample.title, type: sample.type, mediaType: live ? 'live' : 'movie', isLive: live };
  const selectSample = (next) => { setSample(next); setUrl(next.url); setStatus(`${next.label} selected`); };
  const loadUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setSample({ id: `custom-${Date.now()}`, label: 'Custom', title: trimmed, url: trimmed, type: /\.ts(?:$|[?#])/i.test(trimmed) ? 'mpegts' : undefined });
    setStatus('Direct URL selected');
  };
  const chooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file?.uri) return;
      const extension = file.name?.split('.').pop()?.toLowerCase();
      const nativeType = ({ ts: 'mpegts', m3u8: 'm3u8', mkv: 'matroska', flv: 'flv', ogv: 'ogg', webm: 'webm', mov: 'mov', m4v: 'mp4', mp4: 'mp4', '3gp': '3gpp' })[extension];
      setSample({ id: `local-${Date.now()}`, label: 'Local file', title: file.name || 'Local video', url: file.uri, type: nativeType });
      setUrl(file.uri);
      setStatus(`Local file selected: ${file.name || 'video'}`);
    } catch (error) { Alert.alert('File selection failed', error?.message || 'Unable to select the local video.'); }
  };

  return (
    <SafeAreaProvider>
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#07111e" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>NATIVE PLAYGROUND · EXPO SNACK</Text>
        <Text style={styles.title}>CineCrew Player</Text>
        <Text style={styles.subtitle}>Shared controls, powered by VLC in a custom native build.</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Important: Snack preview is Expo Go</Text>
          <Text style={styles.noticeBody}>Expo Go cannot include this package’s custom VLC module. Snack is for verifying the component UI and Expo fallback only; use the linked native development project to verify VLC, broad codec playback, and native recording.</Text>
        </View>

        <SampleSection selected={sample} onSelect={selectSample} />
        <SourceSection url={url} onChangeUrl={setUrl} onLoadUrl={loadUrl} onPickFile={chooseFile} />

        <View style={styles.card}>
          <OptionRow label="Compact inline player" value={inline} onChange={setInline} />
          <OptionRow label="Live TV · chat + EPG" value={live} onChange={setLive} />
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusHeading}>PLAYER STATUS</Text>
          <Text style={styles.statusText}>{status}</Text>
          <Text style={styles.url} numberOfLines={2}>{sample.url}</Text>
        </View>

        {inline ? (
          <View style={styles.playerCard}><SnackPlayer inline source={{ ...source, isLive: true }} onError={(error) => setStatus(error?.message || 'Playback error')} onPlaying={() => setStatus('Playing')} /></View>
        ) : (
          <View style={styles.playerCard}>
            <Text style={styles.sectionTitle}>{sample.title}</Text>
            <ActionButton title="Play selected source" primary onPress={() => setPlayerVisible(true)} />
          </View>
        )}
        <Text style={styles.footnote}>Audio/video formats are passed directly to the native media engine; web HLS/TS/FLV/OGV hooks are not used by the native renderer. Recording uses VLC’s native recorder and the system share sheet in the development build.</Text>
      </ScrollView>

      {!inline ? (
        <SnackPlayer
          source={source}
          visible={playerVisible}
          playerRef={playerRef}
          integrations={integrations}
          onBack={() => setPlayerVisible(false)}
          onError={(error) => setStatus(error?.message || 'Playback error')}
          onPlaying={() => setStatus('Playing')}
        />
      ) : null}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111e' },
  content: { width: '100%', maxWidth: 940, alignSelf: 'center', padding: 18, paddingBottom: 42, gap: 16 },
  eyebrow: { color: '#16c7d9', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  title: { color: '#f4f7fb', fontSize: 32, fontWeight: '900' },
  subtitle: { color: '#a9bbcf', fontSize: 14 },
  notice: { gap: 6, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#725f18', backgroundColor: '#282711' },
  noticeTitle: { color: '#ffe274', fontSize: 14, fontWeight: '900' },
  noticeBody: { color: '#e3dcae', fontSize: 12, lineHeight: 18 },
  section: { gap: 10 },
  sectionTitle: { color: '#f4f7fb', fontSize: 16, fontWeight: '800' },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: '#29415d', backgroundColor: '#12243a' },
  chipSelected: { borderColor: '#16c7d9', backgroundColor: '#087f91' },
  chipText: { color: '#d3deeb', fontSize: 12, fontWeight: '800' },
  chipTextSelected: { color: '#fff' },
  card: { backgroundColor: '#0d1a2a', borderColor: '#203650', borderWidth: 1, padding: 14, borderRadius: 16, gap: 12 },
  input: { color: '#f3f7fc', backgroundColor: '#07111e', borderColor: '#29415d', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#29415d', backgroundColor: '#12243a' },
  actionPrimary: { borderColor: '#16c7d9', backgroundColor: '#087f91' },
  actionText: { color: '#f8fbff', fontSize: 13, fontWeight: '800' },
  optionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  optionText: { color: '#edf6ff', fontSize: 13, fontWeight: '700' },
  statusCard: { backgroundColor: '#0d1a2a', borderWidth: 1, borderColor: '#203650', borderRadius: 14, padding: 14, gap: 6 },
  statusHeading: { color: '#16c7d9', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  statusText: { color: '#f4f7fb', fontSize: 13, fontWeight: '700' },
  url: { color: '#a9bbcf', fontSize: 10, lineHeight: 15 },
  playerCard: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#203650', backgroundColor: '#0d1a2a', padding: 12, gap: 10 },
  footnote: { color: '#91a4bb', fontSize: 11, lineHeight: 17 },
});
