import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { asPlayerSource, sampleSources } from './src/samples.js';
import { PlayerViewport } from './src/components/PlayerViewport.js';
import { SourceControls } from './src/components/SourceControls.js';
import { ToastViewport } from './src/components/ToastViewport.js';
import { useDemoIntegrations } from './src/hooks/useDemoIntegrations.js';
import { useDemoPlayerActions } from './src/hooks/useDemoPlayerActions.js';
import { getPlayerErrorMessage } from './src/utils/playerErrorMessage.js';

export default function App() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isElectronDemo = Platform.OS === 'web' && Boolean(window.cinecrewRuntime?.isElectron);
  const isElectronOverlay = isElectronDemo && (
    window.cinecrewRuntime?.isElectronOverlay === true
    || new URLSearchParams(window.location.search).has('electronOverlay')
  );
  const [active, setActive] = useState(sampleSources[0]);
  const [draftUrl, setDraftUrl] = useState(sampleSources[0].url);
  const [inline, setInline] = useState(false);
  const [brightnessControl, setBrightnessControl] = useState(true);
  const [status, setStatus] = useState('Ready');
  const [progressTime, setProgressTime] = useState('00:00:00');
  const [drawerMode, setDrawerMode] = useState('resize');
  const [toast, setToast] = useState(null);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState('test-1');
  const toastTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollViewRef = useRef(null);
  const playerCardTopRef = useRef(0);
  const playerRef = useRef(null);

  const revealLandscapePlayer = useCallback(() => {
    if (!isLandscape) return;
    requestAnimationFrame(() => {
      const pageScroller = scrollViewRef.current;
      if (typeof pageScroller?.scrollToOffset === 'function') {
        pageScroller.scrollToOffset({ offset: playerCardTopRef.current, animated: false });
      } else {
        pageScroller?.scrollTo({ y: playerCardTopRef.current, animated: false });
      }
    });
  }, [isLandscape]);

  const handlePlayerCardLayout = useCallback((event) => {
    playerCardTopRef.current = event.nativeEvent.layout.y;
    if (!isLandscape) return;
    revealLandscapePlayer();
  }, [isLandscape, revealLandscapePlayer]);

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

  useEffect(() => {
    if (inline || !active.url || !isLandscape) {
      playerRef.current?.closePanel?.();
      return;
    }
    playerRef.current?.setPanel?.('chat');
  }, [active.url, inline, isLandscape]);

  useEffect(() => {
    if (!isLandscape) return undefined;

    // Align the player card to the safe viewport in landscape. Scrolling to
    // the end also scrolls the footnote into view and can clip the player at
    // the top of the screen.
    let secondFrame;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(revealLandscapePlayer);
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [revealLandscapePlayer, isLandscape]);

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
    if (isElectronDemo && typeof window.cinecrewVlc?.getFileUrl === 'function') {
      const url = window.cinecrewVlc.getFileUrl(file);
      setActive({ id: 'file', title: file.name, url });
      setStatus(`Loaded local file: ${file.name}`);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setActive({ id: 'file', title: file.name, url: objectUrl, objectUrl });
    setStatus(`Loaded local file: ${file.name}`);
  }, [isElectronDemo]);

  const clearFile = useCallback(() => {
    setActive({ id: 'cleared', title: '', url: '' });
    setStatus('Video file cleared. Choose a sample, enter a URL, or select another file.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const source = asPlayerSource(active);
  const horizontalPadding = width < 600 ? 12 : 20;
  const effectiveDrawerMode = isLandscape ? 'resize' : drawerMode;
  const landscapePlayerStyle = isLandscape
    ? {
        width: '100%',
        maxWidth: '100%',
        height: Math.max(1, height - 24),
        alignSelf: 'stretch',
      }
    : undefined;
  const pageContent = (
    <>
      <View nativeID="cinecrew-electron-demo-header" style={styles.pageHeader}>
        <View>
          <Text style={styles.eyebrow}>PLAYGROUND</Text>
          <Text style={[styles.title, { fontSize: width < 600 ? 30 : 38 }]}>CineCrew Player</Text>
        </View>
        <View style={styles.platformTag}>
          <Text style={styles.platformTagText}>{isElectronDemo ? 'Electron · LibVLC' : Platform.OS === 'ios' ? 'iOS Demo' : 'Android Demo'}</Text>
        </View>
      </View>

      <View nativeID="cinecrew-electron-demo-source-controls">
        <SourceControls
          active={active}
          draftUrl={draftUrl}
          fileInputRef={fileInputRef}
          inline={inline}
          brightnessControl={brightnessControl}
          drawerMode={effectiveDrawerMode}
          onSelectSample={selectSample}
          onDraftUrlChange={setDraftUrl}
          onLoadUrl={loadUrl}
          onChooseFile={loadFile}
          onClearFile={clearFile}
          onInlineChange={setInline}
          onBrightnessControlChange={setBrightnessControl}
          onDrawerModeChange={setDrawerMode}
          progressTime={progressTime}
          status={status}
          viewportWidth={width}
        />
      </View>

      <View
        style={[
          styles.playerCard,
          isLandscape && styles.landscapePlayerCard,
          isElectronOverlay && styles.electronOverlayPlayerCard,
        ]}
        nativeID="cinecrew-electron-demo-player-card"
        accessibilityLabel="Video player"
        onLayout={handlePlayerCardLayout}
      >
        <PlayerViewport
          ref={playerRef}
          active={active}
          source={source}
          drawerMode={effectiveDrawerMode}
          playerStyle={landscapePlayerStyle}
          inline={inline}
          showBrightnessControl={brightnessControl}
          onBrightnessChangeEnd={(percent) => notify('Brightness', `Brightness set to ${percent}%`)}
          selectedAudioTrack={selectedAudioTrack}
          integrations={integrations}
          actions={actions}
          onProgressBarChange={setProgressTime}
          onStatus={setStatus}
          onPlaybackError={reportPlaybackError}
        />
      </View>

      <Text nativeID="cinecrew-electron-demo-footnote" style={styles.footnote}>
        The chat drawer contains 15 sample messages and loads 5 per page; production defaults to 50.
        Overlay opens from the right, resize places video beside the drawer, and modal is centered on web or bottom-sheet on native. Audio-track selection is demonstrated
        with Test 1 and Test 2. Progress reports the exact HH:MM:SS position.
      </Text>
    </>
  );
  const pageContentStyle = [
    styles.content,
    isLandscape
      ? { maxWidth: width, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }
      : { paddingHorizontal: horizontalPadding, paddingTop: width < 600 ? 22 : 32 },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.screen, isElectronOverlay && styles.electronOverlayScreen]}
        edges={['top', 'right', 'bottom', 'left']}
      >
      {Platform.OS === 'web' ? (
        <ScrollView
          ref={scrollViewRef}
          nativeID={isElectronOverlay ? 'cinecrew-electron-demo-scroll' : undefined}
          style={styles.scroll}
          contentContainerStyle={pageContentStyle}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={revealLandscapePlayer}
        >
          {pageContent}
        </ScrollView>
      ) : (
        <FlatList
          ref={scrollViewRef}
          style={styles.scroll}
          contentContainerStyle={pageContentStyle}
          data={[]}
          ListHeaderComponent={pageContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={revealLandscapePlayer}
        />
      )}
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} viewportWidth={width} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07111e' },
  electronOverlayScreen: { backgroundColor: 'transparent' },
  scroll: { flex: 1, minHeight: 0 },
  content: { width: '100%', maxWidth: 1060, alignSelf: 'center', paddingTop: 32, paddingBottom: 56 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 12 },
  eyebrow: { color: '#16c7d9', fontSize: 11, fontWeight: '800', letterSpacing: 2.3 },
  title: { color: '#f3f7fc', fontWeight: '800', marginTop: 2 },
  platformTag: { borderWidth: 1, borderColor: '#29415d', borderRadius: 999, backgroundColor: '#12243a', paddingHorizontal: 15, paddingVertical: 9 },
  platformTagText: { color: '#edf6ff', fontSize: 14, fontWeight: '600' },
  playerCard: { minHeight: 250, borderWidth: 1, borderColor: '#203650', borderRadius: 18, backgroundColor: '#0d1a2a', padding: 12, marginBottom: 10, overflow: 'hidden' },
  electronOverlayPlayerCard: { backgroundColor: 'transparent' },
  landscapePlayerCard: { minHeight: 0, padding: 0, marginBottom: 0 },
  footnote: { color: '#a9bbcf', fontSize: 13, lineHeight: 20 },
});
