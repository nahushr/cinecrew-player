import React, { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SAMPLES } from './src/constants';
import ActionButton from './src/components/ActionButton';
import OptionRow from './src/components/OptionRow';
import SampleSection from './src/components/SampleSection';
import SourceSection from './src/components/SourceSection';
import SnackPlayer from './src/components/SnackPlayer';
import { createStyles } from './src/styles';
import { useRecordingAdapter } from './src/hooks/useRecordingAdapter';

const styles = createStyles();

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
    epg: {
      loadListings: async () => [
        { title: 'Now playing', description: 'Sample programme guide', startMs: Date.now() - 600_000, endMs: Date.now() + 600_000 },
        { title: 'Up next', description: 'Upcoming programme', startMs: Date.now() + 600_000, endMs: Date.now() + 1_800_000 },
      ],
    },
  }), [recording]);

  const source = {
    id: sample.id,
    uri: sample.url,
    title: sample.title,
    type: sample.type,
    mediaType: live ? 'live' : 'movie',
    isLive: live,
  };

  const selectSample = (next) => {
    setSample(next);
    setUrl(next.url);
    setStatus(`${next.label} selected`);
  };

  const loadUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setSample({
      id: `custom-${Date.now()}`,
      label: 'Custom',
      title: trimmed,
      url: trimmed,
      type: /\.ts(?:$|[?#])/i.test(trimmed) ? 'mpegts' : undefined,
    });
    setStatus('Direct URL selected');
  };

  const chooseFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file?.uri) return;
      const extension = file.name?.split('.').pop()?.toLowerCase();
      const nativeType = {
        ts: 'mpegts', m3u8: 'm3u8', mkv: 'matroska', flv: 'flv', ogv: 'ogg',
        webm: 'webm', mov: 'mov', m4v: 'mp4', mp4: 'mp4', '3gp': '3gpp',
      }[extension];
      setSample({ id: `local-${Date.now()}`, label: 'Local file', title: file.name || 'Local video', url: file.uri, type: nativeType });
      setUrl(file.uri);
      setStatus(`Local file selected: ${file.name || 'video'}`);
    } catch (error) {
      Alert.alert('File selection failed', error?.message || 'Unable to select the local video.');
    }
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
            <View style={styles.playerCard}>
              <SnackPlayer
                inline
                source={{ ...source, isLive: true }}
                onError={(error) => setStatus(error?.message || 'Playback error')}
                onPlaying={() => setStatus('Playing')}
              />
            </View>
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
