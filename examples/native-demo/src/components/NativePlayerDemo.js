import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import CineCrewPlayer from '@cinecrew/cinecrew-player';
import { MEDIA_SAMPLES, getSourceType } from '../samples';
import { createVlcRecordingAdapter } from '../recording/createVlcRecordingAdapter';
import { SamplePicker } from './SamplePicker';
import { PlayerStage } from './PlayerStage';

const THEME = {
  accentColor: '#16c7d9', backgroundColor: '#07111e', controlBackground: '#14253a',
  controlColor: '#f8fbff', surfaceColor: '#102033', borderRadius: 16,
};

function ActionButton({ title, onPress, primary = false, disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionButton, primary && styles.primaryButton, disabled && styles.disabledButton]}
    >
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

function useServiceIntegrations({ recorder, onStatus }) {
  return useMemo(() => ({
    liveChat: {
      pollIntervalMs: 15_000,
      loadMessages: async () => [
        { id: 'demo-1', username: 'CineCrew', textContent: 'Welcome to the native VLC demo!', createdAt: Date.now() },
        { id: 'demo-2', username: 'Viewer', textContent: 'Try the player controls on any sample.', createdAt: Date.now() - 30_000 },
      ],
      sendMessage: async ({ comment }) => onStatus(`Sent: ${comment}`),
    },
    epg: {
      loadListings: async ({ limit }) => {
        const now = Date.now();
        return [
          { title: 'Current programme', description: 'Playing in the sample guide.', startMs: now - 900_000, endMs: now + 900_000 },
          { title: 'Coming up next', description: 'Next in the guide.', startMs: now + 900_000, endMs: now + 2_700_000 },
        ].slice(0, Number(limit) || 2);
      },
    },
    recording: recorder,
  }), [onStatus, recorder]);
}

export function NativePlayerDemo() {
  const [active, setActive] = useState(MEDIA_SAMPLES[2]);
  const [draftUrl, setDraftUrl] = useState(MEDIA_SAMPLES[2].url);
  const [inline, setInline] = useState(false);
  const [live, setLive] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [status, setStatus] = useState('Ready · VLC native player');
  const playerRef = useRef(null);
  const recorderRef = useRef(null);

  if (!recorderRef.current) {
    recorderRef.current = createVlcRecordingAdapter((recordingState) => {
      if (recordingState.status === 'recording' || recordingState.status === 'paused') {
        setStatus(`Recording ${recordingState.status}…`);
      } else if (recordingState.status === 'saved') {
        setStatus(`Recording saved · ${recordingState.filename} (${recordingState.size} bytes)`);
      } else if (recordingState.status === 'error') {
        setStatus(`Recording error · ${recordingState.message}`);
      }
    });
  }
  const integrations = useServiceIntegrations({ recorder: recorderRef.current, onStatus: setStatus });

  const selectSample = useCallback((sample) => {
    setActive(sample);
    setDraftUrl(sample.url);
    setStatus(`Selected ${sample.label}`);
  }, []);

  const loadUrl = useCallback(() => {
    const uri = draftUrl.trim();
    if (!uri) return;
    setActive({ id: `url-${Date.now()}`, label: 'Custom URL', title: uri, url: uri, type: getSourceType(uri) });
    setStatus('Custom source selected');
  }, [draftUrl]);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file?.uri) return;
      setActive({ id: `file-${Date.now()}`, label: 'Local file', title: file.name || 'Local video', url: file.uri, type: getSourceType(file.name) });
      setDraftUrl(file.uri);
      setStatus(`Selected local file: ${file.name || 'video'}`);
    } catch (error) {
      Alert.alert('File picker error', error?.message || 'Could not open the video file.');
    }
  }, []);

  const source = useMemo(() => ({
    uri: active.url,
    title: active.title,
    type: active.type,
    mediaType: live ? 'live' : 'movie',
    isLive: live,
  }), [active, live]);

  const playerProps = useMemo(() => ({
    theme: THEME,
    controls: {
      back: true, playPause: true, seek: true, restart: true, lock: true,
      mute: true, aspectRatio: true, audioOnly: true, audioTracks: true,
      playbackRate: true, fullscreen: true, recording: true,
      liveChat: true, epg: true, diagnostics: true,
    },
    features: { diagnostics: true },
    integrations,
    actions: { onBack: () => setPlayerVisible(false) },
    onError: (error) => setStatus(error?.message || 'Playback error'),
    onPlaying: () => setStatus('Playing · native media engine'),
    onBuffering: (buffering) => { if (buffering) setStatus('Buffering…'); },
    ref: playerRef,
  }), [integrations]);

  const inlineSource = { ...source, isLive: true, mediaType: 'live' };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#07111e" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>NATIVE PLAYGROUND · ANDROID + IOS</Text>
        <Text style={styles.title}>CineCrew Player</Text>
        <Text style={styles.description}>One player UI, powered by the bundled VLC native engine for network streams and local media.</Text>

        <View style={styles.engineCard}>
          <Text style={styles.engineTitle}>VLC development build</Text>
          <Text style={styles.engineBody}>This project must run in its custom development build. Expo Go/Snack cannot load the VLC native module and is only suitable for UI and fallback checks.</Text>
        </View>

        <SamplePicker samples={MEDIA_SAMPLES} selectedId={active.id} onSelect={selectSample} />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Direct URL</Text>
          <TextInput
            accessibilityLabel="Media URL"
            value={draftUrl}
            onChangeText={setDraftUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="Paste a direct media URL"
            placeholderTextColor="#8396ad"
            style={styles.input}
          />
          <View style={styles.actionsRow}>
            <ActionButton title="Load URL" onPress={loadUrl} primary />
            <ActionButton title="Choose video file" onPress={pickFile} />
          </View>
        </View>

        <View style={styles.options}>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Compact inline preview</Text>
            <Switch value={inline} onValueChange={setInline} trackColor={{ true: '#087f91' }} thumbColor={inline ? '#16c7d9' : '#edf6ff'} />
          </View>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Live TV mode · chat + EPG</Text>
            <Switch value={live} onValueChange={setLive} trackColor={{ true: '#087f91' }} thumbColor={live ? '#16c7d9' : '#edf6ff'} />
          </View>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>PLAYER STATUS</Text>
          <Text style={styles.statusText}>{status}</Text>
          <Text style={styles.urlText} numberOfLines={2}>{active.url}</Text>
        </View>

        {inline ? (
          <View style={styles.stage}>
            <PlayerStage inline source={inlineSource} playerProps={playerProps} onError={playerProps.onError} onPlaying={playerProps.onPlaying} />
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Selected: {active.title}</Text>
            <ActionButton title="Play selected source" onPress={() => setPlayerVisible(true)} primary />
          </View>
        )}

        <Text style={styles.footnote}>The VLC build handles media formats directly; it does not invoke the web HLS, MPEG-TS, FLV, or OGV hooks. Recordings are written by VLC, then opened in the system share sheet so they can be saved to Files or Downloads.</Text>
      </ScrollView>

      {!inline && playerVisible ? (
        <CineCrewPlayer
          key={active.id}
          {...playerProps}
          source={source}
          title={active.title}
          mediaId={active.id}
          mediaType={live ? 'live' : 'movie'}
          isLive={live}
          autoPlay
          onClose={() => setPlayerVisible(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#07111e' },
  content: { width: '100%', maxWidth: 940, alignSelf: 'center', padding: 18, paddingBottom: 44, gap: 18 },
  eyebrow: { color: '#16c7d9', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: '#f4f7fb', fontSize: 34, fontWeight: '900' },
  description: { color: '#a9bbcf', fontSize: 14, lineHeight: 20 },
  engineCard: { borderWidth: 1, borderColor: '#725f18', backgroundColor: '#282711', borderRadius: 14, padding: 14, gap: 5 },
  engineTitle: { color: '#ffe274', fontSize: 14, fontWeight: '900' },
  engineBody: { color: '#e3dcae', fontSize: 13, lineHeight: 19 },
  panel: { backgroundColor: '#0d1a2a', borderColor: '#203650', borderWidth: 1, padding: 15, borderRadius: 16, gap: 12 },
  panelTitle: { color: '#f4f7fb', fontSize: 16, fontWeight: '800' },
  input: { color: '#f3f7fc', backgroundColor: '#07111e', borderColor: '#29415d', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  actionButton: { alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 22, borderWidth: 1, borderColor: '#29415d', backgroundColor: '#12243a' },
  primaryButton: { borderColor: '#16c7d9', backgroundColor: '#087f91' },
  disabledButton: { opacity: 0.5 },
  actionText: { color: '#f8fbff', fontSize: 14, fontWeight: '800' },
  options: { backgroundColor: '#0d1a2a', borderColor: '#203650', borderWidth: 1, borderRadius: 16, paddingHorizontal: 15 },
  optionRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomColor: '#203650', borderBottomWidth: StyleSheet.hairlineWidth },
  optionLabel: { color: '#edf6ff', fontSize: 14, fontWeight: '700' },
  statusCard: { backgroundColor: '#0d1a2a', borderWidth: 1, borderColor: '#203650', borderRadius: 14, padding: 14, gap: 6 },
  statusLabel: { color: '#16c7d9', fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  statusText: { color: '#f4f7fb', fontSize: 14, fontWeight: '700' },
  urlText: { color: '#a9bbcf', fontSize: 11, lineHeight: 16 },
  stage: { overflow: 'hidden', borderRadius: 16 },
  footnote: { color: '#91a4bb', fontSize: 12, lineHeight: 18 },
});
