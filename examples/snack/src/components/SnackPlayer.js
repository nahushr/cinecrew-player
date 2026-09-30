import React from 'react';
import { CineCrewPlayer, InlineLivePlayer } from '../player/CineCrewExports';
import { ALL_CONTROLS, THEME } from '../constants';

export default function SnackPlayer({ inline, source, visible, playerRef, integrations, onBack, onError, onPlaying }) {
  if (inline) {
    return (
      <InlineLivePlayer
        key={source.uri}
        source={{ ...source, isLive: true, mediaType: 'live' }}
        title={source.title}
        height={300}
        isActive
        paused={false}
        controls={{ playPause: true, mute: true, fullscreen: true }}
        theme={THEME}
        onError={onError}
        onPlaying={onPlaying}
      />
    );
  }
  if (!visible) return null;
  return (
    <CineCrewPlayer
      key={source.uri}
      ref={playerRef}
      source={source}
      title={source.title}
      mediaId={source.id}
      isLive={source.isLive}
      autoPlay
      controls={ALL_CONTROLS}
      integrations={integrations}
      actions={{ onBack }}
      features={{ diagnostics: true }}
      theme={THEME}
      onError={onError}
      onPlaying={onPlaying}
    />
  );
}
