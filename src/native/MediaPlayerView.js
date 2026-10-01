import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StatusBar,
  useWindowDimensions,
  PanResponder,
  BackHandler,
  Modal,
  StyleSheet,
} from 'react-native';
import { LiveChatDrawer } from './media/LiveChatDrawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isWeb, isElectron, isElectronOverlay } from '../utils/runtimePlatform';
import { getFontSize, getFontWeight } from '../utils/layoutUtils';
import { isLocalMediaUri } from '../utils/mediaUtils';
import { invokePlayerAction } from '../utils/invokePlayerAction.js';
import { emitProgressBarTime } from '../utils/progressBarTime.js';
import { parsePlaybackStartTime } from '../utils/playbackTime.js';
import { playPlayer, resumePlayerAfterSeek } from '../utils/playbackRecovery.js';
import {
  USER_AGENT,
  ASPECT_OPTIONS,
  calculateScreenAspectRatio,
  isSafariOrIOS,
  getWebPoint,
  applyTrackDefaults,
  VLC_AVAILABLE,
  ExoVideoFallback,
  mediaPlayerStyles as styles,
  clampNumber,
  normalizeBrightness,
  normalizeVolume,
  pickShuffleCandidate,
  normalizeAspectOptions,
  scheduleControlFrame,
  cancelControlFrame,
  scheduleNativeVolumeFrame,
  DEFAULT_ASPECT_RATIO,
  getPanelActionName,
  normalizeProgressEvent,
  applyPendingSeek,
  applyProgressState,
  handlePinchMove,
  handleVerticalGestureMove,
  isUsableInlinePreviewRect,
  getInlinePreviewPositionStyle,
  PlatformMediaSurface,
  InlinePreviewFrame,
  FullscreenVideoLayer,
  FullscreenGestureLayer,
  FullscreenControlsPanel,
  FullscreenVisualFeedback,
  FullscreenStatusLayer,
  FullscreenChatLayer,
  FullscreenRecordingLayer,
} from './media/player';

export const MediaPlayerView = (props) => {
  const {
    visible,
    streamUrl,
    onBack,
    title,
    mediaType = 'live',
    onClose,
    colors: initialColors,
    showLiveChat: propShowLiveChat,
    onLiveChatChange,
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
    startTime,
    resumePosition = 0,
    durationSecs = 0,
    season,
    episode,
    onCwRefresh,
    playlist,
    shuffle,
    onNextEpisode,
    liveChatNonce = 0,
    messagePageSize = 50,
    drawerMode = 'overlay',
    drawerStyle,
    aspectRatios,
    defaultAspectRatio = DEFAULT_ASPECT_RATIO,
    onAspectRatioChange,
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
    showProgressBar = true,
    onProgressBarChange,
    showBrightnessControl = false,
    brightnessColor,
    brightnessAccentColor,
    onBrightnessChangeEnd,
    showVolumeControl = false,
    showSoundControl = false,
    volumeColor,
    soundColor,
    onVolumeChangeEnd,
    onSoundChangeEnd,
    showLiveBadge = false,
    showLivePill = false,
    showLiveButton = false,
    onPlaying,
    onBuffering,
    onError,
    onEnded,
    onPlaybackRoute,
    onRecordingComplete,
  } = props;
  const requestedStartTime = parsePlaybackStartTime(startTime);
  let colors = initialColors;
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
  // Keep the default 16:9 player fully visible in landscape without requiring
  // apps to calculate dimensions or pass a demo-specific style. A consumer's
  // explicit `style` is applied afterwards and can still override this limit.
  const flattenedStyle = StyleSheet.flatten(props.style) || {};
  const consumerHasWidth = Boolean(flattenedStyle.width || flattenedStyle.maxWidth);
  const landscapeInlineStyle = windowWidth > windowHeight && !consumerHasWidth
    ? {
        maxWidth: Math.max(
          1,
          (windowHeight - (insets?.top || 0) - (insets?.bottom || 0) - 140) * (16 / 9),
        ),
        alignSelf: 'center',
      }
    : null;
  const windowSizeRef = useRef({ w: windowWidth, h: windowHeight });
  const insetsRef = useRef(insets);
  windowSizeRef.current = { w: windowWidth, h: windowHeight };
  insetsRef.current = insets;
  const vlcRef = useRef(null);
  const playerRef = useRef(null);
  const mediaFrameRef = useRef(null);
  const [mediaFrameSize, setMediaFrameSize] = useState({ width: 0, height: 0 });
  const handleMediaFrameLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout;
    setMediaFrameSize((previous) => (
      previous.width === width && previous.height === height
        ? previous
        : { width, height }
    ));
  }, []);
  const invokeAction = useCallback((name, fallback, payload) => {
    let callback = actions?.[name];
    if (name === 'onAspectRatioChange') callback = callback || onAspectRatioChange;
    if (name === 'onBack') callback = callback || onBack || onClose;
    return invokePlayerAction(
      fallback,
      callback,
      payload,
      { player: playerApiRef?.current || null },
    );
  }, [actions, onAspectRatioChange, onBack, onClose, playerApiRef]);
  const handlePlayerHostRef = useCallback((node) => {
    playerRef.current = node;
    onPlayerHostRef?.(node);
  }, [onPlayerHostRef]);
  const getPlayerHostBounds = useCallback(() => {
    const rect = (mediaFrameRef.current || playerRef.current)?.getBoundingClientRect?.();
    if (!rect) return null;
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }, []);

  const [showSpeedPicker, setShowSpeedPicker] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(() => clampNumber(initialPlaybackRate, 0.25, 4, 1));
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isPlaying, setIsPlaying] = useState(!initialPaused);
  const isPlayingRef = useRef(!initialPaused);
  isPlayingRef.current = isPlaying;
  const playbackEndedRef = useRef(false);
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

  useEffect(() => {
    cancelControlFrame(brightnessFrameRef.current);
    brightnessFrameRef.current = null;
    brightnessRef.current = 1;
    pendingBrightnessRef.current = 1;
    setBrightness(1);
  }, [streamUrl]);

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

  const [internalShowLiveChat, setInternalShowLiveChat] = useState(() => Boolean(propShowLiveChat ?? initialShowLiveChat));
  const showLiveChat = propShowLiveChat !== undefined ? Boolean(propShowLiveChat) : internalShowLiveChat;
  const setShowLiveChat = useCallback((next) => {
    const nextVal = typeof next === 'function' ? next(showLiveChat) : next;
    setInternalShowLiveChat(nextVal);
    onLiveChatChange?.(nextVal);
  }, [showLiveChat, onLiveChatChange]);
  const [drawerTab, setDrawerTab] = useState('chat');
  const isLive = mediaType === 'live' || mediaType === 'channel';
  const isLiveCommentsEnabled = controls.liveChat ?? Boolean(integrations.liveChat?.loadMessages && integrations.liveChat?.sendMessage);
  const isEpgEnabled = controls.epg ?? Boolean(integrations.epg?.loadListings);
  const diagnosticsOverlayEnabled = Boolean(features.diagnostics);
  const isAudioOnlyFeatureEnabled = controls.audioOnly ?? true;
  const recording = integrations.recording;
  const hasBuiltInRecorder = VLC_AVAILABLE || isElectron();
  const isScreenRecorderEnabled = controls.recording ?? (Boolean(recording) || hasBuiltInRecorder);
  const canRecord = recording
    ? (isLive || recording.supportsOnDemand === true)
    : hasBuiltInRecorder;
  const [currentUser, setCurrentUser] = useState(integrations.user || { id: '0', username: 'Viewer' });

  const badgeService = useMemo(() => ({
    emit: (name, payload) => Promise.resolve(integrations.onEvent?.({ name, payload })).catch(() => {}),
    recordProgress: (payload) => Promise.resolve(integrations.onProgress?.(payload)).catch(() => {}),
  }), [integrations]);

  useEffect(() => {
    let active = true;
    void (async () => {
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
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio || DEFAULT_ASPECT_RATIO);
  const aspectRatioRef = useRef(defaultAspectRatio || DEFAULT_ASPECT_RATIO);
  const aspectOptions = useMemo(() => normalizeAspectOptions(aspectRatios), [aspectRatios]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isElectron() || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const className = 'cinecrew-electron-player-fullscreen';
    root.classList.toggle(className, isFullscreen);
    return () => root.classList.remove(className);
  }, [isFullscreen]);

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
    } else if (isElectron()) {
      const next = !isFullscreen;
      setIsFullscreen(next);
      void vlcRef.current?.setFullscreen?.(next);
    } else {
      setIsFullscreen((prev) => !prev);
    }
    badgeService.emit('player.fullscreen', {}).catch(() => {});
  }, [exitFullscreen, isFullscreen, badgeService]);

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
      } else if (val === 'FILL_SCREEN' || val === 'FILL') {
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
  const lastProgressBarSecondRef = useRef(null);
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

  const isInlinePreview = !!inlinePreview;
  const progressBarVisible = showProgressBar !== false
    && controls.seek !== false
    && !isLive
    && !isInlinePreview;
  const progressBarCallback = progressBarVisible ? onProgressBarChange : undefined;

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
  const recordingClockRef = useRef({ startedAt: 0, elapsedMs: 0 });
  const nativeRecordingStopRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }, []);
  const waitForNativeRecordingFile = useCallback(() => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      nativeRecordingStopRef.current = null;
      reject(new Error('VLC did not report the completed recording file.'));
    }, 20000);
    nativeRecordingStopRef.current = {
      resolve: (path) => { clearTimeout(timeout); resolve(path); },
      reject: (error) => { clearTimeout(timeout); reject(error); },
    };
  }), []);

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
    playbackEndedRef.current = false;
    setVideoOnlyMode(!!videoOnly);
    lastProgressBarSecondRef.current = null;
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

  useEffect(() => {
    if (requestedStartTime === null) return;
    // Use the shared progress handler to seek once each backend reports its
    // duration. This covers VLC, Electron, Expo web, and the native fallback.
    pendingSeekRef.current = requestedStartTime;
    sourceRestorePositionRef.current = 0;
    hasResumedRef.current = true;
    if (restoreTimerRef.current) {
      clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
    }
  }, [requestedStartTime, streamUrl, visible]);

  // Reset aspect ratio & zoom state every time player opens or streamUrl changes
  useEffect(() => {
    if (visible) {
      setAspectRatio(defaultAspectRatio || DEFAULT_ASPECT_RATIO);
      aspectRatioRef.current = defaultAspectRatio || DEFAULT_ASPECT_RATIO;
      setZoomScale(1);
      zoomScaleRef.current = 1;
      setZoomBadgeText('');
      setSeekRipple(null);
    }
  }, [visible, streamUrl, defaultAspectRatio]);

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
    } else if (recStatusRef.current !== 'idle') {
      try {
        if (isElectron()) {
          const result = await playerApiRef?.current?.stopNativeRecording?.();
          if (result?.filename) Alert.alert('Recording saved', result.filename);
        } else {
          const completedFile = waitForNativeRecordingFile();
          const accepted = await playerApiRef?.current?.stopNativeRecording?.();
          if (accepted === false) throw new Error('VLC rejected the request to stop recording.');
          const path = await completedFile;
          Alert.alert('Recording saved', String(path).split(/[\\/]/).pop());
        }
      } catch (err) {
        Alert.alert('Recording', err?.message || 'Could not save the recording.');
      }
      clearRecordingTimer();
      setRecStatus('idle');
      setRecElapsedMs(0);
    }
    onClose();
  }, [clearAudioOnlyFallbackTimer, clearRecordingTimer, exitFullscreen, saveCurrentProgress, onCwRefresh, onClose, integrations, mediaId, recording, playerApiRef, waitForNativeRecordingFile]);

  const handleBackAction = useCallback(() => {
    if (isFullscreen) {
      toggleFullscreen();
      return;
    }
    invokeAction(
      'onBack',
      undefined,
      { title, streamUrl, mediaId },
    );
  }, [isFullscreen, toggleFullscreen, invokeAction, title, streamUrl, mediaId]);

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
    } else if (recStatusRef.current !== 'idle') {
      clearRecordingTimer();
      try {
        vlcRef.current?.stopRecording?.();
      } catch {
        // Best-effort finalize when the player is closed or its source changes.
      }
    }
  }, [streamUrl, visible, recording, clearRecordingTimer]);

  const showRecNotice = useCallback((notice) => {
    if (recNoticeTimer.current) clearTimeout(recNoticeTimer.current);
    setRecNotice(notice);
    recNoticeTimer.current = setTimeout(() => setRecNotice(null), 5600);
  }, []);

  const handleStartRecording = useCallback(async (e) => {
    e?.stopPropagation?.();
    if (!isScreenRecorderEnabled || !canRecord || recStatusRef.current !== 'idle') return;
    try {
      if (recording?.start) {
        await recording.start({
          getVideoElement: () => {
            const ref = vlcRef.current;
            if (typeof ref?.getVideoElement === 'function') return ref.getVideoElement();
            return null;
          },
          streamUrl: playbackUrl || streamUrl,
          title,
          player: playerApiRef?.current || null,
        });
      } else {
        const start = playerApiRef?.current?.startNativeRecording;
        if (typeof start !== 'function') throw new Error('The platform recorder is unavailable in this player build.');
        const result = await start();
        if (result === false || result == null) throw new Error('The platform could not start recording.');
        recordingClockRef.current = { startedAt: Date.now(), elapsedMs: 0 };
        setRecElapsedMs(0);
        setRecStatus('recording');
        clearRecordingTimer();
        recordingTimerRef.current = setInterval(() => {
          const clock = recordingClockRef.current;
          if (recStatusRef.current === 'recording' && clock.startedAt) {
            const elapsedMs = clock.elapsedMs + Date.now() - clock.startedAt;
            setRecElapsedMs(elapsedMs);
          }
        }, 500);
      }
      if (muted) {
        showRecNotice({
          type: 'info',
          message: 'Recording started. Unmute the player if you want live audio in the file.',
        });
      }
    } catch (err) {
      showRecNotice({ type: 'error', message: err?.message || 'Could not start recording.' });
    }
  }, [canRecord, clearRecordingTimer, isScreenRecorderEnabled, muted, playbackUrl, showRecNotice, streamUrl, title, recording, playerApiRef]);

  const handlePauseRecording = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      if (recording?.pause) {
        await recording.pause();
      } else {
        const clock = recordingClockRef.current;
        if (clock.startedAt) clock.elapsedMs += Date.now() - clock.startedAt;
        clock.startedAt = 0;
        playerApiRef?.current?.pause?.();
        setRecElapsedMs(clock.elapsedMs);
        setRecStatus('paused');
      }
    } catch (err) {
      showRecNotice({ type: 'error', message: err?.message || 'Could not pause recording.' });
    }
  }, [showRecNotice, recording, playerApiRef]);

  const handleResumeRecording = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      if (recording?.resume) {
        await recording.resume();
      } else {
        playerApiRef?.current?.play?.();
        recordingClockRef.current.startedAt = Date.now();
        setRecStatus('recording');
      }
    } catch (err) {
      showRecNotice({ type: 'error', message: err?.message || 'Could not resume recording.' });
    }
  }, [showRecNotice, recording, playerApiRef]);

  const handleStopRecording = useCallback(async (e) => {
    e?.stopPropagation?.();
    try {
      let result;
      if (recording?.stop) {
        result = await recording.stop();
      } else if (isElectron()) {
        result = await playerApiRef?.current?.stopNativeRecording?.();
        if (result === false || !result?.path) throw new Error('LibVLC could not finalize the recording file.');
      } else {
        const completedFile = waitForNativeRecordingFile();
        const accepted = await playerApiRef?.current?.stopNativeRecording?.();
        if (accepted === false) throw new Error('VLC rejected the request to stop recording.');
        const path = await completedFile;
        result = { path, filename: String(path).split(/[\\/]/).pop(), platform: 'native' };
      }
      clearRecordingTimer();
      recordingClockRef.current = { startedAt: 0, elapsedMs: 0 };
      setRecStatus('idle');
      setRecElapsedMs(0);
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
        if (result.path) onRecordingComplete?.({ ...result, filename: result.filename });
      }
    } catch (err) {
      showRecNotice({ type: 'error', message: err?.message || 'Could not save the recording.' });
    }
  }, [clearRecordingTimer, onRecordingComplete, playerApiRef, recording, showRecNotice, waitForNativeRecordingFile]);

  /**
   * Restart the movie/episode from the beginning (seek to 00:00).
   */
  const handleRestart = useCallback(() => {
    playbackEndedRef.current = false;
    const player = vlcRef.current;
    let restartResult;
    try {
      if (typeof player?.restart === 'function') restartResult = player.restart();
      else if (typeof player?.reload === 'function') restartResult = player.reload();
      else {
        restartResult = player?.seek?.(0);
      }
    } catch (e) {
      // restart seek is best-effort
    }
    if (restartResult && typeof restartResult.then === 'function') {
      Promise.resolve(restartResult).then(() => playPlayer(player), () => playPlayer(player));
    } else {
      playPlayer(player);
    }
    isPlayingRef.current = true;
    setIsPlaying(true);
    isSeeking.current = false;
    setCurrentTime(0);
    setSliderPos(0);
    lastKnownTimeRef.current = 0;
    seekCompletedAt.current = Date.now();
    emitProgressBarTime(0, progressBarCallback, lastProgressBarSecondRef, { force: true });
    if (!showControls) setShowControls(true);
  }, [progressBarCallback, showControls]);

  // Episode finished: auto-advance to the next episode (sequential) or to a
  // random episode (shuffle mode). Last episode in the playlist stops playback.
  const handleEpisodeEnded = useCallback(() => {
    playbackEndedRef.current = true;
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

  const dismissControlsFromVideoTap = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setShowSpeedPicker(false);
    setShowAspectPicker(false);
    setShowAudioPicker(false);
    setShowControls(false);
  }, []);
  const controlsTouchActiveRef = useRef(false);
  const markControlSurfaceTouch = useCallback(() => {
    controlsTouchActiveRef.current = true;
  }, []);
  const handleFullscreenTouchStartCapture = useCallback(() => {
    controlsTouchActiveRef.current = false;
  }, []);
  const handleFullscreenTouchEnd = useCallback(() => {
    const wasControlTouch = controlsTouchActiveRef.current;
    controlsTouchActiveRef.current = false;
    if (wasControlTouch || !isFullscreen || !showControls || isLocked) return;
    dismissControlsFromVideoTap();
  }, [dismissControlsFromVideoTap, isFullscreen, isLocked, showControls]);
  const handleFullscreenTouchCancel = useCallback(() => {
    controlsTouchActiveRef.current = false;
  }, []);

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
    const nextVolume = !next && volumeRef.current === 0 ? 100 : volumeRef.current;
    if (isWeb()) {
      if (next) {
        vlcRef.current?.deactivateAudio?.();
      } else {
        vlcRef.current?.activateAudio?.(nextVolume);
      }
    }
    mutedRef.current = next;
    if (next) pendingUnmuteRef.current = false;
    setMuted(next);

    // Drive mute and volume together for native VLC. This avoids relying on
    // React prop ordering to restore the user's audible volume after unmute.
    vlcRef.current?.setAudioState?.(next || videoOnlyMode, nextVolume);

    if (!next && volumeRef.current === 0) {
      commitVolume(100, { unmute: false });
    }

    badgeService.emit('player.mute', {}).catch(() => {});
  }, [commitVolume, videoOnlyMode]);

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

  const resumeAfterEndedSeek = useCallback((seekResult) => {
    if (!playbackEndedRef.current) return;
    playbackEndedRef.current = false;
    isPlayingRef.current = true;
    setIsPlaying(true);
    resumePlayerAfterSeek(vlcRef.current, seekResult, true);
  }, []);

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
    let seekResult;
    let seekIssued = false;
    try {
      if (vlcRef.current) {
        const audioOffset = isAudioOnly && !audioOnlyFallback && !isLive
          ? Number(audioModeStartPositionRef.current || 0)
          : 0;
        const playerDuration = Math.max(0, duration - audioOffset);
        const playerTarget = Math.max(0, Number(secs) - audioOffset);
        if (playerDuration > 0) {
          const ratio = Math.max(0, Math.min(1, playerTarget / playerDuration));
          seekResult = vlcRef.current.seek(ratio);
          seekIssued = true;
        } else {
          // Native seek expects a 0-1 ratio; defer until duration is known.
          pendingSeekRef.current = secs;
        }
      }
    } catch (e) {
      // seek is best-effort; ignore player-specific failures
    }
    if (seekIssued) resumeAfterEndedSeek(seekResult);
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
    if (progress) emitProgressBarTime(progress.seconds, progressBarCallback, lastProgressBarSecondRef);
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

    if (requestedStartTime !== null) {
      // The explicit position is queued and applied by the shared progress
      // handler as soon as the active backend reports its duration.
      hasResumedRef.current = true;
      sourceRestorePositionRef.current = 0;
      return;
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
    playbackEndedRef.current = false;
    clearAudioOnlyFallbackTimer();
    clearBufferingIndicator();
    setErrorMessage(null);
    onPlaying?.(event?.nativeEvent || event || {});
    handleNativeOpen(event);
  };

  const handleNativeLoadStart = useCallback(() => {
    hasStartedPlaybackRef.current = false;
    playbackEndedRef.current = false;
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
      emitProgressBarTime(target, progressBarCallback, lastProgressBarSecondRef, { force: true });
    }, { seconds: Number(seconds) || 0, currentTime: lastKnownTimeRef.current },
  ), [invokeAction, handleSeekTo, debouncedSaveProgress, progressBarCallback]);
  const handleSeekByAction = (deltaSeconds) => invokeAction(
    'onSeek', () => {
      handleSeekBy(deltaSeconds);
      emitProgressBarTime(lastKnownTimeRef.current, progressBarCallback, lastProgressBarSecondRef, { force: true });
    }, { deltaSeconds: Number(deltaSeconds) || 0, currentTime: lastKnownTimeRef.current },
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
  const handlePanelAction = useCallback((tab) => {
    const isOpen = !(showLiveChat && drawerTab === tab);
    return invokeAction(
      getPanelActionName(tab),
      () => {
        if (isOpen) { setDrawerTab(tab); setShowLiveChat(true); }
        else setShowLiveChat(false);
      },
      { tab, isOpen },
    );
  }, [invokeAction, showLiveChat, drawerTab]);

  useEffect(() => {
    if (!playerApiRef) return undefined;
    const api = {
      play: () => togglePlayPause(true),
      pause: () => togglePlayPause(false),
      togglePlayPause,
      setPanel: (panel) => {
        if (!panel) {
          setShowLiveChat(false);
          return;
        }
        if (panel === 'chat' && !isLiveCommentsEnabled) return;
        if (panel === 'epg' && !isEpgEnabled) return;
        if (panel === 'diagnostics' && !diagnosticsOverlayEnabled) return;
        setDrawerTab(panel);
        setShowLiveChat(true);
      },
      closePanel: () => setShowLiveChat(false),
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
      back: handleBackAction,
      getVideoElement: () => vlcRef.current?.getVideoElement?.() || null,
      getAudioTracks: () => audioTracks,
      startNativeRecording: (path) => {
        if (typeof vlcRef.current?.startRecording !== 'function') return false;
        const result = vlcRef.current.startRecording(path);
        return typeof result === 'undefined' ? true : result;
      },
      stopNativeRecording: () => {
        if (typeof vlcRef.current?.stopRecording !== 'function') return false;
        const result = vlcRef.current.stopRecording();
        return typeof result === 'undefined' ? true : result;
      },
    };
    Object.assign(playerApiRef.current, api);
    return () => {
      for (const key of Object.keys(api)) delete playerApiRef.current[key];
    };
  }, [playerApiRef, togglePlayPause, handleRestart, toggleMute, handleSelectAspectRatio, handleAudioSelect, handleSeekTo, handleSeekBy, handleBackAction, audioTracks, vlcRef, isLiveCommentsEnabled, isEpgEnabled, diagnosticsOverlayEnabled]);

  const handleNativeRecordingCreated = useCallback((path) => {
    recording?.onNativeRecordingCreated?.(path);
    nativeRecordingStopRef.current?.resolve?.(path);
    nativeRecordingStopRef.current = null;
  }, [recording]);
  const handleNativeRecordingState = useCallback((state) => {
    recording?.onNativeRecordingState?.(state);
    if (recording) return;
    if (state?.requestAccepted === false || state?.error) {
      const error = new Error(state.error || 'VLC rejected the recording request.');
      nativeRecordingStopRef.current?.reject?.(error);
      nativeRecordingStopRef.current = null;
      if (state.operation === 'stop') {
        showRecNotice({ type: 'error', message: error.message });
        return;
      }
      clearRecordingTimer();
      recordingClockRef.current = { startedAt: 0, elapsedMs: 0 };
      setRecStatus('idle');
      setRecElapsedMs(0);
      showRecNotice({ type: 'error', message: error.message });
    }
  }, [clearRecordingTimer, recording, showRecNotice]);

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
    if (isWeb() || isElectron()) return null;

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
      onStartShouldSetPanResponder: (evt) => (
        !(showControlsRef.current && !isLockedRef.current)
        && !isSeekScrubGesture(evt)
      ),
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (showControlsRef.current && !isLockedRef.current) return false;
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
    hwDecoderEnabled: 0,
    // Avoid Android's MediaCodec output path on this player surface; its
    // resolution-switch buffer errors leave translucent stale tiles behind.
    hwDecoderForced: 0,
    // Keep this source object stable while Android audio mode is toggled so
    // VLC does not release and reopen the active stream.
    mediaOptions: nativeMediaOptions,
  }), [playerStreamUrl, nativeMediaOptions]);

  const transparentElectronOverlay = isElectronOverlay();

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
      nativeSource={nativeSource}
      computedAspectRatio={computedAspectRatio}
      handleNativeLoadStart={handleNativeLoadStart}
      handleNativeOpen={handleNativeOpen}
      handleClose={handleClose}
      setIsFullscreen={setIsFullscreen}
      handleNativeBuffering={handleNativeBuffering}
      onRecordingCreated={handleNativeRecordingCreated}
      onRecordingState={handleNativeRecordingState}
      getPlayerHostBounds={getPlayerHostBounds}
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
        isLandscape={drawerMode !== 'modal' || windowWidth >= windowHeight}
        initialTab={drawerTab}
        drawerMode={drawerMode}
        streamUrl={playbackUrl || streamUrl || ''}
        serverUrl={playbackUrl || streamUrl || ''}
        isLive={isLive}
        isLiveCommentsEnabled={isLiveCommentsEnabled}
        isEpgEnabled={isEpgEnabled}
        diagnosticsEnabled={diagnosticsOverlayEnabled}
        title={title}
        streamId={mediaId}
        integrations={integrations}
        colors={colors}
        messagePageSize={messagePageSize}
        drawerStyle={drawerStyle}
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
        showLiveBadge={showLiveBadge || showLivePill || showLiveButton || controls?.liveBadge || controls?.livePill || controls?.liveButton}
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
    canRecord,
    recStatus,
    isLoading,
    showLiveChat,
    drawerTab,
    isLiveCommentsEnabled,
    isEpgEnabled,
    diagnosticsOverlayEnabled,
    muted,
    isLocked,
    controls: { ...controls, seek: progressBarVisible },
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
    showBrightnessControl,
    brightness,
    onBrightnessChange: commitBrightness,
    onBrightnessChangeEnd,
    brightnessAccentColor: brightnessColor || brightnessAccentColor || colors?.brandAccent || colors?.primary || '#00D4FF',
    showVolumeControl: showVolumeControl || showSoundControl,
    volume,
    onVolumeChange: (val) => commitVolume(val, { unmute: true }),
    onVolumeChangeEnd: onVolumeChangeEnd || onSoundChangeEnd,
    volumeAccentColor: volumeColor || soundColor || '#FFE066',
    isPlaying,
    handleSeekByAction,
    handlePlayPauseAction,
    isSeeking,
    sliderPos,
    currentTime,
    duration,
    isAudioOnly,
    isAudioOnlyFeatureEnabled,
    videoOnlyMode,
    showAspectPicker,
    aspectRatio,
    aspectRatios: aspectOptions,
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

  const nativeGestureHandlers = !isWeb() && !isElectron() && panResponder?.panHandlers
    ? panResponder.panHandlers
    : null;
  // Resize mode places the video and drawer side by side in landscape. In
  // portrait there isn't enough horizontal room, so keep the drawer over video.
  const resizeDrawerOpen = drawerMode === 'resize'
    && showLiveChat
    && windowWidth >= windowHeight;
  const portraitResizeOpen = drawerMode === 'resize'
    && showLiveChat
    && windowWidth < windowHeight;
  const portraitVideoHeight = Math.min(Math.round(windowHeight * 0.42), Math.round(windowWidth * (9 / 16)));
  const portraitChatHeight = Math.min(380, Math.max(280, Math.round(windowHeight * 0.42)));
  const portraitResizeContainerHeight = portraitVideoHeight + portraitChatHeight;
  const mediaFrameStyle = resizeDrawerOpen
    ? { right: 'auto', width: '70%' }
    : (portraitResizeOpen
      ? { top: 0, left: 0, right: 0, bottom: 'auto', height: portraitVideoHeight, width: '100%' }
      : null);
  const isEndToEnd = windowWidth >= windowHeight;

  const fullscreenContent = (
    <View
      ref={handlePlayerHostRef}
      collapsable={false}
      style={[
        styles.fullscreenPlayerContainer,
        transparentElectronOverlay && { backgroundColor: 'transparent' },
        !isWeb() && !isFullscreen && styles.boundedInlinePlayerContent,
      ]}
      {...(nativeGestureHandlers || {})}
    >
      <StatusBar hidden={isFullscreen} translucent={isFullscreen} backgroundColor="transparent" barStyle="light-content" />

      <View
        ref={mediaFrameRef}
        collapsable={false}
        style={[styles.mediaFrame, mediaFrameStyle]}
        onLayout={handleMediaFrameLayout}
        onTouchStartCapture={isFullscreen ? handleFullscreenTouchStartCapture : undefined}
        onTouchEnd={isFullscreen ? handleFullscreenTouchEnd : undefined}
        onTouchCancel={isFullscreen ? handleFullscreenTouchCancel : undefined}
      >
        <FullscreenVideoLayer
          videoPlayer={videoPlayer}
          zoomScale={zoomScale}
          isAudioOnly={isAudioOnly}
          transparent={transparentElectronOverlay}
        />
        <FullscreenVisualFeedback
          isAudioOnly={isAudioOnly}
          brightness={brightness}
          zoomBadgeText={zoomBadgeText}
          seekRipple={seekRipple}
        />
        <FullscreenGestureLayer
          isAudioOnly={isAudioOnly}
          showControls={showControls}
          isLocked={isLocked}
          isRecording={recStatus === 'recording' || recStatus === 'paused'}
          panResponder={panResponder}
          managedByParent={!isWeb() && !isElectron() && !!panResponder}
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

        {/* Do not leave an empty elevated native view over VLC's TextureView.
            Android can retain translucent composition tiles after the controls
            are hidden if the elevated overlay remains mounted. */}
        {showControls
          && !isAudioOnly
          && !(drawerMode === 'overlay' && showLiveChat)
          && mediaFrameSize.width > 0
          && mediaFrameSize.height > 0 ? (
            <View
              style={styles.controlsShell}
              pointerEvents="box-none"
              onTouchStart={markControlSurfaceTouch}
            >
              <FullscreenControlsPanel {...fullscreenControlsProps} frameSize={mediaFrameSize} />
            </View>
        ) : null}

        <FullscreenStatusLayer
          isAudioOnly={isAudioOnly}
          audioOnlyProps={{ posterUrl, title, episodeLabel, isPlaying, windowWidth, windowHeight, usesAudioProxy: audioOnlyUsesProxy, onToggleAudioOnly: toggleAudioOnly }}
          isLoading={isLoading}
          errorMessage={errorMessage}
          scale={scale}
          handleClose={handleClose}
        />
        <FullscreenRecordingLayer
          isAudioOnly={isAudioOnly}
          canRecord={canRecord}
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
      </View>

      <FullscreenChatLayer
        visible={showLiveChat}
        isFullscreen={isFullscreen}
        insets={insets}
        isAudioOnly={isAudioOnly}
        mediaId={mediaId}
        title={title}
        currentUser={currentUser}
        onClose={() => setShowLiveChat(false)}
        isLandscape={windowWidth >= windowHeight}
        landscapeFullWidth={props.isLandscape}
        drawerTab={drawerTab}
        drawerMode={drawerMode}
        portraitVideoHeight={portraitVideoHeight}
        playbackUrl={playbackUrl}
        streamUrl={streamUrl}
        isLive={isLive}
        isLiveCommentsEnabled={isLiveCommentsEnabled}
        isEpgEnabled={isEpgEnabled}
        diagnosticsEnabled={diagnosticsOverlayEnabled}
        integrations={integrations}
        colors={colors}
        messagePageSize={messagePageSize}
        drawerStyle={drawerStyle}
      />
    </View>
  );

  if (isElectron()) {
    return (
      <View
        ref={handlePlayerHostRef}
        collapsable={false}
        style={[
          isFullscreen ? styles.electronFullscreenHost : styles.inlinePlayerContainer,
          !isFullscreen && landscapeInlineStyle,
          transparentElectronOverlay && { backgroundColor: 'transparent' },
          style,
        ]}
      >
        {fullscreenContent}
      </View>
    );
  }

  if (!isWeb()) {
    if (isFullscreen) {
      return (
        <Modal
          visible={visible}
          animationType="none"
          transparent={false}
          presentationStyle="fullScreen"
          statusBarTranslucent={true}
          navigationBarTranslucent={true}
          hardwareAccelerated={true}
          onRequestClose={handleBackAction}
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        >
          <View
            collapsable={false}
            style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]}
          >
            {fullscreenContent}
          </View>
        </Modal>
      );
    }

    return (
      <View
        ref={handlePlayerHostRef}
        collapsable={false}
        style={[
          styles.inlinePlayerContainer,
          portraitResizeOpen
            ? { height: portraitResizeContainerHeight, aspectRatio: undefined }
            : (!isEndToEnd && styles.inlineAspectRatio),
          !isEndToEnd && !portraitResizeOpen && landscapeInlineStyle,
          transparentElectronOverlay && { backgroundColor: 'transparent' },
          style,
          isEndToEnd && { borderRadius: 0, width: '100%', maxWidth: '100%' },
        ]}
      >
        {fullscreenContent}
      </View>
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
