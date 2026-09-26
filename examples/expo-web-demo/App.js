import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import '@cinecrew/cinecrew-player/styles.css';
import { asPlayerSource, sampleSources } from '../web-demo/src/samples.js';
import { PlayerViewport } from './src/components/PlayerViewport';
import { SourceControls } from './src/components/SourceControls';
import { ToastViewport } from './src/components/ToastViewport';
import { useDemoIntegrations } from '../web-demo/src/hooks/useDemoIntegrations.js';
import { useDemoPlayerActions } from '../web-demo/src/hooks/useDemoPlayerActions.js';
import { getPlayerErrorMessage } from '../web-demo/src/utils/playerErrorMessage.js';

export default function App() {
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(sampleSources[0]);
  const [draftUrl, setDraftUrl] = useState(sampleSources[0].url);
  const [inline, setInline] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [progressTime, setProgressTime] = useState('00:00:00');
  const [drawerMode, setDrawerMode] = useState('overlay');
  const [toast, setToast] = useState(null);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState('test-1');
  const toastTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const notify = useCallback((title, message, variant = 'success') => {
    setToast({ title, message: String(message || ''), variant });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => () => {
    if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
  }, [active]);

  useEffect(() => {
    setProgressTime('00:00:00');
  }, [active.url]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const integrations = useDemoIntegrations(notify);
  const actions = useDemoPlayerActions({ notify, setSelectedAudioTrack });

  const reportPlaybackError = useCallback((error) => {
    notify(
      'Playback error',
      getPlayerErrorMessage(error) || 'The media engine did not provide an error message.',
      'error',
    );
  }, [notify]);

  const selectSample = useCallback((sample) => {
    setActive(sample);
    setDraftUrl(sample.url);
    setStatus('Loading selected sample…');
  }, []);

  const loadUrl = useCallback(() => {
    const url = draftUrl.trim();
    if (!url) return;
    setActive({ id: 'custom', title: url, url });
    setStatus('Loading URL…');
  }, [draftUrl]);

  const loadFile = useCallback((event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setActive({ id: 'file', title: file.name, url: objectUrl, objectUrl });
    setStatus(`Loaded local file: ${file.name}`);
  }, []);

  const clearFile = useCallback(() => {
    setActive({ id: 'cleared', title: '', url: '' });
    setStatus('Video file cleared. Choose a sample, enter a URL, or select another file.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const source = asPlayerSource(active);
  const horizontalPadding = width < 600 ? 12 : 20;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.eyebrow}>PLAYGROUND</Text>
            <Text style={[styles.title, { fontSize: width < 600 ? 30 : 38 }]}>CineCrew Player</Text>
          </View>
          <View style={styles.platformTag}><Text style={styles.platformTagText}>Expo · Web</Text></View>
        </View>

        <SourceControls
          active={active}
          draftUrl={draftUrl}
          fileInputRef={fileInputRef}
          inline={inline}
          drawerMode={drawerMode}
          onSelectSample={selectSample}
          onDraftUrlChange={setDraftUrl}
          onLoadUrl={loadUrl}
          onChooseFile={loadFile}
          onClearFile={clearFile}
          onInlineChange={setInline}
          onDrawerModeChange={setDrawerMode}
          progressTime={progressTime}
          status={status}
          viewportWidth={width}
        />

        <View style={styles.playerCard} accessibilityLabel="Video player">
          <PlayerViewport
            active={active}
            source={source}
            drawerMode={drawerMode}
            inline={inline}
            selectedAudioTrack={selectedAudioTrack}
            integrations={integrations}
            actions={actions}
            onProgressBarChange={setProgressTime}
            onStatus={setStatus}
            onPlaybackError={reportPlaybackError}
          />
        </View>

        <Text style={styles.footnote}>
          The chat drawer contains 15 sample messages and loads 5 per page; production defaults to 50.
          Choose overlay or resized-video drawer layout above. Audio-track selection is demonstrated
          with Test 1 and Test 2. Progress reports the exact HH:MM:SS position.
        </Text>
      </ScrollView>
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} viewportWidth={width} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07111e' },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 1100, alignSelf: 'center', paddingTop: 28, paddingBottom: 56, gap: 16 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 12 },
  eyebrow: { color: '#16c7d9', fontSize: 11, fontWeight: '800', letterSpacing: 2.3 },
  title: { color: '#f3f7fc', fontWeight: '800', marginTop: 2 },
  platformTag: { borderWidth: 1, borderColor: '#29415d', borderRadius: 999, backgroundColor: '#12243a', paddingHorizontal: 15, paddingVertical: 9 },
  platformTagText: { color: '#edf6ff', fontSize: 14, fontWeight: '600' },
  playerCard: { minHeight: 250, borderWidth: 1, borderColor: '#203650', borderRadius: 18, backgroundColor: '#0d1a2a', padding: 12 },
  footnote: { color: '#a9bbcf', fontSize: 13, lineHeight: 20, marginTop: -4 },
});
