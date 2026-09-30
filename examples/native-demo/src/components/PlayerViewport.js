import React from 'react';
import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import CineCrewPlayer, { InlineLivePlayer } from '@cinecrew/cinecrew-player';

const demoAudioTracks = [
  { id: 'test-1', name: 'Test 1' },
  { id: 'test-2', name: 'Test 2' },
];

export function PlayerViewport({
  active,
  source,
  drawerMode,
  inline,
  selectedAudioTrack,
  integrations,
  actions,
  onProgressBarChange,
  onStatus,
  onPlaybackError,
}) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [availableWidth, setAvailableWidth] = useState(0);
  // The player lives inside a padded, max-width demo card. Window dimensions
  // can be much wider than that card (especially on desktop/web), so size from
  // the actual content box and only use window height as a landscape limit.
  // Leave room for the player-card padding/border and device safe areas so
  // the whole video/control surface stays on-screen in landscape.
  const landscapeAvailableHeight = Math.max(1, height - 140);
  const measuredWidth = availableWidth || width;
  const landscapeVideoWidth = Math.max(1, Math.min(measuredWidth, landscapeAvailableHeight * (16 / 9)));
  const videoWidth = isLandscape ? landscapeVideoWidth : measuredWidth;
  const videoHeight = Math.max(1, videoWidth * (9 / 16));

  const reportPlaybackError = (error) => {
    onStatus(error?.message || 'Playback error');
    onPlaybackError?.(error);
  };

  if (inline) {
    return (
      <View
        onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
        style={{ width: '100%', alignItems: 'center' }}
      >
        <InlineLivePlayer
          source={source}
          title={active.title}
          height={videoHeight}
          isActive
          paused={false}
          controls={{ playPause: true, mute: true, fullscreen: true }}
          onError={reportPlaybackError}
          onPlaying={() => onStatus('Playing')}
        />
      </View>
    );
  }

  return (
    <View
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
      style={{ width: '100%', alignItems: 'center' }}
    >
      <CineCrewPlayer
        source={source}
        title={active.title}
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
        style={{
          width: isLandscape ? landscapeVideoWidth : '100%',
          height: videoHeight,
          aspectRatio: 16 / 9,
          alignSelf: 'center',
          borderRadius: 14,
        }}
      />
    </View>
  );
}
