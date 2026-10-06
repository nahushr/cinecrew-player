import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import VLCPlayer from '../../packages/react-native-vlc-media-player/VLCPlayer.js';
import { PlayerCustomizationProvider, PlayerIcon } from './customization';
import { WebVideoPlayer } from './media/WebVideoPlayer';
import { ElectronVideoPlayer } from './media/ElectronVideoPlayer';
import { isAndroid, isElectron, isElectronOverlay, isIOS, isWeb } from '../utils/runtimePlatform';
import { USER_AGENT } from './media/player/playerConstants';
import { getPanelActionName } from './media/player/playerUtils';
import { invokePlayerAction } from '../utils/invokePlayerAction.js';
import { getPlayerErrorMessage } from '../utils/playerError.js';
import { VerticalBrightnessControl } from './media/player/VerticalBrightnessControl';
import { VerticalVolumeControl } from './media/player/VerticalVolumeControl';
import { parsePlaybackStartTime } from '../utils/playbackTime.js';
import { createFullscreenPlaybackState } from '../utils/fullscreenPlaybackState.js';
import { formatProgressBarTime } from '../utils/progressBarTime.js';
import { LiveChatDrawer } from './media/LiveChatDrawer';
import { setAndroidImmersiveNavigationBar } from './media/player/androidSystemUi';

let nextInlineSurfaceId = 0;

function getArtwork(channel) {
  return channel?.logoUrl || channel?.logo || channel?.stream_icon || channel?.posterUrl || channel?.image || '';
}

function getProgressPosition(event) {
  const payload = event?.nativeEvent || event || {};
  const currentTime = Number(payload.currentTime);
  const duration = Number(payload.duration);
  const position = Number(payload.position);
  const positionTime = Number.isFinite(position) && Number.isFinite(duration) && duration > 0
    ? Math.max(0, position * duration / 1000)
    : null;
  let normalizedCurrentTime = null;
  if (Number.isFinite(currentTime) && currentTime > 0) {
    normalizedCurrentTime = currentTime / 1000;
  } else if (positionTime !== null) {
    normalizedCurrentTime = positionTime;
  } else if (Number.isFinite(currentTime)) {
    normalizedCurrentTime = 0;
  }
  return {
    currentTime: normalizedCurrentTime,
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
  fullscreen,
  isFullscreen,
  getContainerBounds,
  getContainerElement,
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
  if (isElectron()) return React.createElement(ElectronVideoPlayer, {
    ...commonProps,
    fullscreen: fullscreen ?? isFullscreen,
    isFullscreen: isFullscreen ?? fullscreen,
    getContainerBounds,
    getContainerElement,
    ref: playerRef,
  });
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
  iconSize = 19,
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
  }, React.createElement(PlayerIcon, { name: icon, size: iconSize, color: palette.controlColor }));
}

function InlinePanelButton({
  panel,
  actionName,
  label,
  icon,
  visible,
  active,
  palette,
  actions,
  onToggle,
  iconSize,
}) {
  if (!visible) return null;
  return React.createElement(Pressable, {
    accessibilityRole: 'button',
    accessibilityLabel: label,
    accessibilityState: { selected: Boolean(active) },
    onPress: (event) => {
      event?.stopPropagation?.();
      const isOpen = !active;
      invokePlayerAction(
        () => onToggle(panel, isOpen),
        actions?.[actionName],
        { tab: panel, isOpen },
        { player: null },
      );
    },
    style: [styles.button, { backgroundColor: palette.controlBackground }, active && { borderColor: palette.accentColor, borderWidth: 1 }],
  }, React.createElement(PlayerIcon, { name: icon, size: iconSize, color: active ? palette.accentColor : palette.controlColor }));
}

function createInlineControlButton({ controls, palette, iconSize, ...buttonProps }) {
  return React.createElement(InlineControlButton, {
    ...buttonProps,
    controls,
    actions: controls.actions || {},
    palette,
    iconSize,
  });
}

function InlinePlayerTopRow({
  controls, palette, iconSize, fullscreenLandscape, showLiveBadge, fullscreen,
  isLiveCommentsEnabled, isEpgEnabled, diagnosticsEnabled, drawerVisible,
  drawerTab, onTogglePanel, muted, onMute,
}) {
  const muteLabel = muted ? 'Unmute' : 'Mute';
  const muteIcon = muted ? 'mute' : 'unmute';
  const panelProps = { palette, actions: controls.actions, onToggle: onTogglePanel, iconSize };
  return React.createElement(View, { pointerEvents: 'box-none', style: styles.topRow },
    showLiveBadge && React.createElement(View, { style: styles.liveBadge },
      React.createElement(View, { style: styles.liveDot }),
      React.createElement(Text, { style: [styles.liveText, fullscreenLandscape && { fontSize: 11 }] }, 'LIVE')),
    React.createElement(View, { style: { flex: 1 } }),
    React.createElement(InlinePanelButton, {
      ...panelProps,
      panel: 'chat', actionName: 'onLiveChatOpen', label: 'Live chat', icon: 'comment-text-multiple-outline',
      visible: fullscreen && isLiveCommentsEnabled && controls.liveChat !== false,
      active: drawerVisible && drawerTab === 'chat',
    }),
    React.createElement(InlinePanelButton, {
      ...panelProps,
      panel: 'epg', actionName: 'onEpgOpen', label: 'Programme guide', icon: 'television-classic',
      visible: fullscreen && isEpgEnabled && controls.epg !== false,
      active: drawerVisible && drawerTab === 'epg',
    }),
    React.createElement(InlinePanelButton, {
      ...panelProps,
      panel: 'diagnostics', actionName: 'onDiagnosticsOpen', label: 'Stream diagnostics', icon: 'pulse',
      visible: fullscreen && diagnosticsEnabled && controls.diagnostics !== false,
      active: drawerVisible && drawerTab === 'diagnostics',
    }),
    createInlineControlButton({
      controlName: 'mute', actionName: 'onMute', label: muteLabel, icon: muteIcon,
      fallback: onMute, payload: { muted: !muted }, controls, palette, iconSize,
    }));
}

function InlinePlayerCenterControls({
  controls, palette, iconSize, fullscreenLandscape, paused, onPlay,
  seekButtonsVisible, onSeekBy,
}) {
  const playbackLabel = paused ? 'Play' : 'Pause';
  const playbackIcon = paused ? 'play' : 'pause';
  const seekButton = (deltaSeconds, label, icon) => React.createElement(Pressable, {
    key: `seek-${deltaSeconds}`,
    accessibilityRole: 'button',
    accessibilityLabel: label,
    onPress: (event) => {
      event?.stopPropagation?.();
      onSeekBy?.(deltaSeconds);
    },
    style: [styles.seekButton, fullscreenLandscape && styles.fullscreenSeekButton],
  }, React.createElement(PlayerIcon, { name: icon, size: iconSize, color: palette.controlColor }));
  return React.createElement(View, { pointerEvents: 'box-none', style: styles.center },
    React.createElement(View, { pointerEvents: 'box-none', style: styles.centerControlsRow },
      seekButtonsVisible && seekButton(-10, 'Rewind 10 seconds', 'rewind-10'),
      createInlineControlButton({
        controlName: 'playPause', actionName: 'onPlayPause', label: playbackLabel, icon: playbackIcon,
        fallback: onPlay, payload: { isPlaying: !paused }, controls, palette, iconSize,
      }),
      seekButtonsVisible && seekButton(10, 'Forward 10 seconds', 'fast-forward-10')));
}

function InlinePlayerBottomRow({
  controls, palette, iconSize, fullscreen, fullscreenLandscape, title, source, onFullscreen,
}) {
  const fullscreenLabel = fullscreen ? 'Exit full player' : 'Open full player';
  const fullscreenIcon = fullscreen ? 'fullscreen-exit' : 'fullscreen';
  return React.createElement(View, { pointerEvents: 'box-none', style: styles.bottomRow },
    React.createElement(Text, {
      numberOfLines: 1,
      style: [styles.title, { color: palette.controlColor }, fullscreenLandscape && { fontSize: 15 }],
    }, title),
    createInlineControlButton({
      controlName: 'fullscreen', actionName: 'onFullscreen', label: fullscreenLabel,
      icon: fullscreenIcon, fallback: onFullscreen,
      payload: { source, title, isFullscreen: !fullscreen }, controls, palette, iconSize,
    }));
}

function InlinePlayerOverlay({
  showControls, controls, palette, title, muted, paused, source, fullscreen,
  showLiveBadge = false, onToggleControls, onMute, onPlay, onFullscreen,
  fullscreenLandscape = false, seekControl, seekButtonsVisible = false, onSeekBy,
  drawerVisible = false, drawerTab = 'chat', isLiveCommentsEnabled = false,
  isEpgEnabled = false, diagnosticsEnabled = false, onTogglePanel,
}) {
  const iconSize = fullscreenLandscape ? 21 : 19;
  return React.createElement(View, { pointerEvents: 'box-none', style: StyleSheet.absoluteFill },
    React.createElement(Pressable, {
      style: StyleSheet.absoluteFill,
      onPress: onToggleControls,
      accessibilityLabel: showControls ? 'Hide video controls' : 'Show video controls',
    }),
    showControls && React.createElement(React.Fragment, null,
      React.createElement(InlinePlayerTopRow, {
        controls, palette, iconSize, fullscreenLandscape, showLiveBadge, fullscreen,
        isLiveCommentsEnabled, isEpgEnabled, diagnosticsEnabled, drawerVisible,
        drawerTab, onTogglePanel, muted, onMute,
      }),
      React.createElement(InlinePlayerCenterControls, {
        controls, palette, iconSize, fullscreenLandscape, paused, onPlay,
        seekButtonsVisible, onSeekBy,
      }),
      fullscreen && seekControl,
      React.createElement(InlinePlayerBottomRow, {
        controls, palette, iconSize, fullscreen, fullscreenLandscape, title, source, onFullscreen,
      })));
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

function getInlineSurfaceLayout({
  width,
  height,
  requestedHeight,
  fullscreen,
  fullscreenFrameHeight,
  drawerVisible,
  drawerMode,
}) {
  const fullscreenLandscape = fullscreen && width > height;
  const portraitResize = drawerVisible && drawerMode === 'resize' && height >= width;
  const inlinePortraitResize = portraitResize && !fullscreen;
  const landscapeResize = drawerVisible && drawerMode === 'resize' && width > height;
  const inlineVideoHeight = Math.max(80, Number(requestedHeight) || 220);
  const fullscreenPortraitVideoHeight = Math.min(Math.round(height * 0.42), Math.round(width * (9 / 16)));
  const inlineResizeDrawerHeight = Math.min(380, Math.max(280, Math.round(height * 0.42)));
  const drawerPortraitVideoHeight = fullscreen
    ? fullscreenPortraitVideoHeight
    : inlineVideoHeight;
  const fullscreenControlHeight = fullscreenLandscape
    ? fullscreenFrameHeight
    : fullscreenPortraitVideoHeight;
  const inlineFrameTotalHeight = inlineVideoHeight + (portraitResize ? inlineResizeDrawerHeight : 0);
  return {
    fullscreenLandscape,
    portraitResize,
    inlinePortraitResize,
    landscapeResize,
    inlineVideoHeight,
    fullscreenPortraitVideoHeight,
    inlineResizeDrawerHeight,
    drawerPortraitVideoHeight,
    fullscreenControlHeight,
    inlineFrameTotalHeight,
  };
}

function getInlineVideoStageStyle(isFullscreen, layout, windowHeight, windowWidth, drawerVisible, drawerMode) {
  if (!drawerVisible || drawerMode !== 'resize') return StyleSheet.absoluteFillObject;
  if (isFullscreen && windowHeight >= windowWidth) {
    return { position: 'absolute', top: 0, left: 0, right: 0, height: layout.fullscreenPortraitVideoHeight };
  }
  if (layout.landscapeResize) {
    return { position: 'absolute', top: 0, left: 0, bottom: 0, width: '70%', height: '100%' };
  }
  if (layout.portraitResize && !isFullscreen) {
    return { position: 'relative', width: '100%', height: layout.inlineVideoHeight };
  }
  return StyleSheet.absoluteFillObject;
}

function createInlineDrawer({ fullscreen, inlinePortraitResize, drawerVisible, renderDrawer }) {
  if (fullscreen || !drawerVisible) return null;
  if (inlinePortraitResize) return renderDrawer(false, true);
  return React.createElement(
    View,
    { pointerEvents: 'box-none', style: StyleSheet.absoluteFill },
    renderDrawer(false),
  );
}

function InlineLivePlayerSurface({
  height,
  title,
  streamUrl,
  style,
  palette,
  fullscreen,
  setFullscreen,
  player,
  shouldRenderVideo,
  showControls,
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
  drawerVisible,
  drawerTab,
  onCloseDrawer,
  drawerMode,
  isLiveCommentsEnabled,
  isEpgEnabled,
  diagnosticsEnabled,
  integrations,
  messagePageSize,
  mediaId,
  drawerStyle,
  currentUser,
  users,
  playerSurfaceBoundsRef,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const transparentElectronOverlay = isElectronOverlay();
  const [fullscreenFrameHeight, setFullscreenFrameHeight] = useState(0);
  const handleFullscreenFrameLayout = React.useCallback((event) => {
    const { height: nextHeight = 0 } = event?.nativeEvent?.layout || {};
    setFullscreenFrameHeight((current) => Math.abs(current - nextHeight) > 1 ? nextHeight : current);
  }, []);
  // Use the window orientation immediately. Waiting for the modal's first
  // layout causes one frame of portrait sizing after entering landscape.
  const layout = getInlineSurfaceLayout({
    width: windowWidth,
    height: windowHeight,
    requestedHeight: height,
    fullscreen,
    fullscreenFrameHeight,
    drawerVisible,
    drawerMode,
  });
  const { fullscreenLandscape } = layout;
  useEffect(() => {
    const immersiveLandscape = fullscreen && windowWidth > windowHeight;
    setAndroidImmersiveNavigationBar(immersiveLandscape);
    return () => setAndroidImmersiveNavigationBar(false);
  }, [fullscreen, windowWidth, windowHeight]);

  const {
    inlinePortraitResize,
    inlineResizeDrawerHeight,
    drawerPortraitVideoHeight,
    fullscreenControlHeight,
    inlineFrameTotalHeight,
  } = layout;
  const brightnessOverlay = (visible) => visible && brightness < 1
    ? React.createElement(View, {
      pointerEvents: 'none',
      style: [StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: 1 - brightness, zIndex: 2 }],
    })
    : null;
  const brightnessControl = (visible) => {
    if (!visible || !showBrightnessControl || !fullscreen || fullscreenFrameHeight <= 0) return null;
    return React.createElement(VerticalBrightnessControl, {
      value: brightness,
      onChange: onBrightnessChange,
      onChangeEnd: onBrightnessChangeEnd,
      accentColor: brightnessAccentColor || palette.accentColor,
      compact: true,
      fullscreenLandscape,
      availableHeight: fullscreenControlHeight,
      topInset: 54,
      bottomInset: 54,
    });
  };
  const volumeControl = (visible) => {
    if (!visible || !showVolumeControl || !fullscreen || fullscreenFrameHeight <= 0) return null;
    return React.createElement(VerticalVolumeControl, {
      value: volume,
      onChange: onVolumeChange,
      onChangeEnd: onVolumeChangeEnd,
      accentColor: volumeAccentColor || '#FFE066',
      compact: true,
      fullscreenLandscape,
      availableHeight: fullscreenControlHeight,
      topInset: 54,
      bottomInset: 54,
    });
  };

  const renderPlayerStage = (isFullscreen) => {
    const isCurrentStage = isFullscreen === Boolean(fullscreen);
    return React.createElement(View, {
      ref: (node) => {
        if (playerSurfaceBoundsRef?.current) {
          playerSurfaceBoundsRef.current[isFullscreen ? 'fullscreen' : 'inline'] = node;
        }
      },
      id: playerSurfaceBoundsRef?.current?.ids?.[isFullscreen ? 'fullscreen' : 'inline'],
      nativeID: playerSurfaceBoundsRef?.current?.ids?.[isFullscreen ? 'fullscreen' : 'inline'],
      style: [
        getInlineVideoStageStyle(isFullscreen, layout, windowHeight, windowWidth, drawerVisible, drawerMode),
        { backgroundColor: transparentElectronOverlay ? 'transparent' : palette.surfaceColor },
      ],
      onLayout: (event) => {
        if (isFullscreen) handleFullscreenFrameLayout(event);
        if (isElectron()) playerRef.current?.syncLayout?.();
      },
    },
      createInlinePlayerLayer(player, isCurrentStage),
      brightnessOverlay(isCurrentStage),
      createInlineArtworkLayer(shouldRenderVideo, artwork, palette.accentColor),
      createInlineStatusLayer(shouldRenderVideo && loading, error, palette),
      renderOverlay(isFullscreen ? fullscreenLandscape : false),
      brightnessControl(showControls && shouldRenderVideo && isCurrentStage),
      volumeControl(showControls && shouldRenderVideo && isCurrentStage),
    );
  };

  const renderDrawer = (isFullscreen, inlineFlow = false) => {
    if (!drawerVisible) return null;
    return React.createElement(LiveChatDrawer, {
      videoId: mediaId || title || 'live',
      userId: currentUser?.id || '0',
      username: currentUser?.username || 'Viewer',
      visible: drawerVisible,
      onClose: onCloseDrawer,
      drawerMode,
      initialTab: drawerTab,
      streamUrl,
      serverUrl: streamUrl,
      isLive: true,
      isLiveCommentsEnabled,
      isEpgEnabled,
      diagnosticsEnabled,
      title,
      streamId: mediaId,
      integrations,
      users: users || integrations?.users,
      messagePageSize,
      drawerStyle,
      fullscreen: isFullscreen,
      inlinePortraitResize: inlineFlow,
      portraitDrawerHeight: inlineFlow ? inlineResizeDrawerHeight : undefined,
      portraitVideoHeight: drawerMode === 'resize' ? drawerPortraitVideoHeight : undefined,
    });
  };

  const inlineDrawer = createInlineDrawer({ fullscreen, inlinePortraitResize, drawerVisible, renderDrawer });

  return React.createElement(View, {
    style: [
      styles.frame,
      inlinePortraitResize && { flexDirection: 'column', justifyContent: 'flex-start' },
      {
        height: fullscreen ? '100%' : inlineFrameTotalHeight,
        backgroundColor: transparentElectronOverlay ? 'transparent' : palette.surfaceColor,
      },
      style,
    ],
  },
      !fullscreen && renderPlayerStage(false),
      // Keep the inline portrait resize drawer in normal layout flow below
      // the video so its message list owns a bounded, independently scrollable
      // viewport instead of competing through overlapping absolute layers.
      inlineDrawer,
    React.createElement(Modal, {
      visible: fullscreen,
      supportedOrientations: ['portrait', 'landscape', 'landscape-left', 'landscape-right'],
      animationType: 'none',
      statusBarTranslucent: true,
      onRequestClose: () => changeFullscreenWithPosition(false),
    }, fullscreen && React.createElement(View, {
      style: [styles.fullscreenFrame, transparentElectronOverlay && { backgroundColor: 'transparent' }],
    },
      renderPlayerStage(true),
      renderDrawer(true))));
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
  features = {},
  integrations = {},
  users,
  drawerMode = 'overlay',
  messagePageSize = 50,
  mediaId,
  drawerStyle,
  showLiveChat: propShowLiveChat,
  initialShowLiveChat = false,
  onLiveChatChange,
  onPromotePreview,
  onError,
  onPlaying,
  onProgressBarChange,
}) {
  const sourceValue = source ?? url ?? '';
  const sourceObject = typeof sourceValue === 'string' ? { uri: sourceValue } : sourceValue || {};
  const rawUrl = sourceObject.uri || sourceObject.url || '';
  const streamUrl = useMemo(() => rawUrl || '', [rawUrl]);
  const requestedStartTime = parsePlaybackStartTime(startTime);
  const [fullscreen, setFullscreen] = useState(false);
  const playerRef = useRef(null);
  const playerSurfaceBoundsRef = useRef({ inline: null, fullscreen: null, ids: null });
  if (!playerSurfaceBoundsRef.current.ids) {
    nextInlineSurfaceId += 1;
    const surfaceId = `cinecrew-inline-surface-${nextInlineSurfaceId}`;
    playerSurfaceBoundsRef.current.ids = {
      inline: `${surfaceId}-inline`,
      fullscreen: `${surfaceId}-fullscreen`,
    };
  }
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;
  const getPlayerSurfaceElement = useCallback(
    () => {
      const surface = fullscreenRef.current ? 'fullscreen' : 'inline';
      const surfaceId = playerSurfaceBoundsRef.current.ids[surface];
      const domElement = typeof document !== 'undefined' ? document.getElementById(surfaceId) : null;
      return domElement || playerSurfaceBoundsRef.current[surface];
    },
    [],
  );
  const getPlayerSurfaceBounds = useCallback(() => {
    const rect = getPlayerSurfaceElement()?.getBoundingClientRect?.();
    if (!rect || rect.width < 64 || rect.height < 64) return null;
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }, [getPlayerSurfaceElement]);
  const playbackPositionRef = useRef(requestedStartTime ?? 0);
  const playbackPositionSourceRef = useRef(streamUrl);
  const playbackDurationRef = useRef(0);
  const pendingSeekRef = useRef(requestedStartTime);
  const pendingSeekAttemptAtRef = useRef(0);
  const [internallyPaused, setInternallyPaused] = useState(Boolean(externalPaused));
  const [muted, setMuted] = useState(Boolean(initialMuted));
  const [volume, setVolume] = useState(typeof initialVolume === 'number' ? initialVolume : 100);
  const [loading, setLoading] = useState(Boolean(streamUrl && isActive));
  const [error, setError] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [brightness, setBrightness] = useState(1);
  const [internalShowLiveChat, setInternalShowLiveChat] = useState(Boolean(initialShowLiveChat));
  const [drawerTab, setDrawerTab] = useState('chat');
  const [playbackTime, setPlaybackTime] = useState(requestedStartTime ?? 0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const isUserSeekingRef = useRef(false);
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
  const showLiveChat = propShowLiveChat !== undefined ? Boolean(propShowLiveChat) : internalShowLiveChat;
  const isLiveCommentsEnabled = controls.liveChat ?? Boolean(
    typeof integrations.liveChat?.loadMessages === 'function'
      && typeof integrations.liveChat?.sendMessage === 'function',
  );
  const isEpgEnabled = controls.epg ?? Boolean(typeof integrations.epg?.loadListings === 'function');
  const diagnosticsEnabled = features.diagnostics === true || controls.diagnostics === true;

  const handlePanelToggle = useCallback((panel, isOpen) => {
    setDrawerTab(panel);
    setInternalShowLiveChat(isOpen);
    onLiveChatChange?.(isOpen);
  }, [onLiveChatChange]);

  const handlePanelClose = useCallback(() => {
    invokePlayerAction(
      () => {
        setInternalShowLiveChat(false);
        onLiveChatChange?.(false);
      },
      actions?.[getPanelActionName(drawerTab)],
      { tab: drawerTab, isOpen: false },
      { player: null },
    );
  }, [actions, drawerTab, onLiveChatChange]);

  const applyPendingSeek = useCallback((observedPosition = null) => {
    const target = pendingSeekRef.current;
    const duration = playbackDurationRef.current;
    if (target === null || target === undefined) return false;
    const playerInstance = playerRef.current;
    if (observedPosition !== null && Math.abs(observedPosition - target) <= 1) {
      pendingSeekRef.current = null;
      pendingSeekAttemptAtRef.current = 0;
      return true;
    }
    const canSeekToTime = typeof playerInstance?.seekTo === 'function';
    if (!canSeekToTime && (duration <= 0 || typeof playerInstance?.seek !== 'function')) return false;
    const now = Date.now();
    if (now - pendingSeekAttemptAtRef.current < 400) return false;
    try {
      if (canSeekToTime) playerInstance.seekTo(target);
      else playerInstance.seek(Math.max(0, Math.min(1, target / duration)));
      pendingSeekAttemptAtRef.current = now;
      playbackPositionRef.current = target;
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleProgress = useCallback((event) => {
    const progress = getProgressPosition(event);
    if (progress.duration > 0) {
      playbackDurationRef.current = progress.duration;
      setPlaybackDuration(progress.duration);
    }
    let current = progress.currentTime;
    if (current === null && progress.position !== null && playbackDurationRef.current > 0) {
      current = progress.position * playbackDurationRef.current;
    }
    if (current !== null) {
      applyPendingSeek(current);
      // Progress from before a seek can arrive after the slider is released.
      // Keep the requested position until VLC acknowledges it, including when
      // the user immediately promotes this preview into the main player.
      if (pendingSeekRef.current === null || pendingSeekRef.current === undefined) {
        playbackPositionRef.current = current;
        if (!isUserSeekingRef.current) setPlaybackTime(current);
        onProgressBarChange?.(formatProgressBarTime(current));
      }
    }
  }, [applyPendingSeek, onProgressBarChange]);

  const handleSeekBy = (deltaSeconds) => {
    const duration = playbackDurationRef.current;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const currentTime = playbackPositionRef.current;
    const target = Math.max(0, Math.min(duration, currentTime + deltaSeconds));
    performAction('onSeek', () => {
      playbackPositionRef.current = target;
      pendingSeekRef.current = target;
      pendingSeekAttemptAtRef.current = 0;
      setPlaybackTime(target);
      applyPendingSeek();
    }, { deltaSeconds, currentTime });
  };

  const changeFullscreenWithPosition = useCallback((nextFullscreen) => {
    const isFs = Boolean(nextFullscreen);
    fullscreenRef.current = isFs;
    // The native preview is re-parented into a Modal. Preserve the latest
    // progress event and restore it after the new native view mounts.
    pendingSeekRef.current = playbackPositionRef.current;
    pendingSeekAttemptAtRef.current = 0;
    // Do not try the seek against the old surface's duration; wait for a
    // progress event from the newly mounted surface to report its duration.
    playbackDurationRef.current = 0;
    setFullscreen(isFs);
    if (isElectron()) {
      playerRef.current?.syncLayout?.();
      [30, 80, 160, 320, 500].forEach((delay) => {
        setTimeout(() => {
          playerRef.current?.syncLayout?.();
        }, delay);
      });
    }
  }, []);

  useEffect(() => {
    if (!isElectron() || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const className = 'cinecrew-electron-player-fullscreen';
    root.classList.toggle(className, fullscreen);
    return () => root.classList.remove(className);
  }, [fullscreen]);

  useEffect(() => {
    fullscreenRef.current = fullscreen;
    if (isElectron()) {
      playerRef.current?.syncLayout?.();
      const timers = [40, 120, 250, 450].map((delay) =>
        setTimeout(() => playerRef.current?.syncLayout?.(), delay)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [fullscreen]);

  const prevRequestedStartTimeRef = useRef(requestedStartTime);
  useEffect(() => {
    const urlChanged = playbackPositionSourceRef.current !== streamUrl;
    const startTimeChanged = requestedStartTime !== null && requestedStartTime !== prevRequestedStartTimeRef.current;
    prevRequestedStartTimeRef.current = requestedStartTime;

    if (urlChanged || startTimeChanged) {
      const targetTime = requestedStartTime ?? 0;
      playbackPositionRef.current = targetTime;
      playbackPositionSourceRef.current = streamUrl;
      setPlaybackTime(targetTime);
      setPlaybackDuration(0);
      playbackDurationRef.current = 0;
      pendingSeekRef.current = requestedStartTime;
      pendingSeekAttemptAtRef.current = 0;
    }
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
    const currentPos = pendingSeekRef.current ?? playbackPositionRef.current;
    const payload = {
      ...createFullscreenPlaybackState(!fullscreen, currentPos),
      source: sourceObject,
      title,
    };
    performAction('onFullscreen', () => {
      if (!fullscreen && typeof onPromotePreview === 'function') {
        return onPromotePreview(payload);
      }
      return changeFullscreenWithPosition(!fullscreen);
    }, payload);
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
  const vlcSource = useMemo(() => {
    const initialPosition = playbackPositionSourceRef.current === streamUrl
      ? pendingSeekRef.current ?? playbackPositionRef.current
      : requestedStartTime;
    const mediaOptions = sourceObject.mediaOptions || nativeMediaOptions;
    return {
      ...sourceObject,
      uri: streamUrl,
      startTime: initialPosition ?? 0,
      initType: sourceObject.initType || 1,
      hwDecoderEnabled: sourceObject.hwDecoderEnabled ?? 1,
      hwDecoderForced: sourceObject.hwDecoderForced ?? 1,
      mediaOptions: initialPosition > 0
        ? [...mediaOptions.filter((option) => !/^:?(?:--)?start-time=/.test(option)), `:start-time=${initialPosition}`]
        : mediaOptions,
    };
  }, [sourceObject, streamUrl, nativeMediaOptions, requestedStartTime, fullscreen]);

  const player = createInlinePlatformPlayer({
    shouldRenderVideo,
    streamUrl,
    source: sourceObject,
    muted,
    volume: muted ? 0 : volume,
    paused: pausedNow,
    title,
    vlcSource,
    startTime: vlcSource.startTime ?? requestedStartTime,
    fullscreen,
    isFullscreen: fullscreen,
    getContainerBounds: getPlayerSurfaceBounds,
    getContainerElement: getPlayerSurfaceElement,
    onPlaying: handlePlaying,
    onProgress: handleProgress,
    onError: handleError,
    playerRef,
  });
  const displayLiveBadge = Boolean(
    showLiveBadge || showLivePill || showLiveButton || controls?.liveBadge || controls?.livePill || controls?.liveButton
  );
  const seekControl = controls.seek !== false && shouldRenderVideo && playbackDuration > 0
    ? React.createElement(View, { style: styles.seekRow },
      React.createElement(Text, { style: styles.seekTime }, formatProgressBarTime(playbackTime)),
      React.createElement(Slider, {
        testID: 'cinecrew-inline-seek-slider',
        accessibilityLabel: 'Seek video',
        style: styles.seekSlider,
        minimumValue: 0,
        maximumValue: playbackDuration,
        value: Math.min(playbackTime, playbackDuration),
        minimumTrackTintColor: palette.accentColor,
        maximumTrackTintColor: 'rgba(255,255,255,0.38)',
        thumbTintColor: palette.accentColor,
        onSlidingStart: () => {
          isUserSeekingRef.current = true;
        },
        onValueChange: (value) => setPlaybackTime(value),
        onSlidingComplete: (value) => {
          const nextTime = Math.max(0, Math.min(playbackDuration, Number(value) || 0));
          isUserSeekingRef.current = false;
          playbackPositionRef.current = nextTime;
          pendingSeekRef.current = nextTime;
          pendingSeekAttemptAtRef.current = 0;
          setPlaybackTime(nextTime);
          if (typeof playerRef.current?.seekTo === 'function') {
            playerRef.current.seekTo(nextTime);
          } else if (playbackDuration > 0) {
            playerRef.current?.seek?.(nextTime / playbackDuration);
          } else {
            playerRef.current?.seek?.(0);
          }
        },
      }),
      React.createElement(Text, { style: styles.seekTime }, formatProgressBarTime(playbackDuration)))
    : null;
  const renderOverlay = (fullscreenLandscape = false) => React.createElement(InlinePlayerOverlay, {
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
    fullscreenLandscape,
    seekControl,
    seekButtonsVisible: isElectron() && playbackDuration > 0,
    onSeekBy: handleSeekBy,
    drawerVisible: showLiveChat,
    drawerTab,
    isLiveCommentsEnabled,
    isEpgEnabled,
    diagnosticsEnabled,
    onTogglePanel: handlePanelToggle,
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
      showControls,
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
      title,
      streamUrl,
      drawerVisible: showLiveChat,
      drawerTab,
      onCloseDrawer: handlePanelClose,
      drawerMode,
      isLiveCommentsEnabled,
      isEpgEnabled,
      diagnosticsEnabled,
      integrations,
      messagePageSize,
      mediaId,
      drawerStyle,
      currentUser: integrations.user,
      users: users || integrations.users,
      playerSurfaceBoundsRef,
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
  seekRow: { position: 'absolute', left: 10, right: 10, bottom: 44, height: 30, flexDirection: 'row', alignItems: 'center', gap: 5, zIndex: 5 },
  centerControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  seekButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(5, 11, 20, 0.76)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  fullscreenSeekButton: { width: 46, height: 46, borderRadius: 23 },
  seekTime: { color: '#FFF', fontSize: 9, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,.9)', textShadowRadius: 3 },
  seekSlider: { flex: 1, height: 30 },
  button: { minWidth: 38, height: 38, paddingHorizontal: 10, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
