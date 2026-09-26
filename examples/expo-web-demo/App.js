import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player/react-native-web';
import '@cinecrew/cinecrew-player/styles.css';
import { allControls, asPlayerSource, sampleSources } from '../web-demo/src/samples.js';

function DemoPanel({ title, source, onClose }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Pressable onPress={onClose}><Text style={styles.accent}>Close ×</Text></Pressable>
      </View>
      <Text style={styles.bodyText}>{source.title || source.uri}</Text>
      <Text style={styles.mutedText}>Demo adapter only — connect your own service.</Text>
    </View>
  );
}

function ActionButton({ children, onPress, active = false }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, active && styles.activeButton]}>
      <Text style={styles.buttonText}>{children}</Text>
    </Pressable>
  );
}

export default function App() {
  const [active, setActive] = useState(sampleSources[0]);
  const [draftUrl, setDraftUrl] = useState(active.url);
  const [inline, setInline] = useState(false);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState('Ready');
  const fileInput = useRef(null);

  useEffect(() => () => {
    if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
  }, [active]);

  const integrations = useMemo(() => ({
    liveChat: { render: (props) => <DemoPanel {...props} title="Live chat" /> },
    epg: { render: (props) => <DemoPanel {...props} title="Programme guide" /> },
    recording: {
      start: async () => setStatus('Demo recording adapter: connect your recorder/storage.'),
      stop: async () => setStatus('Recording stopped.'),
    },
  }), []);

  const selectSample = (sample) => {
    setActive(sample);
    setDraftUrl(sample.url);
    setLive(Boolean(sample.isLive));
    setStatus('Loading selected sample…');
  };

  const loadUrl = () => {
    const url = draftUrl.trim();
    if (!url) return;
    setActive({ id: 'custom', title: url, url });
    setLive(false);
    setStatus('Loading URL…');
  };

  const loadFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setActive({ id: 'file', title: file.name, url: objectUrl, objectUrl });
    setLive(false);
    setDraftUrl(objectUrl);
    setStatus(`Loaded local file: ${file.name}`);
  };

  const source = { ...asPlayerSource(active), isLive: live, mediaType: live ? 'live' : 'movie' };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PLAYGROUND · EXPO WEB</Text>
      <Text style={styles.title}>CineCrew Player</Text>
      <Text style={styles.mutedText}>React Native UI · browser player renderer</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.samples}>
        {sampleSources.map((sample) => (
          <ActionButton key={sample.id} active={active.id === sample.id} onPress={() => selectSample(sample)}>
            {sample.label}
          </ActionButton>
        ))}
      </ScrollView>

      <View style={styles.urlRow}>
        <TextInput
          accessibilityLabel="Media URL"
          value={draftUrl}
          onChangeText={setDraftUrl}
          autoCapitalize="none"
          keyboardType="url"
          style={styles.input}
        />
        <ActionButton onPress={loadUrl}>Load URL</ActionButton>
        <ActionButton onPress={() => fileInput.current?.click()}>Choose file</ActionButton>
        {React.createElement('input', {
          ref: fileInput,
          type: 'file',
          accept: '.ts,.mp4,.mkv,video/mp4,video/x-matroska,video/mp2t',
          onChange: loadFile,
          style: { display: 'none' },
        })}
      </View>

      <Pressable onPress={() => setInline((value) => !value)} style={styles.toggle}>
        <View style={[styles.checkbox, inline && styles.checkboxActive]} />
        <Text style={styles.bodyText}>Use compact inline player</Text>
      </Pressable>
      <Pressable onPress={() => setLive((value) => !value)} style={styles.toggle}>
        <View style={[styles.checkbox, live && styles.checkboxActive]} />
        <Text style={styles.bodyText}>Treat source as live</Text>
      </Pressable>
      <Text style={styles.mutedText}>{status} · Browser format and CORS support depend on the source host.</Text>

      <View style={styles.player}>
        {inline ? (
          <InlineLivePlayer
            key={active.url}
            source={source}
            title={active.title}
            height={320}
            isActive
            paused={false}
            controls={{ playPause: true, mute: true, fullscreen: true }}
            onError={(error) => setStatus(error?.message || 'Playback error')}
            onPlaying={() => setStatus('Playing')}
          />
        ) : (
          <CineCrewPlayer
            key={active.url}
            source={source}
            title={active.title}
            mediaId={active.id}
            autoPlay
            controls={allControls}
            integrations={integrations}
            actions={{
              onBack: () => setStatus('Back action — connect your app navigation.'),
            }}
            features={{ diagnostics: true }}
            onBuffering={(buffering) => setStatus(buffering ? 'Buffering…' : 'Ready')}
            onPlaying={() => setStatus('Playing')}
            onError={(error) => setStatus(error?.message || 'Playback error')}
          />
        )}
      </View>
      <Text style={styles.mutedText}>Full player enables every control and demo integration. Inline mode has compact play, mute, and fullscreen controls.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07111e' },
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 20, gap: 12 },
  eyebrow: { color: '#16c7d9', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#f3f7fc', fontSize: 34, fontWeight: '800' },
  bodyText: { color: '#f3f7fc', fontSize: 15 },
  mutedText: { color: '#a9bbcf', fontSize: 13 },
  accent: { color: '#16c7d9' },
  samples: { gap: 8, paddingVertical: 6 },
  urlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { flexGrow: 1, flexBasis: 240, minWidth: 180, color: '#f3f7fc', backgroundColor: '#0d1a2a', borderColor: '#29415d', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  button: { borderWidth: 1, borderColor: '#29415d', borderRadius: 22, backgroundColor: '#12243a', paddingHorizontal: 14, paddingVertical: 10 },
  activeButton: { backgroundColor: '#087f91', borderColor: '#16c7d9' },
  buttonText: { color: '#edf6ff', fontSize: 14, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderColor: '#68809b', borderWidth: 1 },
  checkboxActive: { backgroundColor: '#16c7d9', borderColor: '#16c7d9' },
  player: { width: '100%', minHeight: 240, marginTop: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#203650', borderRadius: 18, backgroundColor: '#0d1a2a', padding: 10 },
  panel: { padding: 14, gap: 8 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { color: '#f3f7fc', fontSize: 16, fontWeight: '700' },
});
