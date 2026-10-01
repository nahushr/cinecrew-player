import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  Text,
  View,
} from 'react-native';
import VLCPlayer from '../../packages/react-native-vlc-media-player/VLCPlayer.js';
import { PlayerCustomizationProvider, PlayerIcon } from './customization';
import { WebVideoPlayer } from './media/WebVideoPlayer';
import { ElectronVideoPlayer } from './media/ElectronVideoPlayer';
import { isAndroid, isElectron, isIOS, isWeb } from '../utils/runtimePlatform';
import { USER_AGENT } from './media/player/playerConstants';
import { invokePlayerAction } from '../utils/invokePlayerAction.js';
import { getPlayerErrorMessage } from '../utils/playerError.js';
import { VerticalBrightnessControl } from './media/player/VerticalBrightnessControl';
import { VerticalVolumeControl } from './media/player/VerticalVolumeControl';
import { parsePlaybackStartTime } from '../utils/playbackTime.js';

function getArtwork(channel) {
  return channel?.logoUrl || channel?.logo || channel?.stream_icon || channel?.posterUrl || channel?.image || '';
}

function getProgressPosition(event) {
  const payload = event?.nativeEvent || event || {};
  const currentTime = Number(payload.currentTime);
  const duration = Number(payload.duration);
  const position = Number(payload.position);
  return {
    currentTime: Number.isFinite(currentTime) ? Math.max(0, currentTime / 1000) : null,
    duration: Number.isFinite(duration) ? Math.max(0, duration / 1000) : 0,
    position: Number.isFinite(position) ? Math.max(0, Math.min(1, position)) : null,
  };
}

function createInlinePlatformPlayer({
  shouldRenderVideo,
  streamUrl,
  source,
  muted,
  paused,
  volume,
  title,
  startTime,
  vlcSource,
  onPlaying,
  onError,
  onProgress,
  playerRef,
}) {
  if (!shouldRenderVideo || !streamUrl) return null;

  const commonProps = {
    streamUrl,
    isLive: true,
    paused,
    muted,
    volume: 100,
    startTime,
    onPlaying,
    onError,
    onProgress,
  };
  if (isElectron()) return React.createElement(ElectronVideoPlayer, { ...commonProps, ref: playerRef });
  if (isWeb()) return React.createElement(WebVideoPlayer, { ...commonProps, ref: playerRef, title });
  if (!isAndroid() && !isIOS()) return null;

  return React.createElement(VLCPlayer, {
    key: streamUrl,
    ref: playerRef,
    style: styles.video,
    source: vlcSource || source,
    autoplay: true,
    paused,
    muted: false,
    volume: muted ? 0 : 100,
    autoAspectRatio: true,
    videoAspectRatio: 'FIT_SCREEN',
    onPlaying,
    onVLCPlaying: onPlaying,
    onOpen: onPlaying,
    onProgress,
    onError,
    onVLCError: onError,
  });
}

function InlineControlButton({
  controlName,
  actionName,
  label,
  icon,
  fallback,
  payload,
  active,
  controls,
  actions,
  palette,
}) {
  if (controls[controlName] === false) return null;
  return React.createElement(Pressable, {
    key: controlName,
    accessibilityRole: 'button',
    accessibilityLabel: label,
    onPress: () => {
      const callback = actions?.[actionName];
      invokePlayerAction(fallback, callback, payload, { player: null });
    },
    style: [styles.button, { backgroundColor: palette.controlBackground }, active && { borderColor: palette.accentColor, borderWidth: 1 }],
  }, React.createElement(PlayerIcon, { name: icon, size: 19, color: palette.controlColor }));
}

function InlinePlayerOverlay({
  showControls,
  controls,
  palette,
  title,
  muted,
  paused,
  source,
  fullscreen,
  showLiveBadge = false,
  onToggleControls,
  onMute,
  onPlay,
  onFullscreen,
}) {
  const button = (controlName, actionName, label, icon, fallback, payload, active = false) => React.createElement(InlineControlButton, {
    key: controlName,
    controlName,
    actionName,
    label,
    icon,
    fallback,
    payload,
    active,
    controls,
    actions: controls.actions || {},
    palette,
  });
  const muteLabel = muted ? 'Unmute' : 'Mute';
  const muteIcon = muted ? 'mute' : 'unmute';
  const playbackLabel = paused ? 'Play' : 'Pause';
  const playbackIcon = paused ? 'play' : 'pause';

  return React.createElement(View, { pointerEvents: 'box-none', style: StyleSheet.absoluteFill },
    React.createElement(Pressable, {
      style: StyleSheet.absoluteFill,
      onPress: onToggleControls,
      accessibilityLabel: showControls ? 'Hide video controls' : 'Show video controls',
    }),
    showControls ? React.createElement(React.Fragment, null,
      React.createElement(View, { pointerEvents: 'box-none', style: styles.topRow },
      showLiveBadge ? React.createElement(View, { style: styles.liveBadge }, React.createElement(View, { style: styles.liveDot }), React.createElement(Text, { style: styles.liveText }, 'LIVE')) : null,
      React.createElement(View, { style: { flex: 1 } }),
      button('mute', 'onMute', muteLabel, muteIcon, onMute, { muted: !muted }),
      ),
      React.createElement(View, { pointerEvents: 'box-none', style: styles.center },
      button('playPause', 'onPlayPause', playbackLabel, playbackIcon, onPlay, { isPlaying: !paused })),
      React.createElement(View, { pointerEvents: 'box-none', style: styles.bottomRow },
      React.createElement(Text, { numberOfLines: 1, style: [styles.title, { color: palette.controlColor }] }, title),
      button('fullscreen', 'onFullscreen', 'Open full player', 'fullscreen', onFullscreen, { source, title, isFullscreen: !fullscreen }))) : null);
}

function createInlinePlayerLayer(player, visible) {
  if (!visible || !player) return null;
  return React.createElement(View, { pointerEvents: 'none', style: StyleSheet.absoluteFill }, player);
}

function createInlineArtworkLayer(shouldRenderVideo, artwork, accentColor) {
  if (shouldRenderVideo) return null;
  if (artwork) {
    return React.createElement(Image, { source: { uri: artwork }, resizeMode: 'contain', style: styles.poster });
  }
  return React.createElement(View, { style: styles.emptyPoster },
    React.createElement(PlayerIcon, { name: 'television-play', size: 48, color: accentColor }));
}

function createInlineStatusLayer(loading, error, palette) {
  if (error) {
    return React.createElement(View, { pointerEvents: 'none', style: styles.error },
      React.createElement(Text, { style: [styles.errorText, { color: palette.controlColor }] }, error));
  }
  if (!loading) return null;
  return React.createElement(View, { pointerEvents: 'none', style: styles.loading },
    React.createElement(ActivityIndicator, { size: 'large', color: palette.accentColor }));
}

function InlineLivePlayerSurface({
  height,
  style,
  palette,
  fullscreen,
  setFullscreen,
  player,
  shouldRenderVideo,
  artwork,
  loading,
  error,
  brightness,
  brightnessAccentColor,
  showBrightnessControl,
  onBrightnessChange,
  onBrightnessChangeEnd,
  volume,
  volumeAccentColor,
  showVolumeControl,
  onVolumeChange,
  onVolumeChangeEnd,
  renderOverlay,
}) {
  const [inlineFrameHeight, setInlineFrameHeight] = useState(0);
  const [fullscreenFrameHeight, setFullscreenFrameHeight] = useState(0);
  const [fullscreenFrameWidth, setFullscreenFrameWidth] = useState(0);
  const handleInlineFrameLayout = React.useCallback((event) => {
    const nextHeight = event?.nativeEvent?.layout?.height || 0;
    setInlineFrameHeight((current) => Math.abs(current - nextHeight) > 1 ? nextHeight : current);
  }, []);
  const handleFullscreenFrameLayout = React.useCallback((event) => {
    const { width: nextWidth = 0, height: nextHeight = 0 } = event?.nativeEvent?.layout || {};
    setFullscreenFrameHeight((current) => Math.abs(current - nextHeight) > 1 ? nextHeight : current);
    setFullscreenFrameWidth((current) => Math.abs(current - nextWidth) > 1 ? nextWidth : current);
  }, []);
  const fullscreenLandscape = fullscreen && fullscreenFrameWidth > fullscreenFrameHeight;
  const brightnessOverlay = (visible) => visible && brightness < 1
    ? React.createElement(View, {
      pointerEvents: 'none',
      style: [StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: 1 - brightness, zIndex: 2 }],
    })
    : null;
  const brightnessControl = (visible) => visible && showBrightnessControl
    && ((fullscreen && fullscreenFrameHeight > 0) || (!fullscreen && inlineFrameHeight > 0))
    ? React.createElement(VerticalBrightnessControl, {
      value: brightness,
      onChange: onBrightnessChange,
      onChangeEnd: onBrightnessChangeEnd,
      accentColor: brightnessAccentColor || palette.accentColor,
      compact: true,
      fullscreenLandscape,
      availableHeight: fullscreen ? fullscreenFrameHeight : inlineFrameHeight,
      topInset: fullscreen ? 54 : 32,
      bottomInset: fullscreen ? 54 : 32,
    })
    : null;
  const volumeControl = (visible) => visible && showVolumeControl
    && ((fullscreen && fullscreenFrameHeight > 0) || (!fullscreen && inlineFrameHeight > 0))
    ? React.createElement(VerticalVolumeControl, {
      value: volume,
      onChange: onVolumeChange,
      onChangeEnd: onVolumeChangeEnd,
      accentColor: volumeAccentColor || '#FFE066',
      compact: true,
      fullscreenLandscape,
      availableHeight: fullscreen ? fullscreenFrameHeight : inlineFrameHeight,
      topInset: fullscreen ? 54 : 32,
      bottomInset: fullscreen ? 54 : 32,
    })
    : null;

  return React.createElement(View, { style: [styles.frame, { height, backgroundColor: palette.surfaceColor }, style], onLayout: handleInlineFrameLayout },
    createInlinePlayerLayer(player, !fullscreen),
    brightnessOverlay(!fullscreen && shouldRenderVideo),
    createInlineArtworkLayer(shouldRenderVideo, artwork, palette.accentColor),
    createInlineStatusLayer(shouldRenderVideo && loading, error, palette),
    fullscreen ? null : renderOverlay(),
    fullscreen ? null : brightnessControl(showControls && shouldRenderVideo),
    fullscreen ? null : volumeControl(showControls && shouldRenderVideo),
    React.createElement(Modal, {
      visible: fullscreen,
      animationType: 'none',
      statusBarTranslucent: true,
      onRequestClose: () => setFullscreen(false),
    }, React.createElement(View, { style: styles.fullscreenFrame, onLayout: handleFullscreenFrameLayout },
      createInlinePlayerLayer(player, true),
      brightnessOverlay(shouldRenderVideo),
      createInlineStatusLayer(loading, error, palette),
      renderOverlay(),
      brightnessControl(showControls && shouldRenderVideo),
      volumeControl(showControls && shouldRenderVideo))));
}

function InlineLivePlayerView({
  source,
  url,
  title = 'Live TV',
  height = 220,
  paused: externalPaused,
  isActive = true,
  onActivate,
  posterChannel,
  poster,
  controls = {},
  actions = {},
  theme = {},
  style,
  icons,
  initialMuted = true,
  startTime,
  showBrightnessControl = false,
  brightnessColor,
  onBrightnessChangeEnd,
  showVolumeControl = false,
  showSoundControl = false,
  volumeColor,
  soundColor,
  onVolumeChangeEnd,
  onSoundChangeEnd,
  initialVolume = 100,
  showLiveBadge = false,
  showLivePill = false,
  showLiveButton = false,
  onError,
  onPlaying,
}) {
  const sourceValue = source ?? url ?? '';
  const sourceObject = typeof sourceValue === 'string' ? { uri: sourceValue } : sourceValue || {};
  const rawUrl = sourceObject.uri || sourceObject.url || '';
  const streamUrl = useMemo(() => rawUrl || '', [rawUrl]);
  const requestedStartTime = parsePlaybackStartTime(startTime);
  const playerRef = useRef(null);
  const playbackPositionRef = useRef(requestedStartTime ?? 0);
  const playbackDurationRef = useRef(0);
  const pendingSeekRef = useRef(requestedStartTime);
  const pendingSeekAttemptAtRef = useRef(0);
  const [internallyPaused, setInternallyPaused] = useState(Boolean(externalPaused));
  const [muted, setMuted] = useState(Boolean(initialMuted));
  const [volume, setVolume] = useState(typeof initialVolume === 'number' ? initialVolume : 100);
  const [loading, setLoading] = useState(Boolean(streamUrl && isActive));
  const [error, setError] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [brightness, setBrightness] = useState(1);
  const shouldRenderVideo = isActive && !externalPaused;
  const pausedNow = Boolean(externalPaused) || internallyPaused;
  const artwork = poster || getArtwork(posterChannel);
  const palette = {
    accentColor: '#00D4FF',
    controlBackground: 'rgba(5, 11, 20, 0.76)',
    controlColor: '#FFFFFF',
    surfaceColor: '#07111E',
    errorColor: '#FF647C',
    ...theme,
  };

  const applyPendingSeek = useCallback((observedPosition = null) => {
    const target = pendingSeekRef.current;
    const duration = playbackDurationRef.current;
    if (target === null || target === undefined || duration <= 0) return false;
    const playerInstance = playerRef.current;
    if (typeof playerInstance?.seek !== 'function') return false;
    if (observedPosition !== null && Math.abs(observedPosition - target) <= 1) {
      pendingSeekRef.current = null;
      pendingSeekAttemptAtRef.current = 0;
      return true;
    }
    const now = Date.now();
    if (now - pendingSeekAttemptAtRef.current < 400) return false;
    try {
      playerInstance.seek(Math.max(0, Math.min(1, target / duration)));
      pendingSeekAttemptAtRef.current = now;
      playbackPositionRef.current = target;
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleProgress = useCallback((event) => {
    const progress = getProgressPosition(event);
    if (progress.duration > 0) playbackDurationRef.current = progress.duration;
    const current = progress.currentTime !== null
      ? progress.currentTime
      : (progress.position !== null && playbackDurationRef.current > 0
        ? progress.position * playbackDurationRef.current
        : null);
    if (current !== null) playbackPositionRef.current = current;
    applyPendingSeek(current);
  }, [applyPendingSeek]);

  const changeFullscreenWithPosition = useCallback((nextFullscreen) => {
    // The native preview is re-parented into a Modal. Preserve the latest
    // progress event and restore it after the new native view mounts.
    pendingSeekRef.current = playbackPositionRef.current;
    pendingSeekAttemptAtRef.current = 0;
    // Do not try the seek against the old surface's duration; wait for a
    // progress event from the newly mounted surface to report its duration.
    playbackDurationRef.current = 0;
    setFullscreen(nextFullscreen);
  }, []);

  useEffect(() => {
    playbackPositionRef.current = requestedStartTime ?? 0;
    playbackDurationRef.current = 0;
    pendingSeekRef.current = requestedStartTime;
    pendingSeekAttemptAtRef.current = 0;
  }, [streamUrl, requestedStartTime]);

  useEffect(() => {
    setInternallyPaused(Boolean(externalPaused));
  }, [externalPaused]);

  useEffect(() => {
    setInternallyPaused(false);
    setMuted(Boolean(initialMuted));
    setLoading(Boolean(streamUrl && isActive));
    setError('');
    setShowControls(true);
  }, [streamUrl, initialMuted]);

  useEffect(() => setBrightness(1), [streamUrl]);

  useEffect(() => {
    if (streamUrl && isActive && !pausedNow) setLoading(true);
    else setLoading(false);
  }, [streamUrl, isActive, pausedNow]);

  const handleError = useCallback((detail) => {
    const message = typeof detail === 'string' ? detail : detail?.message || 'Could not play this channel.';
    setError(message);
    setLoading(false);
    if (detail instanceof Error) {
      onError?.(detail);
      return;
    }
    const actualMessage = getPlayerErrorMessage(detail);
    onError?.({
      ...detail,
      message,
      ...(actualMessage ? { actualMessage } : {}),
    });
  }, [onError]);

  const handlePlaying = useCallback((event) => {
    setLoading(false);
    setError('');
    onPlaying?.(event);
  }, [onPlaying]);

  const performAction = (name, fallback, payload) => {
    return invokePlayerAction(fallback, actions?.[name], payload, { player: null });
  };

  const togglePlay = (event) => {
    event?.stopPropagation?.();
    if (!shouldRenderVideo) {
      performAction('onPlayPause', () => {
        onActivate?.();
        setInternallyPaused(false);
      }, true);
      return;
    }
    performAction('onPlayPause', () => setInternallyPaused((value) => !value), !pausedNow);
  };

  const toggleMute = (event) => {
    event?.stopPropagation?.();
    performAction('onMute', () => setMuted((value) => !value), !muted);
  };

  const openFullscreen = (event) => {
    event?.stopPropagation?.();
    performAction('onFullscreen', () => changeFullscreenWithPosition(!fullscreen), {
      isFullscreen: !fullscreen,
      source: sourceObject,
      title,
    });
  };

  const nativeMediaOptions = useMemo(() => [
    `--user-agent=${USER_AGENT}`,
    `--http-user-agent=${USER_AGENT}`,
    ':http-user-agent=' + USER_AGENT,
    '--network-caching=3000',
    ':network-caching=3000',
    '--drop-late-frames',
    ':drop-late-frames',
    '--skip-frames',
    ':skip-frames',
    '--network-caching=3000',
  ], []);
  const vlcSource = useMemo(() => ({
    ...sourceObject,
    uri: streamUrl,
    initType: sourceObject.initType || 1,
    hwDecoderEnabled: sourceObject.hwDecoderEnabled ?? 1,
    hwDecoderForced: sourceObject.hwDecoderForced ?? 1,
    mediaOptions: sourceObject.mediaOptions || nativeMediaOptions,
  }), [sourceObject, streamUrl, nativeMediaOptions]);

  const player = createInlinePlatformPlayer({
    shouldRenderVideo,
    streamUrl,
    source: sourceObject,
    muted,
    volume: muted ? 0 : volume,
    paused: pausedNow,
    title,
    vlcSource,
    startTime: requestedStartTime,
    onPlaying: handlePlaying,
    onProgress: handleProgress,
    onError: handleError,
    playerRef,
  });
  const displayLiveBadge = Boolean(
    showLiveBadge || showLivePill || showLiveButton || controls?.liveBadge || controls?.livePill || controls?.liveButton
  );
  const renderOverlay = () => React.createElement(InlinePlayerOverlay, {
    showControls,
    controls: { ...controls, actions },
    palette,
    title,
    muted,
    paused: pausedNow,
    source: streamUrl,
    fullscreen,
    showLiveBadge: displayLiveBadge,
    onToggleControls: () => setShowControls((value) => !value),
    onMute: toggleMute,
    onPlay: togglePlay,
    onFullscreen: openFullscreen,
  });

  return React.createElement(
    PlayerCustomizationProvider,
    { icons, theme },
    React.createElement(InlineLivePlayerSurface, {
      height,
      style,
      palette,
      fullscreen,
      setFullscreen: changeFullscreenWithPosition,
      player,
      shouldRenderVideo,
      artwork,
      loading,
      error,
      brightness,
      brightnessAccentColor: brightnessColor || palette.accentColor,
      showBrightnessControl: showBrightnessControl && showControls && shouldRenderVideo,
      onBrightnessChange: setBrightness,
      onBrightnessChangeEnd,
      volume,
      volumeAccentColor: volumeColor || soundColor || '#FFE066',
      showVolumeControl: (showVolumeControl || showSoundControl) && showControls && shouldRenderVideo,
      onVolumeChange: (val) => {
        setVolume(val);
        if (muted && val > 0) setMuted(false);
      },
      onVolumeChangeEnd: onVolumeChangeEnd || onSoundChangeEnd,
      renderOverlay,
    }),
  );
}

export const InlineLivePlayer = React.memo(InlineLivePlayerView);

const styles = StyleSheet.create({
  frame: { width: '100%', minHeight: 80, overflow: 'hidden', borderRadius: 14, position: 'relative', justifyContent: 'center' },
  fullscreenFrame: { flex: 1, overflow: 'hidden', position: 'relative', justifyContent: 'center', backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  poster: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  emptyPoster: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  error: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 3 },
  errorText: { textAlign: 'center', fontSize: 13 },
  topRow: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 4 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, backgroundColor: '#C62828' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  liveText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { flex: 1, fontWeight: '700', fontSize: 14, textShadowColor: 'rgba(0,0,0,.8)', textShadowRadius: 5 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  bottomRow: { position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 4 },
  button: { minWidth: 38, height: 38, paddingHorizontal: 10, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
