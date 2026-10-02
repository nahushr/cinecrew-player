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
  showLiveChat,
  onLiveChatChange,
  playerStyle,
  inlineHeight,
  inline,
  promotedFullscreen,
  onPromotePreview,
  startTime,
  showBrightnessControl,
  brightnessColor,
  onBrightnessChangeEnd,
  showVolumeControl,
  volumeColor,
  onVolumeChangeEnd,
  showLiveBadge,
  selectedAudioTrack,
  integrations,
  actions,
  onProgressBarChange,
  onStatus,
  onPlaybackError,
}, ref) {
  React.useEffect(() => {
    if (inline || !promotedFullscreen || typeof ref === 'function') return undefined;
    let frame;
    let attempts = 0;
    const enterFullscreen = () => {
      const enter = ref?.current?.enterFullscreen;
      if (typeof enter === 'function') {
        enter();
        return;
      }
      attempts += 1;
      if (attempts < 12) frame = requestAnimationFrame(enterFullscreen);
    };
    frame = requestAnimationFrame(enterFullscreen);
    return () => cancelAnimationFrame(frame);
  }, [inline, promotedFullscreen, ref]);

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
        height={inlineHeight}
        isActive
        paused={false}
        style={playerStyle}
        controls={{ liveChat: true, epg: true, diagnostics: true }}
        features={{ diagnostics: true }}
        integrations={integrations}
        drawerMode={drawerMode}
        messagePageSize={5}
        mediaId={active.id}
        showLiveChat={showLiveChat}
        onLiveChatChange={onLiveChatChange}
        onPromotePreview={onPromotePreview}
        startTime={startTime}
        showBrightnessControl={showBrightnessControl}
        brightnessColor={brightnessColor}
        onBrightnessChangeEnd={onBrightnessChangeEnd}
        showVolumeControl={showVolumeControl}
        volumeColor={volumeColor}
        onVolumeChangeEnd={onVolumeChangeEnd}
        showLiveBadge={showLiveBadge}
        actions={actions}
        onProgressBarChange={onProgressBarChange}
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
      startTime={startTime}
      showLiveChat={showLiveChat}
      onLiveChatChange={onLiveChatChange}
      showBrightnessControl={showBrightnessControl}
      brightnessColor={brightnessColor}
      onBrightnessChangeEnd={onBrightnessChangeEnd}
      showVolumeControl={showVolumeControl}
      volumeColor={volumeColor}
      onVolumeChangeEnd={onVolumeChangeEnd}
      showLiveBadge={showLiveBadge}
      poster={active.poster}
      mediaId={active.id}
      autoPlay
      muted
      audioTracks={demoAudioTracks}
      selectedAudioTrack={selectedAudioTrack}
      // All standard controls are on by default; the demo only opts into the
      // optional recorder and liveChat so it can showcase those capabilities too.
      controls={{ recording: true, liveChat: true }}
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
