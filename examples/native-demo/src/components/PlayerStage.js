import React from 'react';
import { InlineLivePlayer } from '@cinecrew/cinecrew-player';

export function PlayerStage({ inline, source, playerProps, onError, onPlaying }) {
  if (inline) {
    return (
      <InlineLivePlayer
        key={source.uri}
        source={source}
        title={source.title}
        height={320}
        isActive
        paused={false}
        controls={{ playPause: true, mute: true, fullscreen: true }}
        theme={playerProps.theme}
        onError={onError}
        onPlaying={onPlaying}
      />
    );
  }
  return null;
}
