import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  useWindowDimensions,
  PanResponder,
  BackHandler,
  Modal,
} from 'react-native';
import VLCPlayer from '../../packages/react-native-vlc-media-player/VLCPlayer.js';
import { WebVideoPlayer } from './media/WebVideoPlayer';
import { ElectronVideoPlayer } from './media/ElectronVideoPlayer';
import { YouTubeVideoPlayer } from './media/YouTubeVideoPlayer';
import { LiveChatDrawer } from './media/LiveChatDrawer';
import { LiveRecordingNotice, LiveRecordingOverlay } from './media/LiveRecordingOverlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayerIcon } from './customization';
import { isWeb, isAndroid, isElectron } from '../utils/runtimePlatform';
import { getFontSize, getFontWeight } from '../utils/layoutUtils';
import { isLocalMediaUri } from '../utils/mediaUtils';
import {
  USER_AGENT,
  calculateScreenAspectRatio,
  isSafariOrIOS,
  getWebPoint,
  applyTrackDefaults,
  VLC_AVAILABLE,
  VLCBoundary,
  ExoVideoFallback,
  AudioOnlyView,
  CenterControls,
  PlayerTopBar,
  PlayerBottomBar,
} from './media/player';

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
};

const normalizeBrightness = (value) => Number(clampNumber(value, 0.1, 1, 1).toFixed(2));
const normalizeVolume = (value) => Math.round(clampNumber(value, 0, 100, 100));

function pickShuffleCandidate(candidates, season, episode) {
  if (candidates.length < 2) return candidates[0] || null;

  const cryptoProvider = globalThis.crypto;
  if (typeof cryptoProvider?.getRandomValues === 'function') {
    try {
      const randomValue = new Uint32Array(1);
      cryptoProvider.getRandomValues(randomValue);
      return candidates[randomValue[0] % candidates.length];
    } catch {
      // The fallback only selects an episode; it is not used for security tokens.
    }
  }

  const seed = `${season ?? ''}:${episode ?? ''}:${Date.now()}`;
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  return candidates[(hash >>> 0) % candidates.length];
}

// Gesture events can arrive much faster than the native player can consume
// volume updates. Coalesce them to display-rate updates for the UI and a
// slower native volume cadence so a drag stays smooth without audio crackle.
const scheduleControlFrame = (callback) => {
  if (typeof requestAnimationFrame === 'function') {
    return { kind: 'raf', id: requestAnimationFrame(callback) };
  }
  return { kind: 'timeout', id: setTimeout(callback, 16) };
};

const cancelControlFrame = (handle) => {
  if (!handle) return;
  if (handle.kind === 'raf' && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle.id);
  } else {
    clearTimeout(handle.id);
  }
};

const scheduleNativeVolumeFrame = (callback) => ({
  kind: 'timeout',
  id: setTimeout(callback, 32),
});

// Preserve the full video frame by default on every platform. Users can still
// choose Fill Screen from the player controls when they explicitly want crop.
const DEFAULT_ASPECT_RATIO = 'FIT';

function getPanelActionName(tab) {
  if (tab === 'chat') return 'onLiveChatOpen';
  if (tab === 'epg') return 'onEpgOpen';
  return 'onDiagnosticsOpen';
}

function normalizeProgressEvent(data, audioOffsetMs) {
  if (!data) return null;
  const payload = data.nativeEvent || data;
  let currentMs = payload.currentTime;
  let durationMs = payload.duration;
  const usePositionFallback = currentMs === null || currentMs === undefined || currentMs === 0;
  if (usePositionFallback && payload.position !== null && payload.position !== undefined && durationMs > 0) {
    currentMs = payload.position * durationMs;
  }
  if (audioOffsetMs > 0) {
    currentMs = Number(currentMs || 0) + audioOffsetMs;
    if (Number(durationMs) > 0) durationMs = Number(durationMs) + audioOffsetMs;
  }
  return {
    currentMs,
    durationMs,
    hasPosition: Number(currentMs) > 0 || Number(payload.position) > 0,
    seconds: Math.max(0, Math.floor((currentMs || 0) / 1000)),
    durationSeconds: Math.max(0, Math.floor((durationMs || 0) / 1000)),
  };
}

function applyPendingSeek(pendingSeekRef, lastKnownDurationRef, audioOffsetSeconds, playerRef) {
  if (pendingSeekRef.current === null || pendingSeekRef.current === undefined || lastKnownDurationRef.current <= 0) return;
  const playerDuration = Math.max(0, lastKnownDurationRef.current - audioOffsetSeconds);
  const playerTarget = Math.max(0, Number(pendingSeekRef.current) - audioOffsetSeconds);
  const ratio = Math.max(0, Math.min(1, playerTarget / Math.max(playerDuration, 1)));
  pendingSeekRef.current = null;
  try {
    if (typeof playerRef.current?.seek === 'function') playerRef.current.seek(ratio);
  } catch {
    // Native seek is best-effort while the player is transitioning.
  }
}

function applyProgressState(progress, state) {
  if (!progress) return;
  if (progress.hasPosition) {
    state.hasStartedPlaybackRef.current = true;
    state.clearAudioOnlyFallbackTimer();
    state.clearBufferingIndicator();
  } else if (state.hasStartedPlaybackRef.current) {
    state.clearBufferingIndicator();
  }
  if (progress.durationSeconds > 0) {
    state.setDuration(progress.durationSeconds);
    state.lastKnownDurationRef.current = progress.durationSeconds;
  }

  applyPendingSeek(state.pendingSeekRef, state.lastKnownDurationRef, state.audioOffsetSeconds, state.playerRef);
  const now = Date.now();
  if (state.isSeeking.current && now - state.seekCompletedAt.current > 2000) state.isSeeking.current = false;
  if (!state.isSeeking.current && now - state.seekCompletedAt.current > 1000) {
    state.setCurrentTime(progress.seconds);
    state.lastKnownTimeRef.current = progress.seconds;
    state.setSliderPosition(progress.seconds);
  }
}

function handlePinchMove(touches, zoomState) {
  if (touches?.length !== 2) return false;
  const [firstTouch, secondTouch] = touches;
  const currentDistance = Math.hypot(firstTouch.pageX - secondTouch.pageX, firstTouch.pageY - secondTouch.pageY);
  if (zoomState.initialDistance.current === 0) {
    zoomState.initialDistance.current = currentDistance;
    zoomState.initialScale.current = zoomState.scale.current;
    return true;
  }
  if (zoomState.initialDistance.current > 0 && currentDistance > 0) {
    const ratio = currentDistance / zoomState.initialDistance.current;
    const nextScale = Math.max(0.25, Math.min(3.5, zoomState.initialScale.current * ratio));
    zoomState.scale.current = nextScale;
    zoomState.setScale(nextScale);
    zoomState.setBadge(`${Math.round(nextScale * 100)}% Zoom`);
    if (zoomState.badgeTimer.current) clearTimeout(zoomState.badgeTimer.current);
    zoomState.badgeTimer.current = setTimeout(() => zoomState.setBadge(''), 1500);
  }
  return true;
}

function handleVerticalGestureMove(touches, gestureState) {
  if (!isWeb() || gestureState.isLocked.current) return;
  const touch = touches?.[0];
  if (!touch) return;
  const deltaY = gestureState.startY.current - touch.pageY;
  const deltaX = Math.abs(touch.pageX - gestureState.startX.current);
  if (!gestureState.isSwiping.current && Math.abs(deltaY) > 10 && Math.abs(deltaY) > deltaX * 0.8) {
    gestureState.isSwiping.current = true;
  }
  if (!gestureState.isSwiping.current) return;
  const dragHeight = Math.max(180, (gestureState.windowHeight.current || 400) * 0.55);
  const deltaPercent = (deltaY / dragHeight) * 100;
  if (gestureState.side.current === 'brightness') {
    const value = Math.max(0.1, Math.min(1, Number(((gestureState.startValue.current * 100 + deltaPercent) / 100).toFixed(2))));
    gestureState.commitBrightness.current(value);
    return;
  }
  const volume = Math.max(0, Math.min(100, Math.round(gestureState.startValue.current + deltaPercent)));
  gestureState.commitVolume.current(volume);
}

function handleYouTubePlaybackState(state, playback) {
  if (state === 'playing') {
    playback.isPlayingRef.current = true;
    playback.setIsPlaying(true);
  } else if (state === 'paused' || state === 'ended') {
    playback.isPlayingRef.current = false;
    playback.setIsPlaying(false);
  }
}

function PlatformMediaSurface(props) {
  const {
    youtubeVideoId, playerStreamUrl, vlcRef, isPlaying, muted, videoOnlyMode,
    volume, playbackRate, aspectRatio, title, posterUrl, isLive, isAudioOnly,
    selectedAudioTrack, handleTracksChanged, handleProgress, handleNativePlaying,
    handleWebBuffering, handleEpisodeEnded, handleWebError, togglePlayPause,
    handleSeekByAction, handlePlaybackRoute, exoFallback, useExoForAndroidLocalMedia,
    nativeSource, computedAspectRatio, handleNativeLoadStart,
    handleNativeOpen, handleNativeBuffering, isPlayingRef, setIsPlaying,
  } = props;
  if (youtubeVideoId) {
    return (
      <YouTubeVideoPlayer
        key={`youtube-${youtubeVideoId}`}
        ref={vlcRef}
        videoId={youtubeVideoId}
        paused={!isPlaying}
        muted={muted || videoOnlyMode}
        volume={volume / 100}
        playbackRate={playbackRate}
        onReady={(event) => {
          props.clearBufferingIndicator();
          props.handleNativeOpen(event);
        }}
        onProgress={handleProgress}
        onPlaying={handleNativePlaying}
        onStateChange={(state) => handleYouTubePlaybackState(state, { isPlayingRef, setIsPlaying })}
        onBuffering={handleWebBuffering}
        onEnded={handleEpisodeEnded}
        onError={handleWebError}
      />
    );
  }
  if (isElectron()) {
    return (
      <ElectronVideoPlayer
        key={`electron-vlc-${playerStreamUrl}`}
        ref={vlcRef}
        streamUrl={playerStreamUrl}
        paused={!isPlaying}
        muted={muted || videoOnlyMode}
        volume={muted || videoOnlyMode ? 0 : volume}
        playbackRate={playbackRate}
        videoAspectRatio={aspectRatio}
        title={title}
        posterUrl={posterUrl}
        isLive={isLive}
        audioOnly={isAudioOnly}
        audioTrack={selectedAudioTrack}
        onTracksChanged={handleTracksChanged}
        onProgress={handleProgress}
        onPlaying={handleNativePlaying}
        onPlaybackStateChange={togglePlayPause}
        onBuffering={handleWebBuffering}
        onEnded={handleEpisodeEnded}
        onError={handleWebError}
        onClose={props.handleClose}
        onPlaybackRoute={handlePlaybackRoute}
      />
    );
  }
  if (isWeb()) {
    return (
      <WebVideoPlayer
        key={`web-${playerStreamUrl}`}
        ref={vlcRef}
        streamUrl={playerStreamUrl}
        paused={!isPlaying}
        muted={muted || videoOnlyMode}
        volume={muted || videoOnlyMode ? 0 : volume}
        playbackRate={playbackRate}
        videoAspectRatio={aspectRatio}
        title={title}
        posterUrl={posterUrl}
        isLive={isLive}
        audioOnly={isAudioOnly}
        videoOnly={videoOnlyMode}
        audioTrack={selectedAudioTrack}
        onTracksChanged={handleTracksChanged}
        onProgress={handleProgress}
        onPlaying={handleNativePlaying}
        onBuffering={handleWebBuffering}
        onEnded={handleEpisodeEnded}
        onError={handleWebError}
        onTogglePlayPause={togglePlayPause}
        onSeekBy={handleSeekByAction}
        onPlaybackRoute={handlePlaybackRoute}
      />
    );
  }
  if (VLC_AVAILABLE && !useExoForAndroidLocalMedia) {
    return (
      <VLCBoundary key={`vlcb-${playerStreamUrl}`} fallback={exoFallback}>
        <VLCPlayer
          rate={playbackRate}
          key={`vlc-${playerStreamUrl}`}
          ref={vlcRef}
          style={styles.video}
          autoAspectRatio={false}
          videoAspectRatio={computedAspectRatio}
          audioTrack={selectedAudioTrack}
          autoplay={true}
          paused={!isPlaying}
          muted={false}
          volume={muted || videoOnlyMode ? 0 : volume}
          playInBackground={isAudioOnly}
          playWhenInactive={isAudioOnly}
          source={nativeSource}
          onLoadStart={handleNativeLoadStart}
          onProgress={handleProgress}
          onVLCProgress={handleProgress}
          onPlaying={handleNativePlaying}
          onVLCPlaying={handleNativePlaying}
          onOpen={handleNativeOpen}
          onVLCOpened={handleNativeOpen}
          onEnd={handleEpisodeEnded}
          onBuffering={handleNativeBuffering}
          onVLCBuffering={handleNativeBuffering}
          onError={handleWebError}
          onVLCError={handleWebError}
        />
      </VLCBoundary>
    );
  }
  return exoFallback;
}

function InlinePreviewTopActions({ controls, muted, videoOnlyMode, handleMuteAction }) {
  return (
    <View style={styles.inlinePreviewTopRow} pointerEvents="box-none">
      <View style={styles.inlineLiveBadge} pointerEvents="none">
        <View style={styles.inlineLiveDot} />
        <Text style={styles.inlineLiveText}>LIVE</Text>
      </View>
      <View style={{ flex: 1 }} />
      {controls.mute !== false ? (
        <TouchableOpacity
          style={styles.inlinePreviewIconButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
          onPress={(event) => {
            event?.stopPropagation?.();
            handleMuteAction();
          }}
        >
          <PlayerIcon name={muted || videoOnlyMode ? 'volume-off' : 'volume-high'} size={19} color="#FFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function InlinePreviewCenterAction({ controls, colors, isPlaying, handlePlayPauseAction }) {
  return (
    <View style={styles.inlinePreviewCenterControls} pointerEvents="box-none">
      {controls.playPause !== false ? (
        <TouchableOpacity
          style={[styles.inlinePreviewCenterButton, { backgroundColor: colors?.brandAccent || (colors?.mode === 'dark' ? '#FF9A86' : '#D95045') }]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
          onPress={(event) => {
            event?.stopPropagation?.();
            handlePlayPauseAction();
          }}
        >
          <PlayerIcon name={isPlaying ? 'pause' : 'play'} size={27} color="#FFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function InlinePreviewBottomActions({
  controls, title, showInlineChatButton, showLiveChat, handlePanelAction,
  isFullscreen, handleFullscreenAction, invokeAction, onPromotePreview, mediaId,
}) {
  return (
    <View style={styles.inlinePreviewBottomRow} pointerEvents="box-none">
      <Text style={styles.inlinePreviewTitle} numberOfLines={1} pointerEvents="none">{title || 'Live TV'}</Text>
      <View style={styles.inlinePreviewActions} pointerEvents="box-none">
        {controls.liveChat !== false && showInlineChatButton && !showLiveChat ? (
          <TouchableOpacity
            style={styles.inlineChatButton}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="Open live chat"
            onPress={(event) => {
              event?.stopPropagation?.();
              handlePanelAction('chat');
            }}
          >
            <PlayerIcon name="comment-text-outline" size={17} color="#FFF" />
            <Text style={styles.inlineChatButtonText}>Live Chat</Text>
          </TouchableOpacity>
        ) : null}
        {controls.fullscreen !== false ? (
          <TouchableOpacity
            style={styles.inlinePreviewIconButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Open live player'}
            onPress={(event) => {
              event?.stopPropagation?.();
              if (isFullscreen) handleFullscreenAction();
              else invokeAction('onFullscreen', onPromotePreview, { title, mediaId });
            }}
          >
            <PlayerIcon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={20} color="#FFF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function InlinePreviewFeedback({ isLoading, errorMessage }) {
  if (isLoading && !errorMessage) {
    return (
      <View pointerEvents="none" style={styles.inlinePreviewLoading}>
        <View style={styles.inlinePreviewLoadingPill}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.inlinePreviewLoadingText}>Loading stream…</Text>
        </View>
      </View>
    );
  }
  if (!errorMessage) return null;
  return (
    <View pointerEvents="none" style={styles.inlinePreviewError}>
      <PlayerIcon name="alert-circle-outline" size={20} color="#FFF" />
      <Text style={styles.inlinePreviewErrorText} numberOfLines={2}>{errorMessage}</Text>
    </View>
  );
}

function InlinePreviewFrame({
  hostRef, isValidPreviewRect, positionStyle, videoPlayer, title, onPromotePreview,
  controls, colors, muted, videoOnlyMode, handleMuteAction, isPlaying,
  handlePlayPauseAction, showInlineChatButton, showLiveChat, handlePanelAction,
  isFullscreen, handleFullscreenAction, invokeAction, mediaId, isLoading,
  errorMessage, children,
}) {
  return (
    <View
      ref={hostRef}
      collapsable={false}
      pointerEvents={!isValidPreviewRect ? 'box-none' : 'auto'}
      style={[styles.playerHost, styles.playerHostInline, positionStyle]}
    >
      <View collapsable={false} pointerEvents="auto" style={styles.inlineVideoStage}>
        <View collapsable={false} pointerEvents="none" style={styles.videoContainer}>{videoPlayer}</View>
        <View style={styles.inlinePreviewChrome} pointerEvents="box-none">
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={`Open ${title || 'live channel'} in the video player`}
            onPress={onPromotePreview}
          />
          <InlinePreviewTopActions controls={controls} muted={muted} videoOnlyMode={videoOnlyMode} handleMuteAction={handleMuteAction} />
          {!isLoading ? (
            <InlinePreviewCenterAction controls={controls} colors={colors} isPlaying={isPlaying} handlePlayPauseAction={handlePlayPauseAction} />
          ) : null}
          <InlinePreviewBottomActions
            controls={controls}
            title={title}
            showInlineChatButton={showInlineChatButton}
            showLiveChat={showLiveChat}
            handlePanelAction={handlePanelAction}
            isFullscreen={isFullscreen}
            handleFullscreenAction={handleFullscreenAction}
            invokeAction={invokeAction}
            onPromotePreview={onPromotePreview}
            mediaId={mediaId}
          />
          <InlinePreviewFeedback isLoading={isLoading} errorMessage={errorMessage} />
        </View>
      </View>
      {children}
    </View>
  );
}

function FullscreenVideoLayer({ videoPlayer, zoomScale, isAudioOnly }) {
  return (
    <View
      collapsable={false}
      pointerEvents="none"
      style={[
        styles.videoContainer,
        styles.videoWrapFullscreen,
        zoomScale !== 1 && { transform: [{ scale: zoomScale }] },
        isAudioOnly && { opacity: 0 },
      ]}
    >
      {videoPlayer}
    </View>
  );
}

function FullscreenGestureLayer({ isAudioOnly, panResponder, handlers }) {
  if (isAudioOnly) return null;
  if (!isWeb() && panResponder) {
    return (
      <View collapsable={false} style={[StyleSheet.absoluteFill, styles.gestureCatcher]} {...panResponder.panHandlers} />
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

function FullscreenControlsLayer({ showControls, isLocked, isAudioOnly, children }) {
  if (!showControls || isLocked || isAudioOnly) return null;
  return <View style={styles.controlsShell} pointerEvents="box-none">{children}</View>;
}

function FullscreenControlsPanel(props) {
  return (
    <>
      <PlayerTopBar
        insets={props.insets}
        scale={props.scale}
        title={props.title}
        episodeLabel={props.episodeLabel}
        isLive={props.isLive}
        isScreenRecorderEnabled={props.isScreenRecorderEnabled}
        recStatus={props.recStatus}
        isLoading={props.isLoading}
        showLiveChat={props.showLiveChat}
        drawerTab={props.drawerTab}
        isLiveCommentsEnabled={props.isLiveCommentsEnabled}
        isEpgEnabled={props.isEpgEnabled}
        diagnosticsOverlayEnabled={props.diagnosticsOverlayEnabled}
        muted={props.muted}
        controls={props.controls}
        onClose={props.onClose}
        onStartRecording={(event) => props.handleRecordingAction('onRecordingStart', props.handleStartRecording, event)}
        onResumeRecording={(event) => props.handleRecordingAction('onRecordingResume', props.handleResumeRecording, event)}
        onPauseRecording={(event) => props.handleRecordingAction('onRecordingPause', props.handlePauseRecording, event)}
        onStopRecording={(event) => props.handleRecordingAction('onRecordingStop', props.handleStopRecording, event)}
        onToggleChatTab={props.handlePanelAction}
        onRestart={props.handleRestartAction}
        onToggleMute={props.handleMuteAction}
        onToggleLock={props.handleLockAction}
      />
      <CenterControls
        visible={!props.isAudioOnly && !props.isLoading && props.controls.playPause !== false}
        isLive={props.isLive}
        isPlaying={props.isPlaying}
        onSeekBy={props.handleSeekByAction}
        onTogglePlayPause={props.handlePlayPauseAction}
      />
      <PlayerBottomBar
        isLive={props.isLive}
        insets={props.insets}
        scale={props.scale}
        isSeeking={props.isSeeking}
        sliderPos={props.sliderPos}
        currentTime={props.currentTime}
        duration={props.duration}
        isAudioOnlyFeatureEnabled={props.isAudioOnlyFeatureEnabled}
        isAudioOnly={props.isAudioOnly}
        isVideoOnly={props.videoOnlyMode}
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
        onToggleVideoOnly={props.handleVideoOnlyAction}
      />
    </>
  );
}

function FullscreenVisualFeedback({ isAudioOnly, isWebPlatform, brightness, zoomBadgeText, seekRipple }) {
  return (
    <>
      {isWebPlatform && !isAudioOnly && brightness < 1 ? (
        <View
          style={[styles.brightnessDimOverlay, { opacity: Math.max(0, Math.min(0.88, (1 - brightness) * 0.95)) }]}
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

function FullscreenStatusLayer({
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

function FullscreenChatLayer(props) {
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
      streamUrl={props.playbackUrl || props.streamUrl || ''}
      serverUrl={props.playbackUrl || props.streamUrl || ''}
      isLive={props.isLive}
      isLiveCommentsEnabled={props.isLiveCommentsEnabled}
      isEpgEnabled={props.isEpgEnabled}
      diagnosticsEnabled={props.diagnosticsEnabled}
      title={props.title}
      streamId={props.mediaId}
      integrations={props.integrations}
      colors={props.colors}
    />
  );
}

function FullscreenRecordingLayer(props) {
  return (
    <>
      {!props.isAudioOnly && props.isLive && (props.isScreenRecorderEnabled || props.recStatus !== 'idle') ? (
        <LiveRecordingOverlay
          status={props.recStatus}
          elapsedMs={props.recElapsedMs}
          colors={props.colors}
          topInset={Math.max(props.insets?.top || 0, 12) + 8}
          showTransport
          onPause={props.handlePauseRecording}
          onResume={props.handleResumeRecording}
          onStop={props.handleStopRecording}
        />
      ) : null}
      {!props.isAudioOnly && props.isLive && props.isScreenRecorderEnabled ? (
        <LiveRecordingNotice notice={props.recNotice} colors={props.colors} onDismiss={props.onDismissNotice} />
      ) : null}
    </>
  );
}

function FullscreenSessionLayer({ locked, controlsVisible, isAudioOnly, insets, scale, onToggleLock }) {
  if (!locked || !controlsVisible || isAudioOnly) return null;
  return locked && controlsVisible ? (
        <TouchableOpacity
          style={[styles.floatingLockBtn, {
            top: Math.max(insets?.top || 0, 24),
            right: Math.max(insets?.left || 0, insets?.right || 0, 20),
          }]}
          onPress={(event) => {
            event.stopPropagation();
            onToggleLock();
          }}
          activeOpacity={0.8}
          hitSlop={16}
        >
          <PlayerIcon name="lock" size={22} color="#FF5252" />
          <Text style={[styles.floatingLockText, { fontSize: scale.lockTextFont, fontWeight: scale.lockTextWeight }]}>Locked</Text>
        </TouchableOpacity>
  ) : null;
}

function isUsableInlinePreviewRect(rect) {
  return Boolean(rect && rect.width > 20 && rect.height > 20 && rect.x > -1000 && rect.y > -1000);
}

function getInlinePreviewPositionStyle(rect, isValid) {
  if (!isValid) return { opacity: 0 };
  const clippingStyle = isWeb() && rect.clipTop > 0
    ? { clipPath: `inset(${rect.clipTop}px 0 0 0)`, WebkitClipPath: `inset(${rect.clipTop}px 0 0 0)` }
    : {};
  return {
    position: isWeb() ? 'fixed' : 'absolute',
    top: rect.y,
    left: rect.x,
    right: null,
    bottom: null,
    width: rect.width,
    height: rect.height,
    ...clippingStyle,
  };
}

export const MediaPlayerView = ({
  visible,
  streamUrl,
  youtubeVideoId,
  title,
  mediaType = 'live',
  onClose,
  colors,
  initialShowLiveChat = false,
  initialMuted = false,
  initialVolume = 100,
  initialPlaybackRate = 1,
  showInlineChatButton = true,
  onPlayerHostRef,
  onInlinePreviewWheel,
  inlinePreview = false,
  inlinePreviewRect = null,
  onPromotePreview,
  mediaId,
  posterUrl,
  episodeLabel,
  resumePosition = 0,
  durationSecs = 0,
  season,
  episode,
  onCwRefresh,
  playlist,
  shuffle,
  onNextEpisode,
  liveChatNonce = 0,
  genre,
  categoryName,
  controls = {},
  features = {},
  actions = {},
  integrations = {},
  theme,
  icons,
  videoOnly = false,
  initialAudioOnly = false,
  initialPaused = false,
  playerApiRef,
  style,
  onReady,
  onProgress,
  onPlaying,
  onBuffering,
  onError,
  onEnded,
  onPlaybackRoute,
}) => {
  colors = theme?.colors || (theme ? {
    ...colors,
    mode: theme.mode || colors?.mode,
    brandAccent: theme.accentColor || theme.brandAccent || colors?.brandAccent,
    primary: theme.accentColor || theme.primary || colors?.primary,
    surface: theme.surfaceColor || colors?.surface,
    onSurfacePrimary: theme.textColor || colors?.onSurfacePrimary,
    onSurfaceSecondary: theme.mutedTextColor || colors?.onSurfaceSecondary,
    outline: theme.borderColor || colors?.outline,
  } : colors);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const windowSizeRef = useRef({ w: windowWidth, h: windowHeight });
  const insetsRef = useRef(insets);
  windowSizeRef.current = { w: windowWidth, h: windowHeight };
  insetsRef.current = insets;
  const vlcRef = useRef(null);
  const playerRef = useRef(null);
  const invokeAction = useCallback((name, fallback, payload) => {
    const callback = actions?.[name];
    if (typeof callback === 'function') {
      return callback(payload, { player: playerApiRef?.current || null });
    }
    return fallback?.();
  }, [actions, playerApiRef]);
  const handlePlayerHostRef = useCallback((node) => {
    playerRef.current = node;
    onPlayerHostRef?.(node);
  }, [onPlayerHostRef]);

  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(() => clampNumber(initialPlaybackRate, 0.25, 4, 1));
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isPlaying, setIsPlaying] = useState(!initialPaused);
  const isPlayingRef = useRef(!initialPaused);
  isPlayingRef.current = isPlaying;
  const [playbackUrl, setPlaybackUrl] = useState(streamUrl || '');
  const [muted, setMuted] = useState(!!initialMuted);
  const [videoOnlyMode, setVideoOnlyMode] = useState(!!videoOnly);
  const mutedRef = useRef(!!initialMuted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // VLC-Style Vertical Swipe Brightness & Volume Gestures
  const [brightness, setBrightness] = useState(1.0); // 0.1 to 1.0 (10% - 100%)
  const brightnessRef = useRef(1.0);
  const brightnessFrameRef = useRef(null);
  const pendingBrightnessRef = useRef(1.0);
  useEffect(() => {
    brightnessRef.current = brightness;
  }, [brightness]);

  const [volume, setVolume] = useState(() => normalizeVolume(initialVolume)); // 0 to 100
  const volumeRef = useRef(100);
  const volumeFrameRef = useRef(null);
  const pendingVolumeRef = useRef(100);
  const pendingUnmuteRef = useRef(false);
  useEffect(() => {
    if (!visible) return;
    const nextMuted = !!initialMuted;
    mutedRef.current = nextMuted;
    pendingUnmuteRef.current = false;
    setMuted(nextMuted);
  }, [initialMuted, streamUrl, visible]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    const nextVolume = normalizeVolume(initialVolume);
    volumeRef.current = nextVolume;
    pendingVolumeRef.current = nextVolume;
    setVolume(nextVolume);
  }, [initialVolume]);

  const gestureStartXRef = useRef(0);
  const gestureStartYRef = useRef(0);
  const gestureSideRef = useRef(null); // 'brightness' | 'volume'
  const gestureStartValRef = useRef(0);
  const isSwipingRef = useRef(false);
  const webTouchStartRef = useRef(null);

  const commitBrightness = useCallback((value) => {
    const next = normalizeBrightness(value);
    brightnessRef.current = next;
    pendingBrightnessRef.current = next;

    if (!brightnessFrameRef.current) {
      brightnessFrameRef.current = scheduleControlFrame(() => {
        brightnessFrameRef.current = null;
        setBrightness(pendingBrightnessRef.current);
      });
    }
  }, []);

  const commitVolume = useCallback((value, { unmute = true } = {}) => {
    const next = normalizeVolume(value);
    volumeRef.current = next;
    pendingVolumeRef.current = next;

    // A swipe away from zero is also an explicit unmute. Update the ref
    // immediately so the next gesture starts from the value the user sees,
    // without waiting for React's render/effect cycle.
    if (unmute && mutedRef.current && next > 0) {
      mutedRef.current = false;
      pendingUnmuteRef.current = true;
    }

    if (!volumeFrameRef.current) {
      volumeFrameRef.current = scheduleNativeVolumeFrame(() => {
        volumeFrameRef.current = null;
        setVolume(pendingVolumeRef.current);
        if (pendingUnmuteRef.current) {
          pendingUnmuteRef.current = false;
          setMuted(false);
        }
      });
    }
  }, []);

  const commitBrightnessRef = useRef(commitBrightness);
  commitBrightnessRef.current = commitBrightness;
  const commitVolumeRef = useRef(commitVolume);
  commitVolumeRef.current = commitVolume;

  useEffect(() => {
    return () => {
      cancelControlFrame(brightnessFrameRef.current);
      cancelControlFrame(volumeFrameRef.current);
      brightnessFrameRef.current = null;
      volumeFrameRef.current = null;
    };
  }, []);

  const [showLiveChat, setShowLiveChat] = useState(false);
  const [drawerTab, setDrawerTab] = useState('chat');
  const isLiveCommentsEnabled = controls.liveChat ?? Boolean(integrations.liveChat?.loadMessages && integrations.liveChat?.sendMessage);
  const isEpgEnabled = controls.epg ?? Boolean(integrations.epg?.loadListings);
  const diagnosticsOverlayEnabled = Boolean(features.diagnostics);
  const isAudioOnlyFeatureEnabled = controls.audioOnly ?? true;
  const isScreenRecorderEnabled = controls.recording ?? Boolean(integrations.recording);
  const recording = integrations.recording;
  const [currentUser, setCurrentUser] = useState(integrations.user || { id: '0', username: 'Viewer' });

  const badgeService = useMemo(() => ({
    emit: (name, payload) => Promise.resolve(integrations.onEvent?.({ name, payload })).catch(() => {}),
    recordProgress: (payload) => Promise.resolve(integrations.onProgress?.(payload)).catch(() => {}),
  }), [integrations]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await integrations.getUser?.();
        if (active && user) setCurrentUser(user);
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [integrations]);

  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);
  useEffect(() => {
    isLockedRef.current = isLocked;
  }, [isLocked]);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const aspectRatioRef = useRef(DEFAULT_ASPECT_RATIO);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [showAspectPicker, setShowAspectPicker] = useState(false);

  // Pinch-to-Zoom & Double-Tap Seek (Mobile)
  const [zoomScale, setZoomScale] = useState(1);
  const zoomScaleRef = useRef(1);
  const [zoomBadgeText, setZoomBadgeText] = useState('');
  const zoomBadgeTimer = useRef(null);

  const [seekRipple, setSeekRipple] = useState(null); // { side: 'left' | 'right', text: string }
  const seekRippleTimer = useRef(null);

  const initialDistanceRef = useRef(0);
  const initialScaleRef = useRef(1);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0, side: null });
  const singleTapTimerRef = useRef(null);
  const touchHandledRef = useRef(false);

  useEffect(() => {
    if (!isWeb() || typeof document === 'undefined') return;
    const handleFsChange = () => {
      const fsElem = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      const node = playerRef.current;
      setIsFullscreen(!!node && !!fsElem && (fsElem === node || node.contains(fsElem)));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  const exitFullscreen = useCallback(() => {
    if (!isWeb() || typeof document === 'undefined') return;
    const fsElem = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    if (!fsElem) return;
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isWeb() && typeof document !== 'undefined') {
      const node = playerRef.current;
      if (!node) return;
      const fsElem = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      if (!fsElem) {
        if (node.requestFullscreen) {
          node.requestFullscreen().catch(() => {});
        } else if (node.webkitRequestFullscreen) {
          node.webkitRequestFullscreen();
        } else if (node.mozRequestFullScreen) {
          node.mozRequestFullScreen();
        } else if (node.msRequestFullscreen) {
          node.msRequestFullscreen();
        }
      } else {
        exitFullscreen();
      }
    } else {
      setIsFullscreen((prev) => !prev);
    }
    badgeService.emit('player.fullscreen', {}).catch(() => {});
  }, [exitFullscreen]);

  const computedAspectRatio = useMemo(() => {
    if (aspectRatio === 'FIT') {
      return 'FIT_SCREEN';
    }
    if (aspectRatio === 'FILL_SCREEN') {
      return calculateScreenAspectRatio(windowWidth, windowHeight);
    }
    return aspectRatio;
  }, [aspectRatio, windowWidth, windowHeight]);

  const scale = useMemo(() => ({
    backFont: getFontSize(14, windowWidth, windowHeight),
    titleFont: getFontSize(16, windowWidth, windowHeight),
    lockTextFont: getFontSize(14, windowWidth, windowHeight),
    timeFont: getFontSize(13, windowWidth, windowHeight),
    aspectBubbleFont: getFontSize(13, windowWidth, windowHeight),
    loadingFont: getFontSize(14, windowWidth, windowHeight),
    errorTitleFont: getFontSize(18, windowWidth, windowHeight),
    errorMsgFont: getFontSize(14, windowWidth, windowHeight),
    backWeight: getFontWeight('600', windowWidth, windowHeight),
    titleWeight: getFontWeight('700', windowWidth, windowHeight),
    lockTextWeight: getFontWeight('700', windowWidth, windowHeight),
    timeWeight: getFontWeight('600', windowWidth, windowHeight),
    timeSeekingWeight: getFontWeight('800', windowWidth, windowHeight),
    aspectBubbleWeight: getFontWeight('600', windowWidth, windowHeight),
    aspectBubbleSelectedWeight: getFontWeight('800', windowWidth, windowHeight),
    loadingWeight: getFontWeight('600', windowWidth, windowHeight),
    errorTitleWeight: getFontWeight('800', windowWidth, windowHeight),
    errorBtnWeight: getFontWeight('800', windowWidth, windowHeight),
  }), [windowWidth, windowHeight]);

  const handleSelectAspectRatio = useCallback(
    (val) => {
      setZoomScale(1);
      zoomScaleRef.current = 1;

      const aspectChanged = val !== aspectRatioRef.current;
      const preservedPosition =
        mediaType !== 'live' && mediaType !== 'channel'
          ? Number(lastKnownTimeRef.current || 0)
          : 0;
      if (aspectChanged) {
        aspectRatioRef.current = val;
        setAspectRatio(val);
      }

      let targetRatio = val;
      if (val === 'FIT') {
        targetRatio = 'FIT';
      } else if (val === 'FILL_SCREEN') {
        targetRatio = calculateScreenAspectRatio(windowWidth, windowHeight);
      }

      // Live update — the video keeps playing; only the picture shape changes.
      // The expo-video fallback and web player understand the raw mode
      // ('FIT', 'FILL_SCREEN', '16:9'); native VLC expects a ratio string.
      try {
        if (vlcRef.current && typeof vlcRef.current.changeVideoAspectRatio === 'function') {
          const useRawMode = isWeb() || !VLC_AVAILABLE;
          vlcRef.current.changeVideoAspectRatio(useRawMode ? val : targetRatio);
        }
      } catch (e) {
        // aspect-ratio change is best-effort
      }
      if (aspectChanged) {
        if (preservedPosition > 0) {
          // Some Android VLC builds briefly recreate the video output when
          // the aspect ratio prop changes. Re-apply the exact current
          // position after the output settles so a dimension tap never jumps
          // back to the original resume point.
          restorePositionRef.current?.(preservedPosition, 120);
        }
        badgeService.emit('player.aspect', { aspect: val }).catch(() => {});
      }
    },
    [windowWidth, windowHeight, mediaType]
  );

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(Number(durationSecs) || 0);
  const [sliderPos, setSliderPos] = useState(0);

  const isSeeking = useRef(false);
  const bufferingTimerRef = useRef(null);
  const seekCompletedAt = useRef(0);
  const lastKnownTimeRef = useRef(0);
  const lastKnownDurRef = useRef(Number(durationSecs) || 0);
  const hasResumedRef = useRef(false);
  const hasStartedPlaybackRef = useRef(false);
  const restoreTimerRef = useRef(null);

  useEffect(() => {
    if (Number(durationSecs) > 0) {
      setDuration(Number(durationSecs));
      lastKnownDurRef.current = Number(durationSecs);
    }
  }, [durationSecs]);

  const clearBufferingIndicator = useCallback(() => {
    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
    setIsLoading((previous) => (previous ? false : previous));
  }, []);

  const scheduleBufferingIndicator = useCallback(() => {
    if (!isPlayingRef.current || isSeeking.current) return;
    if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
    bufferingTimerRef.current = setTimeout(() => {
      bufferingTimerRef.current = null;
      if (isPlayingRef.current && !isSeeking.current) {
        setIsLoading(true);
      }
    }, 450);
  }, []);

  useEffect(() => () => {
    if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
  }, []);

  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef(null);

  const isLive = mediaType === 'live' || mediaType === 'channel';
  const isInlinePreview = !!inlinePreview;

  useEffect(() => {
    if (!visible || !initialShowLiveChat || !isLive || !isLiveCommentsEnabled) return;
    setDrawerTab('chat');
    setShowLiveChat(true);
  }, [visible, mediaId, initialShowLiveChat, isLive, isLiveCommentsEnabled]);

  const lastLiveChatNonceRef = useRef(0);
  useEffect(() => {
    if (!liveChatNonce || liveChatNonce === lastLiveChatNonceRef.current) return;
    lastLiveChatNonceRef.current = liveChatNonce;
    if (!visible || !isLive || !isLiveCommentsEnabled) return;
    setDrawerTab('chat');
    setShowLiveChat(true);
  }, [liveChatNonce, visible, isLive, isLiveCommentsEnabled]);

  const [recStatus, setRecStatus] = useState('idle');
  const [recElapsedMs, setRecElapsedMs] = useState(0);
  const [recNotice, setRecNotice] = useState(null);
  const recNoticeTimer = useRef(null);
  const recStatusRef = useRef('idle');
  recStatusRef.current = recStatus;

  const [isAudioOnly, setIsAudioOnly] = useState(!!initialAudioOnly);
  const [audioOnlyStreamUrl, setAudioOnlyStreamUrl] = useState('');
  const [audioOnlyFallback, setAudioOnlyFallback] = useState(false);
  const isAudioOnlyRef = useRef(false);
  const audioOnlyStreamUrlRef = useRef('');
  const audioOnlyFallbackRef = useRef(false);
  const audioOnlyFallbackTimerRef = useRef(null);
  const restorePositionRef = useRef(null);
  const sourceRestorePositionRef = useRef(0);
  const audioModeStartPositionRef = useRef(0);
  useEffect(() => {
    isAudioOnlyRef.current = isAudioOnly;
  }, [isAudioOnly]);
  audioOnlyStreamUrlRef.current = audioOnlyStreamUrl;
  audioOnlyFallbackRef.current = audioOnlyFallback;

  // Audio mode is an in-place visual overlay across all platforms:
  // keeps the stream playing continuously without interrupting or reloading.
  const audioOnlyUsesProxy = false;

  const clearAudioOnlyFallbackTimer = useCallback(() => {
    if (audioOnlyFallbackTimerRef.current) {
      clearTimeout(audioOnlyFallbackTimerRef.current);
      audioOnlyFallbackTimerRef.current = null;
    }
  }, []);

  const activateNativeAudioFallback = useCallback(() => {
    return false;
  }, []);

  const brightnessBadgeReady = useRef(false);
  useEffect(() => {
    if (!brightnessBadgeReady.current) {
      brightnessBadgeReady.current = true;
      return;
    }
    badgeService.emit('player.brightness', {}).catch(() => {});
    badgeService.emit('player.gesture', {}).catch(() => {});
  }, [brightness]);

  const volumeBadgeReady = useRef(false);
  useEffect(() => {
    if (!volumeBadgeReady.current) {
      volumeBadgeReady.current = true;
      return;
    }
    badgeService.emit('player.volume', {}).catch(() => {});
    badgeService.emit('player.gesture', {}).catch(() => {});
  }, [volume]);

  const toggleAudioOnly = useCallback(() => {
    const next = !isAudioOnlyRef.current;
    isAudioOnlyRef.current = next;
    setIsAudioOnly(next);
    if (next) badgeService.emit('player.audioOnly', { mediaType }).catch(() => {});
  }, [mediaType]);

  const debouncedSaveTimerRef = useRef(null);

  const saveCurrentProgress = useCallback(() => {
    const curTime = lastKnownTimeRef.current;
    const durTime = lastKnownDurRef.current;
    const offline = isLocalMediaUri(streamUrl);
    const progress = {
      mediaId,
      title,
      posterUrl,
      mediaType: mediaType || (isLive ? 'channel' : 'movie'),
      season,
      episode,
      currentTime: curTime,
      duration: isLive ? 0 : durTime,
      streamUrl,
      genre,
      categoryName,
      playlist,
      playbackRate,
      offline,
      isLive,
    };
    if (offline || isLive || (mediaId && curTime > 5)) {
      badgeService.recordProgress(progress);
    }
  }, [isLive, mediaId, title, posterUrl, streamUrl, mediaType, season, episode, genre, categoryName, playlist, playbackRate, badgeService]);

  const debouncedSaveProgress = useCallback(() => {
    if (debouncedSaveTimerRef.current) {
      clearTimeout(debouncedSaveTimerRef.current);
    }
    debouncedSaveTimerRef.current = setTimeout(() => {
      saveCurrentProgress();
    }, 1000);
  }, [saveCurrentProgress]);

  // Periodic auto-save every 30s & save on unmount
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      saveCurrentProgress();
    }, 30000);

    return () => {
      clearInterval(interval);
      if (debouncedSaveTimerRef.current) {
        clearTimeout(debouncedSaveTimerRef.current);
      }
      saveCurrentProgress();
    };
  }, [isLive, visible, saveCurrentProgress]);

  // Reset player state when streamUrl changes
  useEffect(() => {
    clearAudioOnlyFallbackTimer();
    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
    setIsLoading(true);
    setErrorMessage(null);
    setIsPlaying(!initialPaused);
    isPlayingRef.current = !initialPaused;
    setVideoOnlyMode(!!videoOnly);
    setPlaybackUrl(streamUrl || '');
    setIsLocked(false);
    setIsAudioOnly(!!initialAudioOnly);
    isAudioOnlyRef.current = !!initialAudioOnly;
    setAudioOnlyStreamUrl('');
    setAudioOnlyFallback(false);
    audioOnlyStreamUrlRef.current = '';
    audioOnlyFallbackRef.current = false;
    sourceRestorePositionRef.current = 0;
    audioModeStartPositionRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setSliderPos(0);
    setPlaybackRate(clampNumber(initialPlaybackRate, 0.25, 4, 1));
    setShowControls(true);
    isSeeking.current = false;
    seekCompletedAt.current = 0;
    lastKnownTimeRef.current = 0;
    lastKnownDurRef.current = 0;
    hasResumedRef.current = false;
    hasStartedPlaybackRef.current = false;
    pendingSeekRef.current = null;
    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
    }
    return () => {
      if (bufferingTimerRef.current) {
        clearTimeout(bufferingTimerRef.current);
        bufferingTimerRef.current = null;
      }
      clearAudioOnlyFallbackTimer();
    };
  }, [clearAudioOnlyFallbackTimer, streamUrl, visible, initialPaused, initialPlaybackRate, videoOnly, initialAudioOnly]);

  // Reset aspect ratio & zoom state every time player opens or streamUrl changes
  useEffect(() => {
    if (visible) {
      setAspectRatio(DEFAULT_ASPECT_RATIO);
      aspectRatioRef.current = DEFAULT_ASPECT_RATIO;
      setZoomScale(1);
      zoomScaleRef.current = 1;
      setZoomBadgeText('');
      setSeekRipple(null);
    }
  }, [visible, streamUrl]);

  // Auto-hide controls 4 seconds after inactivity
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setShowSpeedPicker(false);
      setShowAspectPicker(false);
      setShowAudioPicker(false);
    }, 4000);
  }, []);

  useEffect(() => {
    if (showControls && isPlaying) {
      scheduleHide();
    } else if (hideTimer.current) clearTimeout(hideTimer.current);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [showControls, isPlaying, scheduleHide]);

  // Broadcast playback presence (watching title) to friends lobby
  useEffect(() => {
    if (!visible || !title) return;

    const currentType = mediaType || (isLive ? 'channel' : 'movie');
    const broadcast = (online, t, mType) => integrations.onPresence?.({
      online,
      title: t || '',
      mediaType: mType || '',
      mediaId: mediaId || null,
    });

    broadcast(true, title, currentType);

    const heartbeat = setInterval(() => {
      broadcast(true, title, currentType);
    }, 45000);

    return () => {
      clearInterval(heartbeat);
      broadcast(true, '', '');
    };
  }, [visible, title, mediaType, isLive, integrations, mediaId]);

  const handleClose = useCallback(async () => {
    setIsAudioOnly(false);
    isAudioOnlyRef.current = false;
    clearAudioOnlyFallbackTimer();
    audioOnlyStreamUrlRef.current = '';
    audioOnlyFallbackRef.current = false;
    setAudioOnlyStreamUrl('');
    setAudioOnlyFallback(false);
    integrations.onPresence?.({ online: false, title: '', mediaType: '', mediaId: mediaId || null });
    setShowLiveChat(false);
    exitFullscreen();
    saveCurrentProgress();
    onCwRefresh?.();
    if (recording?.isActive?.()) {
      try {
        const result = await recording.stop?.();
        if (result?.filename) {
          Alert.alert('Recording saved', result.filename);
        }
      } catch (err) {
        Alert.alert('Recording', err?.message || 'Could not save the recording.');
      }
    }
    onClose();
  }, [clearAudioOnlyFallbackTimer, exitFullscreen, saveCurrentProgress, onCwRefresh, onClose, integrations, mediaId, recording]);

  const handleBackAction = useCallback(() => invokeAction(
    'onBack',
    handleClose,
    { title, streamUrl, mediaId },
  ), [invokeAction, handleClose, title, streamUrl, mediaId]);

  useEffect(() => {
    if (!visible || isWeb()) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackAction();
      return true;
    });
    return () => sub.remove();
  }, [visible, handleBackAction]);

  // Sleep Timer listener - automatically close video playback when timer expires
  useEffect(() => {
    if (!visible) return undefined;
    const unsubscribe = integrations.onSleepTimerExpired?.(handleClose);
    return unsubscribe;
  }, [visible, handleClose, integrations]);

  useEffect(() => recording?.subscribe?.((snap) => {
    setRecStatus(snap.status);
    setRecElapsedMs(snap.elapsedMs);
  }), [recording]);

  useEffect(() => () => {
    if (recNoticeTimer.current) clearTimeout(recNoticeTimer.current);
    if (recording?.isActive?.()) {
      Promise.resolve(recording.stop?.()).catch(() => {});
    }
  }, [streamUrl, visible, recording]);

  const showRecNotice = useCallback((notice) => {
    if (recNoticeTimer.current) clearTimeout(recNoticeTimer.current);
    setRecNotice(notice);
    recNoticeTimer.current = setTimeout(() => setRecNotice(null), 5600);
  }, []);

  const handleStartRecording = useCallback(async (e) => {
    e?.stopPropagation?.();
    if (!isScreenRecorderEnabled || !isLive || recStatusRef.current !== 'idle') return;
    try {
      await recording?.start?.({
        getVideoElement: () => {
          const ref = vlcRef.current;
          if (typeof ref?.getVideoElement === 'function') return ref.getVideoElement();
          return null;
        },
        streamUrl: playbackUrl || streamUrl,
        title,
      });
      if (muted) {
        showRecNotice({
          type: 'info',
          message: 'Recording started. Unmute the player if you want live audio in the file.',
        });
      }
    } catch (err) {
      showRecNotice({ type: 'error', message: err?.message || 'Could not start recording.' });
    }
  }, [isLive, isScreenRecorderEnabled, muted, playbackUrl, showRecNotice, streamUrl, title, recording]);

  const handlePauseRecording = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      await recording?.pause?.();
    } catch (err) {
      showRecNotice({ type: 'error', message: err?.message || 'Could not pause recording.' });
    }
  }, [showRecNotice, recording]);

  const handleResumeRecording = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      await recording?.resume?.();
    } catch (err) {
      showRecNotice({ type: 'error', message: err?.message || 'Could not resume recording.' });
    }
  }, [showRecNotice, recording]);

  const handleStopRecording = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      const result = await recording?.stop?.();
      if (result?.filename) {
        let where;
        if (result.platform === 'web') {
          if (result.saveMethod === 'share') {
            where = `Share sheet opened for ${result.filename}`;
          } else if (result.saveMethod === 'open') {
            where = `Opened ${result.filename}. Use Share to save it on this iPad.`;
          } else {
            where = `Saved as ${result.filename}`;
          }
        } else {
          where = `Saved on this device as ${result.filename}`;
        }
        showRecNotice({ type: 'saved', message: where });
      }
    } catch (err) {
      showRecNotice({ type: 'error', message: err?.message || 'Could not save the recording.' });
    }
  }, [showRecNotice, recording]);

  /**
   * Restart the movie/episode from the beginning (seek to 00:00).
   */
  const handleRestart = useCallback(() => {
    try {
      if (vlcRef.current && typeof vlcRef.current.seek === 'function') {
        vlcRef.current.seek(0);
      }
    } catch (e) {
      // restart seek is best-effort
    }
    isSeeking.current = false;
    setCurrentTime(0);
    setSliderPos(0);
    lastKnownTimeRef.current = 0;
    seekCompletedAt.current = Date.now();
    if (!showControls) setShowControls(true);
  }, [showControls]);

  // Episode finished: auto-advance to the next episode (sequential) or to a
  // random episode (shuffle mode). Last episode in the playlist stops playback.
  const handleEpisodeEnded = useCallback(() => {
    onEnded?.();
    const eps = Array.isArray(playlist) ? playlist : [];
    if (!eps.length) return;
    const curSeason = season !== null && season !== undefined ? Number(season) : null;
    const curEp = episode !== null && episode !== undefined ? Number(episode) : null;
    let next = null;
    if (shuffle) {
      const candidates = eps.filter((p) => !(p.season === curSeason && p.episode === curEp));
      if (candidates.length === 0) return;
      next = pickShuffleCandidate(candidates, curSeason, curEp);
    } else {
      const idx = eps.findIndex((p) => p.season === curSeason && p.episode === curEp);
      next = idx >= 0 ? eps[idx + 1] : null;
      if (!next) return;
    }
    saveCurrentProgress();
    if (typeof onNextEpisode === 'function') onNextEpisode(next);
    badgeService.emit('player.next', { autoplay: true, mediaType: 'series' }).catch(() => {});
  }, [playlist, shuffle, season, episode, saveCurrentProgress, onNextEpisode, onEnded]);

  const toggleControls = useCallback(() => {
    setShowSpeedPicker(false);
    setShowAspectPicker(false);
    setShowAudioPicker(false);
    setShowControls((prev) => {
      if (!prev && isPlaying) scheduleHide();
      return !prev;
    });
  }, [isPlaying, scheduleHide]);

  const triggerSeekRipple = useCallback((side, text) => {
    if (seekRippleTimer.current) clearTimeout(seekRippleTimer.current);
    setSeekRipple({ side, text });
    seekRippleTimer.current = setTimeout(() => {
      setSeekRipple(null);
    }, 300);
  }, []);

  const togglePlayPause = useCallback((nextPlay) => {
    const wasPlaying = isPlayingRef.current;
    const next = typeof nextPlay === 'boolean' ? nextPlay : !wasPlaying;
    if (next && !mutedRef.current) {
      vlcRef.current?.activateAudio?.(volumeRef.current || 100);
    }
    isPlayingRef.current = next;
    if (wasPlaying && !next) {
      badgeService.emit('player.pause', { mediaType }).catch(() => {});
      if (mediaType === 'live' || mediaType === 'channel') {
        badgeService.emit('live.pauseResume', {}).catch(() => {});
      }
      clearBufferingIndicator();
    }
    setIsPlaying(next);
    if (!showControls) setShowControls(true);
  }, [showControls, mediaType, clearBufferingIndicator]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    if (isWeb()) {
      if (next) {
        vlcRef.current?.deactivateAudio?.();
      } else {
        vlcRef.current?.activateAudio?.(volumeRef.current || 100);
      }
    }
    mutedRef.current = next;
    if (next) pendingUnmuteRef.current = false;
    setMuted(next);

    if (!next && volumeRef.current === 0) {
      commitVolume(100, { unmute: false });
    }

    badgeService.emit('player.mute', {}).catch(() => {});
  }, [commitVolume]);

  const toggleLock = useCallback(() => {
    setIsLocked((prev) => {
      const next = !prev;
      setShowControls(true);
      if (isPlaying) {
        scheduleHide();
      }
      return next;
    });
  }, [isPlaying, scheduleHide]);

  const pendingSeekRef = useRef(null);

  const restorePlaybackPosition = useCallback((position, delay = 100) => {
    if (isLive || !visible) return;
    const target = Number(position);
    if (!Number.isFinite(target) || target <= 0) return;

    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    const apply = () => {
      restoreTimerRef.current = null;
      if (!visible || !vlcRef.current) return;
      const dur = Number(lastKnownDurRef.current || 0);
      if (dur <= 0) {
        pendingSeekRef.current = target;
        return;
      }
      const audioOffset = isAudioOnly && !audioOnlyFallback && !isLive
        ? Number(audioModeStartPositionRef.current || 0)
        : 0;
      const playerDuration = Math.max(0, dur - audioOffset);
      const playerTarget = Math.max(0, target - audioOffset);
      const ratio = Math.max(0, Math.min(1, playerTarget / Math.max(playerDuration, 1)));
      try {
        vlcRef.current.seek(ratio);
        lastKnownTimeRef.current = target;
        setCurrentTime(target);
        setSliderPos(target);
        seekCompletedAt.current = Date.now();
      } catch {
        // Player-specific seek APIs are best-effort during native transitions.
      }
    };
    if (delay > 0) {
      restoreTimerRef.current = setTimeout(apply, delay);
    } else {
      apply();
    }
  }, [audioOnlyFallback, isAudioOnly, isLive, visible]);
  restorePositionRef.current = restorePlaybackPosition;

  const handleSeekTo = (secs) => {
    scheduleBufferingIndicator();
    try {
      if (vlcRef.current) {
        const audioOffset = isAudioOnly && !audioOnlyFallback && !isLive
          ? Number(audioModeStartPositionRef.current || 0)
          : 0;
        const playerDuration = Math.max(0, duration - audioOffset);
        const playerTarget = Math.max(0, Number(secs) - audioOffset);
        if (playerDuration > 0) {
          const ratio = Math.max(0, Math.min(1, playerTarget / playerDuration));
          vlcRef.current.seek(ratio);
        } else {
          // Native seek expects a 0-1 ratio; defer until duration is known.
          pendingSeekRef.current = secs;
        }
      }
    } catch (e) {
      // seek is best-effort; ignore player-specific failures
    }
  };

  const handleSeekBy = useCallback((secs) => {
    const dur = lastKnownDurRef.current || duration || 0;
    const cur = lastKnownTimeRef.current || currentTime || 0;
    const target = Math.max(0, Math.min(dur > 0 ? dur : 999999, cur + secs));
    isSeeking.current = false;
    setCurrentTime(target);
    setSliderPos(target);
    lastKnownTimeRef.current = target;
    seekCompletedAt.current = Date.now();
    handleSeekTo(target);
    debouncedSaveProgress();
    if (!showControls) setShowControls(true);
    badgeService.emit('player.seek', {
      deltaSec: secs,
      rewind10: secs === -10,
      forward30: secs === 30,
      doubleTap: Math.abs(secs) === 10,
    }).catch(() => {});
    if ((mediaType === 'live' || mediaType === 'channel') && secs <= -900) {
      badgeService.emit('live.rewind', { rewindSec: Math.abs(secs) }).catch(() => {});
    }
  }, [duration, currentTime, showControls, mediaType, debouncedSaveProgress]);

  const handleProgress = (data) => {
    onProgress?.(data);
    setErrorMessage(null);
    const audioOffsetSeconds = audioOnlyUsesProxy && !isLive
      ? Number(audioModeStartPositionRef.current || 0)
      : 0;
    const progress = normalizeProgressEvent(data, audioOffsetSeconds * 1000);
    applyProgressState(progress, {
      hasStartedPlaybackRef,
      clearAudioOnlyFallbackTimer,
      clearBufferingIndicator,
      setDuration,
      lastKnownDurationRef: lastKnownDurRef,
      pendingSeekRef,
      audioOffsetSeconds,
      playerRef: vlcRef,
      isSeeking,
      seekCompletedAt,
      setCurrentTime,
      lastKnownTimeRef,
      setSliderPosition: setSliderPos,
    });
  };

  const handleNativeOpen = (event) => {
    setErrorMessage(null);

    const payload = event?.nativeEvent || event || {};
    onReady?.(payload);
    applyTrackDefaults(selectedAudioTrack, setSelectedAudioTrack, setAudioTracks, payload.audioTracks);

    // VLC only honors aspect ratio changes once the video output is active;
    // movies start slower than live streams, so re-apply after open/seek.
    // Audio-only playback has no video output to resize; asking VLC to change
    // its aspect ratio while the audio source is opening can interrupt it.
    if (!isAudioOnly) {
      setTimeout(() => handleSelectAspectRatio(aspectRatio), 400);
    }

    const restoredSourcePosition = Number(sourceRestorePositionRef.current || 0);
    if (!isLive && restoredSourcePosition > 5) {
      sourceRestorePositionRef.current = 0;
      setTimeout(() => restorePlaybackPosition(restoredSourcePosition, 0), 250);
      return;
    }


    const targetPos = Number(resumePosition || 0);
    if (!isLive && targetPos > 5 && !hasResumedRef.current) {
      hasResumedRef.current = true;
      setTimeout(() => {
        handleSeekTo(targetPos);
        setTimeout(() => handleSelectAspectRatio(aspectRatio), 600);
      }, 600);
    }
  };

  const handleNativePlaying = (event) => {
    hasStartedPlaybackRef.current = true;
    clearAudioOnlyFallbackTimer();
    clearBufferingIndicator();
    setErrorMessage(null);
    onPlaying?.(event?.nativeEvent || event || {});
    handleNativeOpen(event);
  };

  const handleNativeLoadStart = useCallback(() => {
    hasStartedPlaybackRef.current = false;
    setIsLoading(true);
    setErrorMessage(null);
  }, []);

  const handleNativeBuffering = (event) => {
    const payload = event?.nativeEvent || event || {};
    const rate = payload?.bufferRate ?? payload?.buffering;
    if (typeof payload?.isBuffering === 'boolean') onBuffering?.(payload.isBuffering);
    else if (rate !== undefined && rate !== null) onBuffering?.(rate < 100);
    if (rate !== undefined && rate !== null) {
      if (rate < 100) {
        scheduleBufferingIndicator();
      } else if (hasStartedPlaybackRef.current) {
        clearBufferingIndicator();
      }
    } else if (typeof payload?.isBuffering === 'boolean') {
      if (payload.isBuffering) {
        scheduleBufferingIndicator();
      } else if (hasStartedPlaybackRef.current) {
        clearBufferingIndicator();
      }
    }
  };

  const handleTracksChanged = useCallback((tracks) => {
    if (!tracks.audioTracks || tracks.audioTracks.length === 0) return;
    setAudioTracks(tracks.audioTracks);
    setSelectedAudioTrack((prev) => {
      if (prev !== null && tracks.audioTracks.some((t) => String(t.id) === String(prev))) {
        return prev;
      }
      const active = tracks.audioTracks.find((t) => t.selected || t.enabled || t.active) || tracks.audioTracks[0];
      return active ? active.id : prev;
    });
  }, []);

  const handleAudioSelect = useCallback((id) => {
    setSelectedAudioTrack(id);
    setShowAudioPicker(false);
    if (vlcRef.current && typeof vlcRef.current.setAudioTrack === 'function') {
      vlcRef.current.setAudioTrack(id);
    }
    scheduleBufferingIndicator();
    scheduleHide();
  }, [scheduleBufferingIndicator, scheduleHide]);

  const handleRestartAction = useCallback(() => invokeAction(
    'onRestart', handleRestart, { title, streamUrl, currentTime: lastKnownTimeRef.current },
  ), [invokeAction, handleRestart, title, streamUrl]);
  const handlePlayPauseAction = useCallback((nextPlay) => invokeAction(
    'onPlayPause', () => togglePlayPause(nextPlay), { isPlaying: nextPlay ?? !isPlayingRef.current },
  ), [invokeAction, togglePlayPause]);
  const handleSeekAction = useCallback((seconds) => invokeAction(
    'onSeek', () => {
      const target = Math.max(0, Number(seconds) || 0);
      handleSeekTo(target);
      lastKnownTimeRef.current = target;
      setCurrentTime(target);
      setSliderPos(target);
      seekCompletedAt.current = Date.now();
      debouncedSaveProgress();
    }, { seconds: Number(seconds) || 0, currentTime: lastKnownTimeRef.current },
  ), [invokeAction, handleSeekTo, debouncedSaveProgress]);
  const handleSeekByAction = (deltaSeconds) => invokeAction(
    'onSeek', () => handleSeekBy(deltaSeconds), { deltaSeconds: Number(deltaSeconds) || 0, currentTime: lastKnownTimeRef.current },
  );
  const handleMuteAction = useCallback(() => invokeAction(
    'onMute', toggleMute, { muted: !mutedRef.current },
  ), [invokeAction, toggleMute]);
  const handleLockAction = useCallback(() => invokeAction(
    'onLock', toggleLock, { locked: !isLockedRef.current },
  ), [invokeAction, toggleLock]);
  const handleAudioOnlyAction = useCallback(() => invokeAction(
    'onAudioOnlyChange', toggleAudioOnly, { enabled: !isAudioOnlyRef.current },
  ), [invokeAction, toggleAudioOnly]);
  const handleVideoOnlyAction = useCallback(() => invokeAction(
    'onVideoOnlyChange', () => setVideoOnlyMode((current) => !current), { enabled: !videoOnlyMode },
  ), [invokeAction, videoOnlyMode]);
  const handleAspectRatioAction = useCallback((value) => invokeAction(
    'onAspectRatioChange', () => handleSelectAspectRatio(value), { aspectRatio: value },
  ), [invokeAction, handleSelectAspectRatio]);
  const handleAudioTrackAction = useCallback((trackId) => invokeAction(
    'onAudioTrackChange', () => handleAudioSelect(trackId), { trackId },
  ), [invokeAction, handleAudioSelect]);
  const handleFullscreenAction = useCallback(() => invokeAction(
    'onFullscreen', toggleFullscreen, { isFullscreen: !isFullscreen },
  ), [invokeAction, toggleFullscreen, isFullscreen]);
  const handleRecordingAction = useCallback((name, fallback, event) => {
    event?.stopPropagation?.();
    return invokeAction(name, fallback, { title, streamUrl, mediaId });
  }, [invokeAction, title, streamUrl, mediaId]);
  const handlePanelAction = useCallback((tab) => invokeAction(
    getPanelActionName(tab),
    () => {
      if (showLiveChat && drawerTab === tab) setShowLiveChat(false);
      else { setDrawerTab(tab); setShowLiveChat(true); }
    },
    { tab, isOpen: showLiveChat && drawerTab === tab },
  ), [invokeAction, showLiveChat, drawerTab]);

  useEffect(() => {
    if (!playerApiRef) return undefined;
    const api = {
      play: () => togglePlayPause(true),
      pause: () => togglePlayPause(false),
      togglePlayPause,
      restart: handleRestart,
      setMuted: (next) => setMuted(!!next),
      toggleMute,
      setAspectRatio: handleSelectAspectRatio,
      setAudioTrack: handleAudioSelect,
      setAudioOnly: (next) => setIsAudioOnly(!!next),
      setVideoOnly: (next) => setVideoOnlyMode(!!next),
      seekTo: handleSeekTo,
      seekBy: handleSeekBy,
      setPlaybackRate: (rate) => setPlaybackRate(clampNumber(rate, 0.25, 4, 1)),
      back: handleClose,
      getVideoElement: () => vlcRef.current?.getVideoElement?.() || null,
      getAudioTracks: () => audioTracks,
    };
    Object.assign(playerApiRef.current, api);
    return () => {
      for (const key of Object.keys(api)) delete playerApiRef.current[key];
    };
  }, [playerApiRef, togglePlayPause, handleRestart, toggleMute, handleSelectAspectRatio, handleAudioSelect, handleSeekTo, handleSeekBy, handleClose, audioTracks]);

  const handleSpeedSelect = useCallback((speed) => invokeAction(
    'onPlaybackRateChange', () => {
      const preservedPosition =
        mediaType !== 'live' && mediaType !== 'channel'
          ? Number(lastKnownTimeRef.current || 0)
          : 0;
      setPlaybackRate(speed);
      if (preservedPosition > 0) restorePositionRef.current?.(preservedPosition, 120);
      setShowSpeedPicker(false);
      badgeService.emit('player.rate', { rate: speed, mediaType }).catch(() => {});
    },
    { playbackRate: speed, currentTime: lastKnownTimeRef.current },
  ), [invokeAction, mediaType]);

  const handleWebBuffering = useCallback((isBuffering) => {
    onBuffering?.(!!isBuffering);
    if (isBuffering) {
      scheduleBufferingIndicator();
    } else if (hasStartedPlaybackRef.current) {
      clearBufferingIndicator();
    }
  }, [clearBufferingIndicator, scheduleBufferingIndicator, onBuffering]);

  const handleWebError = useCallback((err) => {
    onError?.(err);
    if (err?.blockPlayback) {
      clearBufferingIndicator();
      setErrorMessage(err?.message || 'Web playback is unavailable for this stream.');
      badgeService.emit('player.error', {}).catch(() => {});
      return;
    }
    if (activateNativeAudioFallback()) {
      return;
    }
    // If video is already playing or progress has started, do not show error modal
    if (lastKnownTimeRef.current > 0) {
      return;
    }
    // Give player 2.5s grace period to allow video-only fallback or auto-reconnect to mount
    setTimeout(() => {
      if (lastKnownTimeRef.current <= 0) {
        clearBufferingIndicator();
        setErrorMessage(err?.message || 'Failed to load stream.');
        badgeService.emit('player.error', {}).catch(() => {});
      }
    }, 2500);
  }, [activateNativeAudioFallback, clearBufferingIndicator, onError]);

  const handlePlaybackRoute = (url = '') => {
    setPlaybackUrl(url);
    onPlaybackRoute?.(url);
  };

  const windowWidthRef = useRef(windowWidth);
  windowWidthRef.current = windowWidth;
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;
  const showControlsRef = useRef(showControls);
  showControlsRef.current = showControls;
  const handleSeekByRef = useRef(handleSeekByAction);
  handleSeekByRef.current = handleSeekByAction;
  const triggerSeekRippleRef = useRef(triggerSeekRipple);
  triggerSeekRippleRef.current = triggerSeekRipple;
  const togglePlayPauseRef = useRef(togglePlayPause);
  togglePlayPauseRef.current = togglePlayPause;
  const toggleControlsRef = useRef(toggleControls);
  toggleControlsRef.current = toggleControls;
  const scheduleHideRef = useRef(scheduleHide);
  scheduleHideRef.current = scheduleHide;

  // PanResponder for Mobile Pinch-to-Zoom & VLC-Style Vertical Swipe Gestures (Brightness / Volume)
  const panResponder = useMemo(() => {
    if (isWeb()) return null;

    const isSeekScrubGesture = (evt) => {
      if (!showControlsRef.current) return false;
      const height = windowHeightRef.current || 0;
      const y = Number(evt?.nativeEvent?.locationY);
      if (height <= 0 || !Number.isFinite(y)) return false;
      // Keep the bottom timeline region available to the native Slider instead
      // of letting the full-screen tap/gesture layer claim horizontal scrubs.
      return y >= height - Math.max(180, height * 0.14);
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => !isSeekScrubGesture(evt),
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (isSeekScrubGesture(evt)) return false;
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches?.length === 2) {
          const [t1, t2] = touches;
          const dx = t1.pageX - t2.pageX;
          const dy = t1.pageY - t2.pageY;
          initialDistanceRef.current = Math.hypot(dx, dy);
          initialScaleRef.current = zoomScaleRef.current;
          isSwipingRef.current = false;
        } else if (touches?.length === 1) {
          initialDistanceRef.current = 0;
          const t = touches[0];
          gestureStartXRef.current = t.pageX;
          gestureStartYRef.current = t.pageY;
          const isLeft = t.pageX < windowWidthRef.current * 0.5;
          const currentVolumeVal = mutedRef.current ? 0 : volumeRef.current;
          gestureSideRef.current = isLeft ? 'brightness' : 'volume';
          gestureStartValRef.current = isLeft ? brightnessRef.current : currentVolumeVal;
          isSwipingRef.current = false;
        } else {
          initialDistanceRef.current = 0;
          isSwipingRef.current = false;
        }
      },
      onPanResponderMove: (evt, _gestureState) => {
        const touches = evt.nativeEvent.touches;
        const zoomState = {
          initialDistance: initialDistanceRef,
          initialScale: initialScaleRef,
          scale: zoomScaleRef,
          setScale: setZoomScale,
          setBadge: setZoomBadgeText,
          badgeTimer: zoomBadgeTimer,
        };
        if (handlePinchMove(touches, zoomState)) return;

        // Brightness/volume swipes remain disabled on native platforms while
        // pinch zoom and tap-to-toggle controls stay enabled.
        handleVerticalGestureMove(touches, {
          isLocked: isLockedRef,
          startY: gestureStartYRef,
          startX: gestureStartXRef,
          isSwiping: isSwipingRef,
          windowHeight: windowHeightRef,
          side: gestureSideRef,
          startValue: gestureStartValRef,
          commitBrightness: commitBrightnessRef,
          commitVolume: commitVolumeRef,
        });
      },
      onPanResponderTerminate: () => {
        initialDistanceRef.current = 0;
        isSwipingRef.current = false;
      },
      onPanResponderRelease: (evt, gestureState) => {
        const touches = evt.nativeEvent?.touches;

        if (initialDistanceRef.current > 0) {
          initialDistanceRef.current = 0;
          return;
        }

        if (touches && touches.length > 0) return;

        if (isSwipingRef.current) {
          isSwipingRef.current = false;
          return; // It was a vertical swipe, don't trigger tap
        }

        if (Math.abs(gestureState.dx) > 15 || Math.abs(gestureState.dy) > 15) {
          return; // It was a pan/drag, not a tap
        }

        const pageX = evt.nativeEvent?.pageX ?? gestureStartXRef.current ?? gestureState.x0 ?? 0;
        const pageY = evt.nativeEvent?.pageY ?? gestureStartYRef.current ?? gestureState.y0 ?? 0;
        handleTap(pageX, pageY);
      },
    });
  }, []);

  const handleTap = useCallback((pageX, pageY) => {
    if (isLockedRef.current) {
      setShowControls((prev) => {
        const next = !prev;
        if (next && isPlaying) {
          scheduleHideRef.current();
        }
        return next;
      });
      return;
    }

    const now = Date.now();
    const prev = lastTapRef.current;
    const dt = now - prev.time;
    const w = windowWidthRef.current || 400;

    let side = 'center';
    if (pageX < w * 0.40) side = 'left';
    else if (pageX > w * 0.60) side = 'right';

    // Must be a legitimate second tap within 50ms to 320ms on the same side
    const isDoubleTap = dt > 50 && dt < 320 && prev.side === side;

    if (isDoubleTap) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastTapRef.current = { time: 0, x: 0, y: 0, side: null };

      if (side === 'left') {
        handleSeekByRef.current(-10);
        triggerSeekRippleRef.current('left', '-10s');
      } else if (side === 'right') {
        handleSeekByRef.current(10);
        triggerSeekRippleRef.current('right', '+10s');
      } else {
        togglePlayPauseRef.current();
      }
    } else {
      lastTapRef.current = { time: now, x: pageX, y: pageY, side };
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        toggleControlsRef.current();
        singleTapTimerRef.current = null;
        lastTapRef.current = { time: 0, x: 0, y: 0, side: null };
      }, 260);
    }
  }, []);

  const handleWebTouchStart = useCallback((e) => {
    const point = getWebPoint(e);
    if (!point) return;
    touchHandledRef.current = true;
    if (isLockedRef.current) {
      webTouchStartRef.current = {
        x: point.x,
        y: point.y,
        side: 'center',
        startVal: 0,
        dragged: false,
      };
      return;
    }
    const isLeft = point.x < windowWidthRef.current * 0.5;
    if (!isLeft && isSafariOrIOS()) {
      webTouchStartRef.current = {
        x: point.x,
        y: point.y,
        side: 'none',
        startVal: 0,
        dragged: false,
      };
      return;
    }
    const currentVolumeVal = mutedRef.current ? 0 : volumeRef.current;
    webTouchStartRef.current = {
      x: point.x,
      y: point.y,
      side: isLeft ? 'brightness' : 'volume',
      startVal: isLeft ? brightnessRef.current : currentVolumeVal,
      dragged: false,
    };
  }, []);

  const handleWebTouchMove = useCallback((e) => {
    if (isLockedRef.current) return;
    const point = getWebPoint(e);
    const state = webTouchStartRef.current;
    if (!point || !state) return;
    const dy = state.y - point.y;
    const dx = Math.abs(point.x - state.x);
    if (!state.dragged && (Math.abs(dy) > 8 || dx > 8)) {
      state.dragged = true;
    }
    if (state.dragged) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      const dragHeight = Math.max(180, (windowHeightRef.current || 400) * 0.55);
      const deltaPercent = (dy / dragHeight) * 100;
      if (state.side === 'brightness') {
        const next = Math.max(0.1, Math.min(1.0, Number(((state.startVal * 100 + deltaPercent) / 100).toFixed(2))));
        commitBrightness(next);
      } else {
        const next = Math.max(0, Math.min(100, Math.round(state.startVal + deltaPercent)));
        commitVolume(next);
      }
    }
  }, [commitBrightness, commitVolume]);

  const handleWebTouchEnd = useCallback(() => {
    const state = webTouchStartRef.current;
    webTouchStartRef.current = null;
    if (state && !state.dragged) {
      handleTap(state.x, state.y);
    }
    setTimeout(() => {
      touchHandledRef.current = false;
    }, 400);
  }, [handleTap]);

  const handleWebPointerDown = useCallback((e) => {
    if (e.button !== null && e.button !== 0) return;
    handleWebTouchStart(e);
  }, [handleWebTouchStart]);

  const handleWebPointerMove = useCallback((e) => {
    if (!webTouchStartRef.current) return;
    handleWebTouchMove(e);
  }, [handleWebTouchMove]);

  const handleWebPointerUp = useCallback((e) => {
    handleWebTouchEnd(e);
  }, [handleWebTouchEnd]);

  const handleWebMouseDown = useCallback((e) => {
    if (touchHandledRef.current) return;
    const point = getWebPoint(e);
    if (!point) return;
    if (isLockedRef.current) {
      const onLockedMouseUp = () => {
        window.removeEventListener('mouseup', onLockedMouseUp);
        handleTap(point.x, point.y);
      };
      window.addEventListener('mouseup', onLockedMouseUp);
      return;
    }
    const startX = point.x;
    const startY = point.y;
    const isLeft = startX < windowWidthRef.current * 0.5;
    if (!isLeft && isSafariOrIOS()) {
      const onMouseUp = () => {
        window.removeEventListener('mouseup', onMouseUp);
        if (touchHandledRef.current) return;
        handleTap(startX, startY);
      };
      window.addEventListener('mouseup', onMouseUp);
      return;
    }
    const side = isLeft ? 'brightness' : 'volume';
    const currentVolumeVal = mutedRef.current ? 0 : volumeRef.current;
    const startVal = isLeft ? brightnessRef.current : currentVolumeVal;
    let hasDragged = false;

    const onMouseMove = (moveEvent) => {
      const dy = startY - moveEvent.clientY;
      const dx = Math.abs(moveEvent.clientX - startX);
      if (!hasDragged && (Math.abs(dy) > 6 || dx > 6)) {
        hasDragged = true;
      }
      if (hasDragged) {
        const dragHeight = Math.max(180, (windowHeightRef.current || 400) * 0.55);
        const deltaPercent = (dy / dragHeight) * 100;
        if (side === 'brightness') {
          const next = Math.max(0.1, Math.min(1.0, Number(((startVal * 100 + deltaPercent) / 100).toFixed(2))));
          commitBrightness(next);
        } else {
          const next = Math.max(0, Math.min(100, Math.round(startVal + deltaPercent)));
          commitVolume(next);
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (touchHandledRef.current) return;
      if (!hasDragged) {
        handleTap(startX, startY);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [handleTap, commitBrightness, commitVolume]);

  // Web keyboard listeners for seeking and playback, and trackpad pinch-to-zoom / scroll gestures
  useEffect(() => {
    if (!isWeb() || !visible) return;

    const handleKeyDown = (e) => {
      // Don't interfere with form inputs if there are any
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (isLockedRef.current) return;

      if (e.key === 'ArrowRight') {
        handleSeekByRef.current(10);
        triggerSeekRippleRef.current('right', '+10s');
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        handleSeekByRef.current(-10);
        triggerSeekRippleRef.current('left', '-10s');
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        commitVolume(volumeRef.current + 5);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        commitVolume(volumeRef.current - 5);
        e.preventDefault();
      } else if (e.key === ' ') {
        togglePlayPauseRef.current();
        e.preventDefault();
      }
    };

    const handleWheel = (e) => {
      if (isInlinePreview) {
        if (typeof onInlinePreviewWheel === 'function') {
          e.preventDefault();
          onInlinePreviewWheel(e.deltaY);
        }
        return;
      }

      if (e.ctrlKey) {
        e.preventDefault(); // Prevent browser scaling
        const delta = e.deltaY;
        setZoomScale((prev) => {
          let newScale = prev - delta * 0.01;
          newScale = Math.max(0.25, Math.min(4, newScale));
          zoomScaleRef.current = newScale;

          setZoomBadgeText(`${Math.round(newScale * 100)}% Zoom`);
          if (zoomBadgeTimer.current) clearTimeout(zoomBadgeTimer.current);
          zoomBadgeTimer.current = setTimeout(() => {
            setZoomBadgeText('');
          }, 1500);

          return newScale;
        });
        return;
      }

      if (isLockedRef.current) return;
      const cursorX = e.clientX;
      const isLeft = cursorX < windowWidthRef.current * 0.5;
      const delta = -e.deltaY;
      const step = delta > 0 ? 5 : -5;

      if (isLeft) {
        commitBrightness(brightnessRef.current + (step / 100));
      } else {
        commitVolume(volumeRef.current + step);
      }
    };

    if (isWeb() && typeof document !== 'undefined') {
      document.addEventListener('keydown', handleKeyDown);
    }

    const node = playerRef.current;
    node?.addEventListener?.('wheel', handleWheel, { passive: false });

    return () => {
      if (isWeb() && typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleKeyDown);
      }
      node?.removeEventListener?.('wheel', handleWheel);
    };
  }, [visible, commitBrightness, commitVolume, isInlinePreview, onInlinePreviewWheel]);

  const rawPlayerStream = audioOnlyUsesProxy ? audioOnlyStreamUrl : streamUrl;
  const playerStreamUrl = rawPlayerStream || '';

  const nativeMediaOptions = useMemo(() => [
    `--user-agent=${USER_AGENT}`,
    `:http-user-agent=${USER_AGENT}`,
    ':network-caching=3000',
    ':live-caching=3000',
    ':drop-late-frames',
    ':skip-frames',
    // react-native-vlc-media-player currently omits the last mediaOptions entry.
    // Keep duplicate as sentinel so VLC receives all settings.
    ':live-caching=3000',
  ], []);

  const nativeSource = useMemo(() => ({
    uri: playerStreamUrl,
    initType: 1,
    hwDecoderEnabled: 1,
    hwDecoderForced: 1,
    // Keep this source object stable while Android audio mode is toggled so
    // VLC does not release and reopen the active stream.
    mediaOptions: nativeMediaOptions,
  }), [playerStreamUrl, nativeMediaOptions]);

  // Android DownloadManager / local storage can expose downloads as
  // content:// or file:// URIs. Media3/Expo (ExoPlayer) can consume both provider URIs
  // and local filesystem URIs directly with full hardware acceleration;
  // this VLC build's native local-string path cannot, so route local media to ExoVideoFallback.
  const useExoForAndroidLocalMedia = isAndroid()
    && isLocalMediaUri(playerStreamUrl);

  if (!visible || !streamUrl) return null;

  const exoFallback = (
    <ExoVideoFallback
      key={`exo-${playerStreamUrl}`}
      ref={vlcRef}
      streamUrl={playerStreamUrl}
      paused={!isPlaying}
      muted={muted || videoOnlyMode}
      volume={muted || videoOnlyMode ? 0 : volume}
      playbackRate={playbackRate}
      videoAspectRatio={aspectRatio}
      audioTrack={selectedAudioTrack}
      onTracksChanged={handleTracksChanged}
      onProgress={handleProgress}
      onPlaying={handleNativePlaying}
      onBuffering={handleWebBuffering}
      audioOnly={isAudioOnly}
      onEnded={handleEpisodeEnded}
      onError={handleWebError}
    />
  );

  const videoPlayer = (
    <PlatformMediaSurface
      youtubeVideoId={youtubeVideoId}
      playerStreamUrl={playerStreamUrl}
      vlcRef={vlcRef}
      isPlaying={isPlaying}
      muted={muted}
      videoOnlyMode={videoOnlyMode}
      volume={volume}
      playbackRate={playbackRate}
      aspectRatio={aspectRatio}
      title={title}
      posterUrl={posterUrl}
      isLive={isLive}
      isAudioOnly={isAudioOnly}
      selectedAudioTrack={selectedAudioTrack}
      handleTracksChanged={handleTracksChanged}
      handleProgress={handleProgress}
      handleNativePlaying={handleNativePlaying}
      handleWebBuffering={handleWebBuffering}
      handleEpisodeEnded={handleEpisodeEnded}
      handleWebError={handleWebError}
      togglePlayPause={togglePlayPause}
      handleSeekByAction={handleSeekByAction}
      handlePlaybackRoute={handlePlaybackRoute}
      exoFallback={exoFallback}
      useExoForAndroidLocalMedia={useExoForAndroidLocalMedia}
      nativeSource={nativeSource}
      computedAspectRatio={computedAspectRatio}
      handleNativeLoadStart={handleNativeLoadStart}
      handleNativeOpen={handleNativeOpen}
      clearBufferingIndicator={clearBufferingIndicator}
      handleClose={handleClose}
      handleNativeBuffering={handleNativeBuffering}
      isPlayingRef={isPlayingRef}
      setIsPlaying={setIsPlaying}
    />
  );
  const isValidPreviewRect = isUsableInlinePreviewRect(inlinePreviewRect);
  const inlinePreviewPositionStyle = getInlinePreviewPositionStyle(inlinePreviewRect, isValidPreviewRect);

  if (isInlinePreview) {
    const liveChatDrawer = showLiveChat ? (
      <LiveChatDrawer
        videoId={mediaId || title || 'live'}
        userId={currentUser.id}
        username={currentUser.username}
        visible={showLiveChat}
        onClose={() => setShowLiveChat(false)}
        isLandscape={windowWidth >= windowHeight}
        initialTab="chat"
        streamUrl={playbackUrl || streamUrl || ''}
        serverUrl={playbackUrl || streamUrl || ''}
        isLive={isLive}
        isLiveCommentsEnabled={isLiveCommentsEnabled}
        isEpgEnabled={isEpgEnabled}
        diagnosticsEnabled={diagnosticsOverlayEnabled}
        title={title}
        streamId={mediaId}
        popupMode
        integrations={integrations}
        colors={colors}
      />
    ) : null;
    return (
      <InlinePreviewFrame
        hostRef={handlePlayerHostRef}
        isValidPreviewRect={isValidPreviewRect}
        positionStyle={inlinePreviewPositionStyle}
        videoPlayer={videoPlayer}
        title={title}
        onPromotePreview={onPromotePreview}
        controls={controls}
        colors={colors}
        muted={muted}
        videoOnlyMode={videoOnlyMode}
        handleMuteAction={handleMuteAction}
        isPlaying={isPlaying}
        handlePlayPauseAction={handlePlayPauseAction}
        showInlineChatButton={showInlineChatButton}
        showLiveChat={showLiveChat}
        handlePanelAction={handlePanelAction}
        isFullscreen={isFullscreen}
        handleFullscreenAction={handleFullscreenAction}
        invokeAction={invokeAction}
        mediaId={mediaId}
        isLoading={isLoading}
        errorMessage={errorMessage}
      >
        {liveChatDrawer}
      </InlinePreviewFrame>
    );
  }

  const fullscreenControlsProps = {
    insets,
    scale,
    title,
    episodeLabel,
    isLive,
    isScreenRecorderEnabled,
    recStatus,
    isLoading,
    showLiveChat,
    drawerTab,
    isLiveCommentsEnabled,
    isEpgEnabled,
    diagnosticsOverlayEnabled,
    muted,
    controls,
    onClose: handleBackAction,
    handleRecordingAction,
    handleStartRecording,
    handleResumeRecording,
    handlePauseRecording,
    handleStopRecording,
    handlePanelAction,
    handleRestartAction,
    handleMuteAction,
    handleLockAction,
    isAudioOnly,
    isPlaying,
    handleSeekByAction,
    handlePlayPauseAction,
    isSeeking,
    sliderPos,
    currentTime,
    duration,
    isAudioOnlyFeatureEnabled,
    videoOnlyMode,
    showAspectPicker,
    aspectRatio,
    showSpeedPicker,
    playbackRate,
    showAudioPicker,
    audioTracks,
    selectedAudioTrack,
    isFullscreen,
    onSliderValueChange: (value) => {
      isSeeking.current = true;
      setSliderPos(value);
    },
    onSliderSlidingStart: () => { isSeeking.current = true; },
    onSliderSlidingComplete: (value) => {
      isSeeking.current = false;
      handleSeekAction(value);
    },
    onToggleAudioOnly: () => {
      setShowAspectPicker(false);
      setShowSpeedPicker(false);
      setShowAudioPicker(false);
      handleAudioOnlyAction();
    },
    onToggleAspectPicker: () => {
      setShowSpeedPicker(false);
      setShowAudioPicker(false);
      setShowAspectPicker((previous) => !previous);
    },
    onSelectAspectRatio: (value) => {
      handleAspectRatioAction(value);
      setShowAspectPicker(false);
      scheduleHide();
    },
    onToggleSpeedPicker: () => {
      setShowAspectPicker(false);
      setShowAudioPicker(false);
      setShowSpeedPicker((previous) => !previous);
    },
    handleSpeedSelect,
    onToggleAudioPicker: () => {
      setShowAspectPicker(false);
      setShowSpeedPicker(false);
      setShowAudioPicker((previous) => !previous);
    },
    handleAudioTrackAction,
    handleFullscreenAction,
    handleVideoOnlyAction,
  };

  const fullscreenContent = (
    <View
      ref={handlePlayerHostRef}
      collapsable={false}
        style={[styles.fullscreenPlayerContainer, style]}
    >
      <StatusBar hidden={!showControls} translucent backgroundColor="transparent" barStyle="light-content" />

      <FullscreenVideoLayer videoPlayer={videoPlayer} zoomScale={zoomScale} isAudioOnly={isAudioOnly} />
      <FullscreenVisualFeedback
        isAudioOnly={isAudioOnly}
        isWebPlatform={isWeb()}
        brightness={brightness}
        zoomBadgeText={zoomBadgeText}
        seekRipple={seekRipple}
      />
      <FullscreenGestureLayer
        isAudioOnly={isAudioOnly}
        panResponder={panResponder}
        handlers={{
          onPointerDown: handleWebPointerDown,
          onPointerMove: handleWebPointerMove,
          onPointerUp: handleWebPointerUp,
          onMouseDown: handleWebMouseDown,
          onTouchStart: handleWebTouchStart,
          onTouchMove: handleWebTouchMove,
          onTouchEnd: handleWebTouchEnd,
        }}
      />

      {/* Controls Layer */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 60, elevation: 60 }]} pointerEvents="box-none">
        <FullscreenControlsLayer showControls={showControls} isLocked={isLocked} isAudioOnly={isAudioOnly}>
          <FullscreenControlsPanel {...fullscreenControlsProps} />
        </FullscreenControlsLayer>
      </View>

      <FullscreenStatusLayer
        isAudioOnly={isAudioOnly}
        audioOnlyProps={{ posterUrl, title, episodeLabel, isPlaying, windowWidth, windowHeight, usesAudioProxy: audioOnlyUsesProxy, onToggleAudioOnly: toggleAudioOnly }}
        isLoading={isLoading}
        errorMessage={errorMessage}
        scale={scale}
        handleClose={handleClose}
      />
      <FullscreenChatLayer
        visible={showLiveChat}
        isAudioOnly={isAudioOnly}
        mediaId={mediaId}
        title={title}
        currentUser={currentUser}
        onClose={() => setShowLiveChat(false)}
        isLandscape={windowWidth >= windowHeight}
        drawerTab={drawerTab}
        playbackUrl={playbackUrl}
        streamUrl={streamUrl}
        isLive={isLive}
        isLiveCommentsEnabled={isLiveCommentsEnabled}
        isEpgEnabled={isEpgEnabled}
        diagnosticsEnabled={diagnosticsOverlayEnabled}
        integrations={integrations}
        colors={colors}
      />
      <FullscreenRecordingLayer
        isAudioOnly={isAudioOnly}
        isLive={isLive}
        isScreenRecorderEnabled={isScreenRecorderEnabled}
        recStatus={recStatus}
        recElapsedMs={recElapsedMs}
        colors={colors}
        insets={insets}
        handlePauseRecording={handlePauseRecording}
        handleResumeRecording={handleResumeRecording}
        handleStopRecording={handleStopRecording}
        recNotice={recNotice}
        onDismissNotice={() => setRecNotice(null)}
      />
      <FullscreenSessionLayer
        locked={isLocked}
        controlsVisible={showControls}
        isAudioOnly={isAudioOnly}
        insets={insets}
        scale={scale}
        onToggleLock={toggleLock}
      />
    </View>
  );

  if (!isWeb()) {
    return (
      <Modal
        visible={visible}
        animationType="none"
        transparent={false}
        statusBarTranslucent={true}
        hardwareAccelerated={true}
        onRequestClose={handleBackAction}
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      >
        {fullscreenContent}
      </Modal>
    );
  }

  return (
    <View
      ref={handlePlayerHostRef}
      collapsable={false}
      style={[
        styles.playerHost,
        styles.playerHostFullscreen,
        styles.playerHostWeb,
        style,
      ]}
    >
      {fullscreenContent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 99999,
    elevation: 99999,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  playerHostFullscreen: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    zIndex: 99999,
    elevation: 99999,
  },
  fullscreenPlayerContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  inlineVideoStage: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 14,
    position: 'relative',
  },
  playerHostInline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: null,
    bottom: null,
    backgroundColor: '#000',
    borderRadius: 14,
    overflow: 'hidden',
    zIndex: 120,
    elevation: 0,
  },
  playerHostWeb: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 100000,
    overflow: 'hidden',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlinePreviewChrome: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    padding: 10,
    zIndex: 6,
  },
  inlinePreviewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: 4,
  },
  inlinePreviewCenterControls: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  inlinePreviewCenterButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
    backgroundColor: 'rgba(12, 18, 28, 0.76)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.82)',
  },
  inlineLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(183, 40, 47, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
  },
  inlineLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  inlineLiveText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inlinePreviewIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(12, 18, 28, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inlinePreviewBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 4,
  },
  inlinePreviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlinePreviewTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inlineChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(12, 18, 28, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
  },
  inlineChatButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inlinePreviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  inlinePreviewLoadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: 'rgba(4, 10, 18, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  inlinePreviewLoadingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  inlinePreviewError: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 8,
  },
  inlinePreviewErrorText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  videoWrapFullscreen: {
    width: '100%',
    height: '100%',
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  controlsShell: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 65,
    elevation: 65,
  },
  brightnessDimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    zIndex: 15,
    elevation: 15,
  },
  zoomBadge: {
    position: 'absolute',
    top: 30,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 9999,
  },
  zoomBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  seekRippleOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9998,
  },
  seekRippleLeft: {
    left: 0,
    borderTopRightRadius: 200,
    borderBottomRightRadius: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  seekRippleRight: {
    right: 0,
    borderTopLeftRadius: 200,
    borderBottomLeftRadius: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  seekRippleCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
  },
  seekRippleText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 4,
  },
  gestureCatcher: {
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    zIndex: 50,
    elevation: 50,
    ...(isWeb()
      ? {
          touchAction: 'none',
          userSelect: 'none',
        }
      : {}),
  },
  loadingLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 999,
    elevation: 999,
  },
  loadingText: {
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    gap: 12,
    zIndex: 100,
  },
  errorTitle: {
    color: '#FFF',
  },
  errorMsg: {
    color: '#CCC',
    textAlign: 'center',
  },
  errorBtn: {
    marginTop: 8,
    backgroundColor: '#E53935',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  errorBtnText: {
    color: '#FFF',
  },
  floatingLockBtn: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderColor: '#FF5252',
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 400,
    elevation: 400,
  },
  floatingLockText: {
    color: '#FFF',
  },
});
