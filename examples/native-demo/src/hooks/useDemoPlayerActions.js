import { useMemo } from 'react';

export function useDemoPlayerActions({ notify, setSelectedAudioTrack, onFullscreenChange }) {
  return useMemo(() => ({
    onBack: ({ title }) => {
      notify('Back', title ? `Back pressed for ${title}` : 'Back pressed');
    },
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
    onFullscreen: (payload) => {
      const isFullscreen = typeof payload === 'boolean' ? payload : (payload?.isFullscreen ?? true);
      notify('Fullscreen', isFullscreen ? 'On' : 'Off');
      onFullscreenChange?.(isFullscreen);
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
  }), [notify, setSelectedAudioTrack, onFullscreenChange]);
}
