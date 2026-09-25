import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player/native';

const SAMPLES = [
  {
    id: 'youtube',
    label: 'YouTube',
    title: 'Big Buck Bunny · YouTube',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    id: 'ts',
    label: '.ts stream',
    title: 'Sample MPEG-TS video',
    url: 'https://filesamples.com/samples/video/ts/sample_640x360.ts',
    type: 'mpegts',
  },
  {
    id: 'mp4',
    label: '.mp4 stream',
    title: 'Big Buck Bunny · MP4',
    url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
  },
  {
    id: 'mkv',
    label: '.mkv stream',
    title: 'Big Buck Bunny · MKV',
    url: 'https://test-videos.co.uk/vids/bigbuckbunny/mkv/360/Big_Buck_Bunny_360_10s_1MB.mkv',
  },
];

const ALL_CONTROLS = {
  back: true,
  playPause: true,
  seek: true,
  restart: true,
  lock: true,
  mute: true,
  aspectRatio: true,
  videoOnly: true,
  audioOnly: true,
  audioTracks: true,
  playbackRate: true,
  fullscreen: true,
  recording: true,
  liveChat: true,
  epg: true,
};

const THEME = {
  accentColor: '#16c7d9',
  backgroundColor: '#07111e',
  controlBackground: '#14253a',
  controlColor: '#f8fbff',
  surfaceColor: '#102033',
  borderRadius: 16,
};

function Choice({ label, active, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
    >
      <Text style={styles.choiceText}>{label}</Text>
    </Pressable>
  );
}

function getFileType(name) {
  const extension = String(name || '').split('.').pop()?.toLowerCase();
  if (extension === 'ts') return 'mpegts';
  if (extension === 'mkv') return 'matroska';
  if (extension === 'mp4') return 'mp4';
  return null;
}

export default function App() {
  const [active, setActive] = useState(SAMPLES[0]);
  const [draftUrl, setDraftUrl] = useState(SAMPLES[0].url);
  const [inline, setInline] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [status, setStatus] = useState('Ready');

  const integrations = useMemo(() => ({
    liveChat: {
      pollIntervalMs: 10000,
      loadMessages: async () => ([
        { id: 'demo-1', username: 'CineCrew', textContent: 'Welcome to the live chat demo!', createdAt: Date.now() },
        { id: 'demo-2', username: 'Viewer', textContent: 'Try the controls while this plays.', createdAt: Date.now() - 30000 },
      ]),
      sendMessage: async ({ comment }) => setStatus(`Demo chat sent: ${comment}`),
    },
    epg: {
      loadListings: async ({ limit }) => {
        const now = Date.now();
        const maxListings = Number(limit) || 3;
        return [
          {
            title: 'Current programme',
            description: 'Now playing in the EPG demo.',
            startMs: now - 15 * 60_000,
            endMs: now + 15 * 60_000,
          },
          {
            title: 'Coming up next',
            description: 'A sample upcoming listing.',
            startMs: now + 15 * 60_000,
            endMs: now + 45 * 60_000,
          },
          {
            title: 'Later today',
            description: 'Another sample EPG item.',
            startMs: now + 45 * 60_000,
            endMs: now + 75 * 60_000,
          },
        ].slice(0, maxListings);
      },
    },
    recording: {
      start: async () => setStatus('Demo recording adapter — connect your recorder/storage.'),
      stop: async () => setStatus('Recording stopped.'),
    },
  }), [setStatus]);

  const selectSample = (sample) => {
    setActive(sample);
    setDraftUrl(sample.url);
    setStatus(`Selected ${sample.label}.`);
  };

  const loadUrl = () => {
    const url = draftUrl.trim();
    if (!url) return;
    const type = /\.ts(?:$|[?#])/i.test(url) ? 'mpegts' : undefined;
    setActive({ id: 'custom', title: url, url, type });
    setStatus('Loading URL…');
  };

  const chooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || result.type === 'cancel') return;

      const file = result.assets?.[0] || result;
      const type = getFileType(file.name);
      if (!type) {
        Alert.alert('Unsupported file', 'Choose a .ts, .mp4, or .mkv video file.');
        return;
      }

      setActive({
        id: `file-${Date.now()}`,
        title: file.name,
        url: file.uri,
        type: type === 'mp4' ? undefined : type,
      });
      setDraftUrl(file.uri);
      setStatus(`Loaded local file: ${file.name}`);
    } catch (error) {
      setStatus(error?.message || 'Could not open the file picker.');
    }
  };

  const source = {
    uri: active.url,
    title: active.title,
    type: active.type,
    mediaType: isLive ? 'live' : 'movie',
    isLive,
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>NATIVE PLAYGROUND · EXPO SNACK</Text>
      <Text style={styles.title}>CineCrew Player</Text>
      <Text style={styles.bodyText}>The same five source tests as the React demo.</Text>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Snack runtime note</Text>
        <Text style={styles.mutedText}>
          Snack runs in Expo Go, which does not include this package’s custom VLC native module.
          YouTube and compatible MP4 sources can use the Expo fallback; MPEG-TS and MKV need the
          package in a native development build to test the bundled VLC engine.
        </Text>
      </View>

      <View style={styles.choices}>
        {SAMPLES.map((sample) => (
          <Choice
            key={sample.id}
            label={sample.label}
            active={active.id === sample.id}
            onPress={() => selectSample(sample)}
          />
        ))}
        <Choice label="Upload .ts / .mp4 / .mkv" onPress={chooseFile} />
      </View>

      <TextInput
        accessibilityLabel="Media URL"
        value={draftUrl}
        onChangeText={setDraftUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="Enter a YouTube or media URL"
        placeholderTextColor="#8396ad"
        style={styles.input}
      />
      <Choice label="Load URL" onPress={loadUrl} />

      <Choice
        label={inline ? 'Switch to full player' : 'Switch to inline player'}
        active={inline}
        onPress={() => setInline((value) => !value)}
      />
      <View style={styles.liveToggle}>
        <Text style={styles.bodyText}>Enable Live TV chat and EPG</Text>
        <Switch value={isLive} onValueChange={setIsLive} trackColor={{ true: '#087f91' }} thumbColor={isLive ? '#16c7d9' : '#edf6ff'} />
      </View>
      <Text style={styles.mutedText}>{status}</Text>

      <View style={styles.player}>
        {inline ? (
          <InlineLivePlayer
            key={active.id}
            source={source}
            title={active.title}
            height={300}
            isActive
            paused={false}
            controls={{ playPause: true, mute: true, fullscreen: true }}
            theme={THEME}
            onError={(error) => setStatus(error?.message || 'Playback error')}
            onPlaying={() => setStatus('Playing')}
          />
        ) : (
          <CineCrewPlayer
            key={active.id}
            source={source}
            title={active.title}
            mediaId={active.id}
            isLive={isLive}
            autoPlay
            controls={ALL_CONTROLS}
            integrations={integrations}
            actions={{
              onBack: () => setStatus('Back action — connect your app navigation.'),
            }}
            features={{ diagnostics: true }}
            theme={THEME}
            onBuffering={(buffering) => setStatus(buffering ? 'Buffering…' : 'Ready')}
            onPlaying={() => setStatus('Playing')}
            onError={(error) => setStatus(error?.message || 'Playback error')}
          />
        )}
      </View>
      <Text style={styles.mutedText}>
        Chat, EPG, and recording controls are enabled with demo adapters. URLs must be directly
        playable by the native engine; sharing a page URL does not make it a media stream.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07111e' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 20, gap: 12 },
  eyebrow: { color: '#16c7d9', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#f3f7fc', fontSize: 32, fontWeight: '800' },
  bodyText: { color: '#f3f7fc', fontSize: 15 },
  mutedText: { color: '#a9bbcf', fontSize: 13, lineHeight: 19 },
  notice: { gap: 6, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#725f18', backgroundColor: '#282711' },
  noticeTitle: { color: '#ffe274', fontWeight: '800' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#29415d', backgroundColor: '#12243a' },
  choiceActive: { borderColor: '#16c7d9', backgroundColor: '#087f91' },
  choiceText: { color: '#edf6ff', fontSize: 14, fontWeight: '600' },
  input: { color: '#f3f7fc', backgroundColor: '#0d1a2a', borderColor: '#29415d', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  liveToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  player: { width: '100%', minHeight: 260, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#203650', borderRadius: 18, backgroundColor: '#0d1a2a', padding: 10 },
});
