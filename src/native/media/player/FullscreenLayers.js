import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { isElectron, isElectronOverlay, isWeb } from '../../../utils/runtimePlatform';
import { PlayerIcon } from '../../customization';
import { PlayerTopBar } from './PlayerTopBar';
import { CenterControls } from './CenterControls';
import { PlayerBottomBar } from './PlayerBottomBar';
import { VerticalBrightnessControl } from './VerticalBrightnessControl';
import { VerticalVolumeControl } from './VerticalVolumeControl';
import { AudioOnlyView } from './AudioOnlyView';
import { LiveChatDrawer } from '../LiveChatDrawer';
import { LiveRecordingOverlay, LiveRecordingNotice, RecordingSaveDialog } from '../LiveRecordingOverlay';
import { mediaPlayerStyles as styles } from './mediaPlayerStyles';

export function FullscreenVideoLayer({ videoPlayer, zoomScale, isAudioOnly, transparent = false }) {
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={[
        styles.videoWrapFullscreen,
        transparent && { backgroundColor: 'transparent' },
        zoomScale !== 1 && { transform: [{ scale: zoomScale }] },
        isAudioOnly && { opacity: 0 },
      ]}
    >
      {videoPlayer}
    </View>
  );
}

export function FullscreenGestureLayer({
  isAudioOnly,
  showControls,
  isLocked,
  isRecording,
  panResponder,
  handlers,
  managedByParent,
}) {
  if (isAudioOnly) return null;
  if (managedByParent) return null;
  if (!isWeb() && !isElectron() && panResponder) {
    // Keep the full-screen gesture responder out of the hit-test tree while
    // controls are visible. PanResponder can otherwise claim a touch before
    // nested TouchableOpacity controls receive it on Android.
    if (isRecording) return null;
    return (
      <View
        collapsable={false}
        style={[StyleSheet.absoluteFill, styles.gestureCatcher]}
        pointerEvents={showControls ? 'none' : 'auto'}
        {...panResponder.panHandlers}
      />
    );
  }
  return (
    <View
      collapsable={false}
      style={[StyleSheet.absoluteFill, styles.gestureCatcher]}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={handlers.onPointerUp}
      onMouseDown={handlers.onMouseDown}
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    />
  );
}

export function FullscreenControlsPanel(props) {
  const [controlBounds, setControlBounds] = useState({
    topBarY: 0,
    headerY: 0,
    headerHeight: 0,
    bottom: 0,
    bottomHeight: 0,
  });
  const frame = props.frameSize || { width: 0, height: 0 };
  const isPortrait = frame.width > 0 && frame.height > 0 && frame.height >= frame.width;
  // Android reports landscape phone widths in dp (often ~850–1000dp), so a
  // width threshold misses compact landscape layouts. Height is the limiting
  // dimension and keeps the top/bottom controls and their popovers in-frame.
  const compact = frame.height > 0 && frame.height < 520 && !isPortrait;
  const onTopBarLayout = useCallback((event) => {
    const { y = 0 } = event?.nativeEvent?.layout || {};
    setControlBounds((current) => Math.abs(current.topBarY - y) > 1 ? { ...current, topBarY: y } : current);
  }, []);
  const onHeaderLayout = useCallback((event) => {
    const { y = 0, height = 0 } = event?.nativeEvent?.layout || {};
    setControlBounds((current) => (Math.abs(current.headerY - y) > 1 || Math.abs(current.headerHeight - height) > 1)
      ? { ...current, headerY: y, headerHeight: height }
      : current);
  }, []);
  const onBottomBarLayout = useCallback((event) => {
    const { y = 0, height = 0 } = event?.nativeEvent?.layout || {};
    setControlBounds((current) => (Math.abs(current.bottom - y) > 1 || Math.abs(current.bottomHeight - height) > 1)
      ? { ...current, bottom: y, bottomHeight: height }
      : current);
  }, []);

  const headerBottom = controlBounds.headerHeight > 0
    ? controlBounds.topBarY + controlBounds.headerY + controlBounds.headerHeight
    : 0;

  const topInset = headerBottom > 0
    ? headerBottom
    : (compact ? 38 : isPortrait ? Math.max(props.insets?.top || 0, 24) + 44 : 44);

  const bottomInset = controlBounds.bottomHeight > 0
    ? (controlBounds.bottom > 0 && frame.height > 0
        ? Math.max(0, frame.height - controlBounds.bottom)
        : controlBounds.bottomHeight)
    : (compact ? 70 : isPortrait ? Math.max(props.insets?.bottom || 0, 16) + 104 : 76);

  return (
    <View
      style={styles.controlsPanel}
      pointerEvents="box-none"
    >
      <PlayerTopBar
        insets={props.insets}
        scale={props.scale}
        title={props.title}
        episodeLabel={props.episodeLabel}
        isLive={props.isLive}
        isFullscreen={props.isFullscreen}
        isScreenRecorderEnabled={props.isScreenRecorderEnabled}
        canRecord={props.canRecord}
        recStatus={props.recStatus}
        isLoading={props.isLoading}
        showLiveChat={props.showLiveChat}
        drawerTab={props.drawerTab}
        isLiveCommentsEnabled={props.isLiveCommentsEnabled}
        isEpgEnabled={props.isEpgEnabled}
        diagnosticsOverlayEnabled={props.diagnosticsOverlayEnabled}
        muted={props.muted}
        controls={props.controls}
        locked={props.isLocked}
        playerIsPortrait={isPortrait}
        compact={compact}
        isPlaying={props.isPlaying}
        paused={props.paused ?? !props.isPlaying}
        onClose={props.onClose}
        onStartRecording={(event) => props.handleRecordingAction('onRecordingStart', props.handleStartRecording, event)}
        onResumeRecording={(event) => props.handleRecordingAction('onRecordingResume', props.handleResumeRecording, event)}
        onPauseRecording={(event) => props.handleRecordingAction('onRecordingPause', props.handlePauseRecording, event)}
        onStopRecording={(event) => props.handleRecordingAction('onRecordingStop', props.handleStopRecording, event)}
        onToggleChatTab={props.handlePanelAction}
        onRestart={props.handleRestartAction}
        onToggleMute={props.handleMuteAction}
        onToggleLock={props.handleLockAction}
        onPlayerLayout={onTopBarLayout}
        onHeaderLayout={onHeaderLayout}
      />
      {!props.isLocked ? <CenterControls
        compact={compact}
        visible={!props.isAudioOnly && !props.isLoading && props.controls.playPause !== false}
        isLive={props.isLive}
        isPlaying={props.isPlaying}
        onSeekBy={props.handleSeekByAction}
        onTogglePlayPause={props.handlePlayPauseAction}
        scale={props.scale}
      /> : null}
      {!props.isLocked ? <PlayerBottomBar
        compact={compact}
        isLive={props.isLive}
        insets={props.insets}
        scale={props.scale}
        isSeeking={props.isSeeking}
        sliderPos={props.sliderPos}
        currentTime={props.currentTime}
        duration={props.duration}
        isAudioOnlyFeatureEnabled={props.isAudioOnlyFeatureEnabled}
        isAudioOnly={props.isAudioOnly}
        aspectRatios={props.aspectRatios}
        controls={props.controls}
        showAspectPicker={props.showAspectPicker}
        aspectRatio={props.aspectRatio}
        showSpeedPicker={props.showSpeedPicker}
        playbackRate={props.playbackRate}
        showAudioPicker={props.showAudioPicker}
        audioTracks={props.audioTracks}
        selectedAudioTrack={props.selectedAudioTrack}
        isFullscreen={props.isFullscreen}
        onSliderValueChange={props.onSliderValueChange}
        onSliderSlidingStart={props.onSliderSlidingStart}
        onSliderSlidingComplete={props.onSliderSlidingComplete}
        onToggleAudioOnly={props.onToggleAudioOnly}
        onToggleAspectPicker={props.onToggleAspectPicker}
        onSelectAspectRatio={props.onSelectAspectRatio}
        onToggleSpeedPicker={props.onToggleSpeedPicker}
        onSelectSpeed={props.handleSpeedSelect}
        onToggleAudioPicker={props.onToggleAudioPicker}
        onSelectAudioTrack={props.handleAudioTrackAction}
        onToggleFullscreen={props.handleFullscreenAction}
        onPlayerLayout={onBottomBarLayout}
      /> : null}
      {props.showBrightnessControl && !props.isLocked ? (
        <VerticalBrightnessControl
          compact={compact}
          value={props.brightness}
          onChange={props.onBrightnessChange}
          onChangeEnd={props.onBrightnessChangeEnd}
          accentColor={props.brightnessAccentColor}
          availableHeight={frame.height}
          fullscreenLandscape={props.isFullscreen && !isPortrait}
          topInset={topInset}
          bottomInset={bottomInset}
          leftInset={props.isFullscreen && isElectronOverlay() ? 8 : (props.isFullscreen || !isPortrait) ? Math.max(props.insets?.left || 0, props.insets?.right || 0, 20) : (compact ? 4 : 10)}
        />
      ) : null}
      {props.showVolumeControl && !props.isLocked ? (
        <VerticalVolumeControl
          compact={compact}
          value={props.volume}
          onChange={props.onVolumeChange}
          onChangeEnd={props.onVolumeChangeEnd}
          accentColor={props.volumeAccentColor || props.brightnessAccentColor}
          availableHeight={frame.height}
          fullscreenLandscape={props.isFullscreen && !isPortrait}
          topInset={topInset}
          bottomInset={bottomInset}
          rightInset={props.isFullscreen && isElectronOverlay() ? 8 : (props.isFullscreen || !isPortrait) ? Math.max(props.insets?.left || 0, props.insets?.right || 0, 20) : (compact ? 4 : 10)}
        />
      ) : null}
    </View>
  );
}

export function FullscreenVisualFeedback({ isAudioOnly, brightness, zoomBadgeText, seekRipple }) {
  return (
    <>
      {!isAudioOnly && brightness < 1 ? (
        <View
          style={[styles.brightnessDimOverlay, { opacity: 1 - brightness }]}
          pointerEvents="none"
        />
      ) : null}
      {zoomBadgeText && !isAudioOnly ? (
        <View style={styles.zoomBadge} pointerEvents="none"><Text style={styles.zoomBadgeText}>{zoomBadgeText}</Text></View>
      ) : null}
      {seekRipple && !isAudioOnly ? (
        <View style={[styles.seekRippleOverlay, seekRipple.side === 'left' ? styles.seekRippleLeft : styles.seekRippleRight]} pointerEvents="none">
          <View style={styles.seekRippleCircle}>
            <PlayerIcon name={seekRipple.side === 'left' ? 'rewind-10' : 'fast-forward-10'} size={48} color="#FFFFFF" />
            <Text style={styles.seekRippleText}>{seekRipple.text}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

export function FullscreenStatusLayer({
  isAudioOnly, audioOnlyProps, isLoading, errorMessage, scale, handleClose,
}) {
  return (
    <>
      {isAudioOnly ? <AudioOnlyView {...audioOnlyProps} /> : null}
      {isLoading && !errorMessage ? (
        <View pointerEvents="none" style={styles.loadingLayer}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={[styles.loadingText, { fontSize: scale.loadingFont, fontWeight: scale.loadingWeight }]}>Loading stream...</Text>
        </View>
      ) : null}
      {errorMessage ? (
        <View style={styles.centeredOverlay}>
          <PlayerIcon name="alert-circle-outline" size={48} color="#FF5252" />
          <Text style={[styles.errorTitle, { fontSize: scale.errorTitleFont, fontWeight: scale.errorTitleWeight }]}>Playback Error</Text>
          <Text style={[styles.errorMsg, { fontSize: scale.errorMsgFont }]}>{errorMessage}</Text>
          <TouchableOpacity style={styles.errorBtn} onPress={handleClose}>
            <Text style={[styles.errorBtnText, { fontWeight: scale.errorBtnWeight }]}>Close</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}

export function FullscreenChatLayer(props) {
  if (!props.visible || props.isAudioOnly) return null;
  return (
    <LiveChatDrawer
      videoId={props.mediaId || props.title || 'live'}
      userId={props.currentUser.id}
      username={props.currentUser.username}
      visible={props.visible}
      onClose={props.onClose}
      isLandscape={props.isLandscape}
      initialTab={props.drawerTab}
      drawerMode={props.drawerMode}
      portraitVideoHeight={props.portraitVideoHeight}
      streamUrl={props.playbackUrl || props.streamUrl || ''}
      serverUrl={props.playbackUrl || props.streamUrl || ''}
      isLive={props.isLive}
      isLiveCommentsEnabled={props.isLiveCommentsEnabled}
      isEpgEnabled={props.isEpgEnabled}
      diagnosticsEnabled={props.diagnosticsEnabled}
      title={props.title}
      streamId={props.mediaId}
      integrations={props.integrations}
      users={props.users || props.integrations?.users}
      colors={props.colors}
      messagePageSize={props.messagePageSize}
      drawerStyle={props.drawerStyle}
      fullscreen={props.isFullscreen}
      landscapeFullWidth={props.landscapeFullWidth ?? props.isLandscape}
      safeAreaInsets={props.insets}
    />
  );
}

export function FullscreenRecordingLayer(props) {
  const recordingEligible = props.canRecord;
  return (
    <>
      {!props.isAudioOnly && recordingEligible && (props.isScreenRecorderEnabled || props.recStatus !== 'idle') ? (
        <LiveRecordingOverlay
          status={props.recStatus}
          elapsedMs={props.recElapsedMs}
          colors={props.colors}
          topInset={Math.max(props.insets?.top || 0, 8)}
          showTransport
          onPause={props.handlePauseRecording}
          onResume={props.handleResumeRecording}
          onStop={props.handleStopRecording}
        />
      ) : null}
      {!props.isAudioOnly && recordingEligible && props.isScreenRecorderEnabled ? (
        <LiveRecordingNotice notice={props.recNotice} colors={props.colors} onDismiss={props.onDismissNotice} />
      ) : null}
      <RecordingSaveDialog
        saveDialog={props.saveDialog}
        colors={props.colors}
        onDismiss={props.onDismissSaveDialog}
      />
    </>
  );
}
