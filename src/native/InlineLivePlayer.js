import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { VLCPlayer } from '@cinecrew/react-native-vlc-media-player';
import { PlayerCustomizationProvider, PlayerIcon } from './customization';
import { WebVideoPlayer } from './media/WebVideoPlayer';
import { ElectronVideoPlayer } from './media/ElectronVideoPlayer';
import { isAndroid, isElectron, isIOS, isWeb } from '../utils/runtimePlatform';
import { USER_AGENT } from './media/player/playerConstants';

function getArtwork(channel) {
  return channel?.logoUrl || channel?.logo || channel?.stream_icon || channel?.posterUrl || channel?.image || '';
}

function InlineLivePlayerView({
  source,
  url,
  title = 'Live TV',
  height = 220,
  onFullscreen,
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
  onError,
  onPlaying,
}) {
  const sourceValue = source ?? url ?? '';
  const sourceObject = typeof sourceValue === 'string' ? { uri: sourceValue } : sourceValue || {};
  const rawUrl = sourceObject.uri || sourceObject.url || '';
  const streamUrl = useMemo(() => rawUrl || '', [rawUrl]);
  const [internallyPaused, setInternallyPaused] = useState(Boolean(externalPaused));
  const [muted, setMuted] = useState(Boolean(initialMuted));
  const [loading, setLoading] = useState(Boolean(streamUrl && isActive));
  const [error, setError] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const shouldRenderVideo = isActive && !Boolean(externalPaused);
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

  useEffect(() => {
    if (streamUrl && isActive && !pausedNow) setLoading(true);
    else setLoading(false);
  }, [streamUrl, isActive, pausedNow]);

  const handleError = useCallback((detail) => {
    const message = typeof detail === 'string' ? detail : detail?.message || 'Could not play this channel.';
    setError(message);
    setLoading(false);
    onError?.(detail instanceof Error ? detail : { ...detail, message });
  }, [onError]);

  const handlePlaying = useCallback((event) => {
    setLoading(false);
    setError('');
    onPlaying?.(event);
  }, [onPlaying]);

  const performAction = (name, fallback, payload) => {
    if (typeof actions?.[name] === 'function') return actions[name](payload);
    return fallback?.();
  };

  const togglePlay = (event) => {
    event?.stopPropagation?.();
    if (!shouldRenderVideo) {
      onActivate?.();
      setInternallyPaused(false);
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
    performAction('onFullscreen', () => {
      if (typeof onFullscreen === 'function') onFullscreen();
      else setFullscreen((value) => !value);
    }, { isFullscreen: !fullscreen, source: sourceObject, title });
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

  let player = null;
  if (shouldRenderVideo && streamUrl) {
    if (isElectron()) {
      player = React.createElement(ElectronVideoPlayer, {
        streamUrl,
        isLive: true,
        paused: pausedNow,
        muted,
        volume: 100,
        onPlaying: handlePlaying,
        onError: handleError,
      });
    } else if (isWeb()) {
      player = React.createElement(WebVideoPlayer, {
        streamUrl,
        title,
        isLive: true,
        paused: pausedNow,
        muted,
        volume: 100,
        onPlaying: handlePlaying,
        onError: handleError,
      });
    } else if (isAndroid() || isIOS()) {
      player = React.createElement(VLCPlayer, {
        key: streamUrl,
        style: styles.video,
        source: vlcSource,
        autoplay: true,
        paused: pausedNow,
        muted: false,
        volume: muted ? 0 : 100,
        autoAspectRatio: true,
        videoAspectRatio: 'FIT_SCREEN',
        onPlaying: handlePlaying,
        onVLCPlaying: handlePlaying,
        onOpen: handlePlaying,
        onError: handleError,
        onVLCError: handleError,
      });
    }
  }

  const controlButton = (controlName, actionName, label, icon, fallback, payload, active = false) => {
    if (controls[controlName] === false) return null;
    return React.createElement(Pressable, {
      key: controlName,
      accessibilityRole: 'button',
      accessibilityLabel: label,
      onPress: () => {
        const callback = actions?.[actionName];
        if (typeof callback === 'function') callback(payload, { player: null });
        else fallback?.();
      },
      style: [styles.button, { backgroundColor: palette.controlBackground }, active && { borderColor: palette.accentColor, borderWidth: 1 }],
    }, React.createElement(PlayerIcon, { name: icon, size: 19, color: palette.controlColor }));
  };

  return React.createElement(
    PlayerCustomizationProvider,
    { icons, theme },
    React.createElement(View, { style: [styles.frame, { height, backgroundColor: palette.surfaceColor }, style] },
      player ? React.createElement(View, { pointerEvents: 'none', style: StyleSheet.absoluteFill }, player) : null,
      !shouldRenderVideo && artwork ? React.createElement(Image, { source: { uri: artwork }, resizeMode: 'contain', style: styles.poster }) : null,
      !shouldRenderVideo && !artwork ? React.createElement(View, { style: styles.emptyPoster }, React.createElement(PlayerIcon, { name: 'television-play', size: 48, color: palette.accentColor })) : null,
      shouldRenderVideo && loading && !error ? React.createElement(View, { pointerEvents: 'none', style: styles.loading }, React.createElement(ActivityIndicator, { size: 'large', color: palette.accentColor })) : null,
      error ? React.createElement(View, { pointerEvents: 'none', style: styles.error }, React.createElement(Text, { style: [styles.errorText, { color: palette.controlColor }] }, error)) : null,
      React.createElement(Pressable, {
        style: StyleSheet.absoluteFill,
        onPress: () => setShowControls((value) => !value),
        accessibilityLabel: showControls ? 'Hide video controls' : 'Show video controls',
      }),
      showControls ? React.createElement(View, { pointerEvents: 'box-none', style: StyleSheet.absoluteFill },
        React.createElement(View, { pointerEvents: 'box-none', style: styles.topRow },
          React.createElement(View, { style: styles.liveBadge }, React.createElement(View, { style: styles.liveDot }), React.createElement(Text, { style: styles.liveText }, 'LIVE')),
          React.createElement(Text, { numberOfLines: 1, style: [styles.title, { color: palette.controlColor }] }, title),
          controlButton('mute', 'onMute', muted ? 'Unmute' : 'Mute', muted ? 'volume-off' : 'volume-high', toggleMute, { muted: !muted }),
        ),
        React.createElement(View, { pointerEvents: 'box-none', style: styles.center },
          controlButton('playPause', 'onPlayPause', pausedNow ? 'Play' : 'Pause', pausedNow ? 'play' : 'pause', togglePlay, { isPlaying: pausedNow }),
        ),
        React.createElement(View, { pointerEvents: 'box-none', style: styles.bottomRow },
          React.createElement(Text, { numberOfLines: 1, style: [styles.title, { color: palette.controlColor }] }, title),
          controlButton('fullscreen', 'onFullscreen', 'Open full player', 'fullscreen', openFullscreen, { source: streamUrl, title }),
        ),
      ) : null,
    ),
  );
}

export const InlineLivePlayer = React.memo(InlineLivePlayerView);

const styles = StyleSheet.create({
  frame: { width: '100%', minHeight: 80, overflow: 'hidden', borderRadius: 14, position: 'relative', justifyContent: 'center' },
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
