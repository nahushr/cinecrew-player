import React from 'react';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player/web';

const demoAudioTracks = [
  { id: 'test-1', name: 'Test 1' },
  { id: 'test-2', name: 'Test 2' },
];

export function PlayerViewport({
  active,
  source,
  drawerMode,
  inline,
  startTime,
  showBrightnessControl,
  showVolumeControl,
  onBrightnessChangeEnd,
  onVolumeChangeEnd,
  selectedAudioTrack,
  integrations,
  actions,
  onProgressBarChange,
  onStatus,
  onPlaybackError,
}) {
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
        height={360}
        isActive
        paused={false}
        startTime={startTime}
        controls={{ playPause: true, mute: true, fullscreen: true }}
        actions={actions}
        onProgressBarChange={onProgressBarChange}
        showBrightnessControl={showBrightnessControl}
        showVolumeControl={showVolumeControl}
        onBrightnessChangeEnd={onBrightnessChangeEnd}
        onVolumeChangeEnd={onVolumeChangeEnd}
        onError={reportPlaybackError}
        onPlaying={() => onStatus('Playing')}
      />
    );
  }

  return (
    <CineCrewPlayer
      key={active.url}
      source={source}
      title={active.title}
      startTime={startTime}
      showBrightnessControl={showBrightnessControl}
      showVolumeControl={showVolumeControl}
      onBrightnessChangeEnd={onBrightnessChangeEnd}
      onVolumeChangeEnd={onVolumeChangeEnd}
      poster={active.poster}
      mediaId={active.id}
      autoPlay
      muted
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
      onError={reportPlaybackError}
    />
  );
}
