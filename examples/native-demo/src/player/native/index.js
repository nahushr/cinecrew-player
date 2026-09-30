import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PlayerCustomizationProvider } from './customization';
import { MediaPlayerView } from './MediaPlayerView';
import { isElectron, isWeb } from '../utils/runtimePlatform';
import { useResolvedPlayerSource } from '../utils/sourceUtils';

function getRuntimePlatform() {
  if (isWeb()) return 'web';
  if (isElectron()) return 'electron';
  return 'native';
}

/** Full-screen player for React Native and Electron applications. */
export const CineCrewPlayer = forwardRef(function CineCrewPlayer(props, ref) {
  const {
    source,
    url,
    visible,
    title,
    poster,
    posterUrl,
    mediaType,
    isLive,
    autoPlay = true,
    paused,
    initialPaused,
    muted,
    initialMuted,
    volume = 1,
    playbackRate = 1,
    audioOnly = false,
    controls,
    features,
    actions,
    integrations,
    theme,
    icons,
    style,
    resolveSource,
    onClose,
    onBack,
    ...metadata
  } = props;
  const playerApiRef = useRef({});
  useImperativeHandle(ref, () => playerApiRef.current, []);
  const platform = getRuntimePlatform();
  const resolution = useResolvedPlayerSource(source, url, resolveSource, platform);
  const media = resolution.source || {};
  const streamUrl = String(media.uri || media.url || '');
  const resolvedIsLive = isLive ?? media.isLive ?? (media.mediaType === 'live');
  const resolvedMediaType = mediaType || media.mediaType || (resolvedIsLive ? 'live' : 'movie');
  const isVisible = visible ?? Boolean(streamUrl);

  React.useEffect(() => {
    if (resolution.error) props.onError?.(resolution.error);
  }, [resolution.error, props.onError]);

  if (resolution.loading || resolution.error) {
    const colors = theme?.colors || {};
    return React.createElement(PlayerCustomizationProvider, { icons, theme },
      React.createElement(View, { style: [styles.resolveScreen, style, { backgroundColor: theme?.backgroundColor || colors.background || '#050b14' }] },
        resolution.loading
          ? React.createElement(ActivityIndicator, { color: theme?.accentColor || colors.brandAccent || '#00D4FF' })
          : null,
        React.createElement(Text, { style: { color: theme?.textColor || colors.onSurfacePrimary || '#FFFFFF', marginTop: 12 } },
          resolution.loading ? 'Resolving media source…' : (resolution.error?.message || 'Unable to resolve this media source.'))));
  }

  return React.createElement(
    PlayerCustomizationProvider,
    { icons, theme },
    React.createElement(MediaPlayerView, {
      ...metadata,
      visible: isVisible,
      streamUrl,
      onBack,
      title: title || media.title || '',
      posterUrl: poster || posterUrl || media.poster || media.posterUrl || '',
      mediaType: resolvedMediaType,
      onClose: onClose || (() => {}),
      initialPaused: paused ?? initialPaused ?? !autoPlay,
      initialMuted: muted ?? initialMuted ?? false,
      initialAudioOnly: audioOnly,
      initialVolume: Math.round(Math.max(0, Math.min(1, Number(volume) || 0)) * 100),
      initialPlaybackRate: playbackRate,
      controls: controls || {},
      features: features || {},
      actions: actions || {},
      integrations: integrations || {},
      theme,
      icons,
      style,
      playerApiRef,
    }),
  );
});

/** Compact inline live preview companion for channel lists and guides. */
export { InlineLivePlayer } from './InlineLivePlayer';
export { PlayerCustomizationProvider } from './customization';
export default CineCrewPlayer;

const styles = StyleSheet.create({
  resolveScreen: { flex: 1, minHeight: '100%', alignItems: 'center', justifyContent: 'center', padding: 24 },
});
