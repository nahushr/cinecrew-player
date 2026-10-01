import React from 'react';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player';

const demoAudioTracks = [
  { id: 'test-1', name: 'Test 1' },
  { id: 'test-2', name: 'Test 2' },
];

export const PlayerViewport = React.forwardRef(function PlayerViewport({
  active,
  source,
  drawerMode,
  playerStyle,
  inline,
  showBrightnessControl,
  onBrightnessChangeEnd,
  selectedAudioTrack,
  integrations,
  actions,
  onProgressBarChange,
  onStatus,
  onPlaybackError,
}, ref) {
  const reportPlaybackError = (error) => {
    onStatus(error?.message || 'Playback error');
    onPlaybackError?.(error);
  };

  if (inline) {
    return (
      <InlineLivePlayer
        key={active.url}
        source={source}
        title={active.title}
        isActive
        paused={false}
        showBrightnessControl={showBrightnessControl}
        onBrightnessChangeEnd={onBrightnessChangeEnd}
        onError={reportPlaybackError}
        onPlaying={() => onStatus('Playing')}
      />
    );
  }

  return (
    <CineCrewPlayer
      source={source}
      ref={ref}
      title={active.title}
      style={playerStyle}
      showBrightnessControl={showBrightnessControl}
      onBrightnessChangeEnd={onBrightnessChangeEnd}
      poster={active.poster}
      mediaId={active.id}
      autoPlay
      muted
      audioTracks={demoAudioTracks}
      selectedAudioTrack={selectedAudioTrack}
      // All standard controls are on by default; the demo only opts into the
      // optional recorder so it can showcase that capability too.
      controls={{ recording: true }}
      integrations={integrations}
      drawerMode={drawerMode}
      messagePageSize={5}
      actions={actions}
      onProgressBarChange={onProgressBarChange}
      features={{ diagnostics: true }}
      onBuffering={(buffering) => onStatus(buffering ? 'Buffering…' : 'Ready')}
      onPlaying={() => onStatus('Playing')}
      onError={reportPlaybackError}
    />
  );
});
