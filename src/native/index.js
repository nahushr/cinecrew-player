import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { PlayerCustomizationProvider } from './customization';
import { MediaPlayerView } from './MediaPlayerView';
import { InlineLivePlayer } from './InlineLivePlayer';
import { WEB_AC3_UNSUPPORTED_CODE, WEB_AC3_UNSUPPORTED_MESSAGE, WEB_NO_PROXY_URL_CODE, WEB_NO_PROXY_URL_MESSAGE } from './media/web/webPlaybackErrors';

function normalizeSource(source, url) {
  const value = source ?? url ?? '';
  if (typeof value === 'string') return { uri: value };
  return value && typeof value === 'object' ? value : { uri: '' };
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
    proxyUrlAvailable,
    webPlaybackError,
    onClose,
    onBack,
    ...metadata
  } = props;
  const playerApiRef = useRef({});
  useImperativeHandle(ref, () => playerApiRef.current, []);
  const media = useMemo(() => normalizeSource(source, url), [source, url]);
  const streamUrl = String(media.uri || media.url || '');
  const resolvedIsLive = isLive ?? media.isLive ?? (media.mediaType === 'live');
  const resolvedMediaType = mediaType || media.mediaType || (resolvedIsLive ? 'live' : 'movie');
  const isVisible = visible ?? Boolean(streamUrl);

  return React.createElement(
    PlayerCustomizationProvider,
    { icons, theme },
    React.createElement(MediaPlayerView, {
      ...metadata,
      visible: isVisible,
      streamUrl,
      title: title || media.title || '',
      posterUrl: poster || posterUrl || media.poster || media.posterUrl || '',
      mediaType: resolvedMediaType,
      onClose: onClose || onBack || (() => {}),
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
      webProxyAvailable: proxyUrlAvailable ?? media.proxyUrlAvailable,
      webPlaybackError: webPlaybackError ?? media.webPlaybackError,
      playerApiRef,
    }),
  );
});

/** Compact inline live preview companion for channel lists and guides. */
export { InlineLivePlayer };
export { PlayerCustomizationProvider } from './customization';
export { WEB_AC3_UNSUPPORTED_CODE, WEB_AC3_UNSUPPORTED_MESSAGE, WEB_NO_PROXY_URL_CODE, WEB_NO_PROXY_URL_MESSAGE };
export default CineCrewPlayer;
