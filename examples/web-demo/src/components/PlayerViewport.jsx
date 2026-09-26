import React from 'react';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player/react';

const demoAudioTracks = [
  { id: 'test-1', name: 'Test 1' },
  { id: 'test-2', name: 'Test 2' },
];

export function PlayerViewport({
  active,
  source,
  drawerMode,
  inline,
  muted,
  selectedAudioTrack,
  integrations,
  actions,
  onProgressBarChange,
  onStatus,
}) {
  if (inline) {
    return (
      <InlineLivePlayer
        key={active.url}
        source={source}
        title={active.title}
        height={360}
        isActive
        paused={false}
        controls={{ playPause: true, mute: true, fullscreen: true }}
        onError={(error) => onStatus(error?.message || 'Playback error')}
        onPlaying={() => onStatus('Playing')}
      />
    );
  }

  return (
    <CineCrewPlayer
      key={active.url}
      source={source}
      title={active.title}
      poster={active.poster}
      mediaId={active.id}
      autoPlay
      muted={muted ?? true}
      audioTracks={demoAudioTracks}
      selectedAudioTrack={selectedAudioTrack}
      controls={{
        back: true,
        playPause: true,
        seek: true,
        restart: true,
        lock: true,
        mute: true,
        aspectRatio: true,
        audioOnly: true,
        audioTracks: true,
        playbackRate: true,
        fullscreen: true,
        recording: true,
        liveChat: true,
        epg: true,
      }}
      integrations={integrations}
      drawerMode={drawerMode}
      messagePageSize={5}
      actions={actions}
      onProgressBarChange={onProgressBarChange}
      features={{ diagnostics: true }}
      onBuffering={(buffering) => onStatus(buffering ? 'Buffering…' : 'Ready')}
      onPlaying={() => onStatus('Playing')}
      onError={(error) => onStatus(error?.message || 'Playback error')}
    />
  );
}
