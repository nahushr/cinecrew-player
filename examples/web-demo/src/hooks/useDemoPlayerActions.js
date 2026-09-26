import { useMemo } from 'react';

export function useDemoPlayerActions({ notify, setSelectedAudioTrack }) {
  return useMemo(() => ({
    onPlayPause: ({ isPlaying }) => {
      notify(isPlaying ? 'Play' : 'Pause', isPlaying ? 'Playback started' : 'Playback paused');
    },
    onMute: ({ muted }) => {
      notify('Audio', muted ? 'Muted' : 'Unmuted');
    },
    onAspectRatioChange: ({ aspectRatio }) => {
      notify('Aspect ratio', `Changed to ${aspectRatio}`);
    },
    onPlaybackRateChange: ({ playbackRate }) => {
      notify('Playback speed', `${playbackRate}×`);
    },
    onAudioOnlyChange: ({ enabled }) => {
      notify('Audio-only mode', enabled ? 'On' : 'Off');
    },
    onAudioTrackChange: ({ trackId }) => {
      setSelectedAudioTrack(trackId);
      notify('Audio track', trackId === 'test-1' ? 'Test 1' : 'Test 2');
    },
    onRestart: () => {
      notify('Play from beginning', 'Playback restarted');
    },
    onFullscreen: ({ isFullscreen }) => {
      notify('Fullscreen', isFullscreen ? 'On' : 'Off');
    },
    onLiveChatOpen: ({ isOpen }) => {
      notify('Live chat drawer', isOpen ? 'Opened' : 'Closed');
    },
    onEpgOpen: ({ isOpen }) => {
      notify('EPG drawer', isOpen ? 'Opened' : 'Closed');
    },
    onDiagnosticsOpen: ({ isOpen }) => {
      notify('Diagnostics drawer', isOpen ? 'Opened' : 'Closed');
    },
  }), [notify, setSelectedAudioTrack]);
}
