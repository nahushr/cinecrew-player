import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
  const [promotedFullscreen, setPromotedFullscreen] = useState(false);
  const [liveBadge, setLiveBadge] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [progressTime, setProgressTime] = useState('00:00:00');
  const [drawerMode, setDrawerMode] = useState('resize');
  const [showLiveChat, setShowLiveChat] = useState(false);
  const prevLandscapeRef = useRef(isLandscape);
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

  const [startTime, setStartTime] = useState(undefined);

  useEffect(() => {
    setProgressTime('00:00:00');
    setStartTime(undefined);
  }, [active.url]);

  useEffect(() => {
    if (prevLandscapeRef.current !== isLandscape) {
      prevLandscapeRef.current = isLandscape;
      // Keep drawers closed across orientation changes in the demo. Users can
      // still open chat explicitly from the player controls. Preserve the
      // selected drawer layout: rotation must not silently turn Overlay or
      // Modal into Resize.
      setShowLiveChat(false);
    }
  }, [isLandscape]);

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

  const isImmersive = promotedFullscreen;

  const handleInlineChange = useCallback((nextInline) => {
    setInline(nextInline);
    if (nextInline) setPromotedFullscreen(false);
    if (progressTime && progressTime !== '00:00:00') {
      setStartTime(progressTime);
    }
  }, [progressTime]);

  const handlePromotePreview = useCallback((payload = {}) => {
    setStartTime(payload.startTime ?? payload.currentTime ?? progressTime);
    setInline(false);
    setPromotedFullscreen(true);
  }, [progressTime]);

  const handleFullscreenChange = useCallback((isFullscreen, payload) => {
    const resumeAt = payload?.startTime ?? payload?.currentTime;
    // Fullscreen changes the parent from ScrollView to View, remounting the
    // embedded main player too. Supply its current timestamp before that
    // remount, just as we do when promoting the compact inline player.
    if (resumeAt !== undefined && resumeAt !== null) setStartTime(resumeAt);
    setPromotedFullscreen(isFullscreen);
  }, []);

  const integrations = useDemoIntegrations(notify);
  const actions = useDemoPlayerActions({
    notify,
    setSelectedAudioTrack,
    onFullscreenChange: handleFullscreenChange,
  });

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
  const playerCardWidth = Math.max(1, Math.min(width, 1060) - horizontalPadding * 2);
  const defaultPlayerCardHeight = Math.round(playerCardWidth * (9 / 16));
  const portraitResizeOpen = !isLandscape && !isImmersive && drawerMode === 'resize' && showLiveChat;
  const portraitResizeVideoHeight = inline
    ? 220
    : Math.min(Math.round(height * 0.42), Math.round(width * (9 / 16)));
  const portraitResizeDrawerHeight = Math.min(380, Math.max(280, Math.round(height * 0.42)));
  const playerCardHeight = portraitResizeOpen
    ? portraitResizeVideoHeight + portraitResizeDrawerHeight + 2
    : defaultPlayerCardHeight;
  const effectiveDrawerMode = drawerMode;
  const landscapePlayerStyle = {
    width: '100%',
    maxWidth: '100%',
    height: isImmersive ? height : '100%',
    aspectRatio: undefined,
    borderRadius: 0,
    alignSelf: 'stretch',
    flex: 1,
  };
  const pageContent = (
    <>
      {!isImmersive && (
        <View nativeID="cinecrew-electron-demo-header" style={styles.pageHeader}>
          <View>
            <Text style={styles.eyebrow}>PLAYGROUND</Text>
            <Text style={[styles.title, { fontSize: width < 600 ? 30 : 38 }]}>CineCrew Player</Text>
          </View>
          <View style={styles.platformTag}>
            <Text style={styles.platformTagText}>{isElectronDemo ? 'Electron · LibVLC' : Platform.OS === 'ios' ? 'iOS Demo' : 'Android Demo'}</Text>
          </View>
        </View>
      )}

      {!isImmersive && (
        <View nativeID="cinecrew-electron-demo-source-controls" style={{ position: 'relative', zIndex: 100, elevation: 100 }}>
          <SourceControls
            active={active}
            draftUrl={draftUrl}
            fileInputRef={fileInputRef}
            inline={inline}
            drawerMode={effectiveDrawerMode}
            onSelectSample={selectSample}
            onDraftUrlChange={setDraftUrl}
            onLoadUrl={loadUrl}
            onChooseFile={loadFile}
            onClearFile={clearFile}
            onInlineChange={handleInlineChange}
            liveBadge={liveBadge}
            onLiveBadgeChange={setLiveBadge}
            onDrawerModeChange={setDrawerMode}
            progressTime={progressTime}
            status={status}
            viewportWidth={width}
          />
        </View>
      )}

      <View
        style={[
          styles.playerCard,
          !isImmersive && { height: playerCardHeight },
          isImmersive && styles.landscapePlayerCard,
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
          showLiveChat={showLiveChat}
          onLiveChatChange={setShowLiveChat}
          playerStyle={isImmersive ? landscapePlayerStyle : undefined}
          inline={inline}
          promotedFullscreen={promotedFullscreen}
          onPromotePreview={handlePromotePreview}
          startTime={startTime}
          showBrightnessControl={true}
          onBrightnessChangeEnd={(percent) => notify('Brightness', `Brightness set to ${percent}%`)}
          showVolumeControl={true}
          onVolumeChangeEnd={(percent) => notify('Volume', `Sound volume set to ${percent}%`)}
          showLiveBadge={liveBadge}
          selectedAudioTrack={selectedAudioTrack}
          integrations={integrations}
          actions={actions}
          onProgressBarChange={setProgressTime}
          onStatus={setStatus}
          onPlaybackError={reportPlaybackError}
        />
      </View>

      {!isImmersive && (
        <Text nativeID="cinecrew-electron-demo-footnote" style={styles.footnote}>
          The chat drawer contains 15 sample messages and loads 5 per page; production defaults to 50.
          Overlay opens from the right, resize places video beside the drawer, and modal is centered on web or bottom-sheet on native. Audio-track selection is demonstrated
          with Test 1 and Test 2. Progress reports the exact HH:MM:SS position.
        </Text>
      )}
    </>
  );
  const pageContentStyle = [
    styles.content,
    isImmersive
      ? { width: '100%', maxWidth: '100%', paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, flex: 1 }
      : { paddingHorizontal: horizontalPadding, paddingTop: width < 600 ? 22 : 32 },
  ];

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.screen, isImmersive && { backgroundColor: '#000' }, isElectronOverlay && styles.electronOverlayScreen]}
        edges={isImmersive ? [] : ['top', 'right', 'bottom', 'left']}
      >
      {isImmersive ? (
        <View style={styles.immersiveStage}>
          {pageContent}
        </View>
      ) : Platform.OS === 'web' ? (
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
        <ScrollView
          ref={scrollViewRef}
          style={[styles.scroll, isImmersive && { height: '100%' }]}
          contentContainerStyle={[pageContentStyle, isImmersive && { flex: 1, height: '100%' }]}
          nestedScrollEnabled
          // Inline drawer lists switch to non-virtualized ScrollViews in this
          // nested context. Disable this pan responder so the drawer can own
          // drags while the page remains scrollable elsewhere.
          disableScrollViewPanResponder
          keyboardShouldPersistTaps="handled"
          // Keep both the page and the bounded drawer list scrollable. Android
          // nested scrolling lets the active list consume movement and hands
          // it back to the page when the list reaches either edge.
          scrollEnabled={!isImmersive}
          onContentSizeChange={revealLandscapePlayer}
        >
          {pageContent}
        </ScrollView>
      )}
      <ToastViewport toast={toast} onDismiss={() => setToast(null)} viewportWidth={width} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07111e' },
  immersiveStage: { flex: 1, width: '100%', height: '100%' },
  electronOverlayScreen: { backgroundColor: 'transparent' },
  scroll: { flex: 1, minHeight: 0, width: '100%' },
  content: { width: '100%', maxWidth: 1060, alignSelf: 'center', paddingTop: 32, paddingBottom: 56 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, gap: 12 },
  eyebrow: { color: '#16c7d9', fontSize: 11, fontWeight: '800', letterSpacing: 2.3 },
  title: { color: '#f3f7fc', fontWeight: '800', marginTop: 2 },
  platformTag: { borderWidth: 1, borderColor: '#29415d', borderRadius: 999, backgroundColor: '#12243a', paddingHorizontal: 15, paddingVertical: 9 },
  platformTagText: { color: '#edf6ff', fontSize: 14, fontWeight: '600' },
  playerCard: { minHeight: 0, borderWidth: 1, borderColor: '#203650', borderRadius: 18, backgroundColor: '#0d1a2a', padding: 0, marginBottom: 10, overflow: 'hidden' },
  electronOverlayPlayerCard: { backgroundColor: 'transparent' },
  landscapePlayerCard: { aspectRatio: undefined, minHeight: 0, padding: 0, marginBottom: 0, borderWidth: 0, borderRadius: 0, backgroundColor: '#000', width: '100%', maxWidth: '100%', height: '100%', flex: 1, alignSelf: 'stretch' },
  footnote: { color: '#a9bbcf', fontSize: 13, lineHeight: 20 },
});
