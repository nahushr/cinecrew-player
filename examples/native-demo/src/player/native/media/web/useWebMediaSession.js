import { useEffect } from 'react';
import { isWeb } from '../../../utils/runtimePlatform';

/**
 * Hook to integrate the browser MediaSession API for background audio,
 * OS lock-screen controls, notification media controls, and hardware media keys.
 */
export function useWebMediaSession({
  title,
  posterUrl,
  isLive,
  paused,
  videoRef,
  pausedRef,
  lastKnownPosRef,
  onTogglePlayPause,
  onSeekBy,
}) {
  useEffect(() => {
    if (!isWeb() || typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return undefined;
    }

    try {
      if (typeof window !== 'undefined' && window.MediaMetadata) {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: title || 'Now Playing',
          artist: 'Xtream API Media Player',
          album: isLive ? 'Live TV' : (title || 'Media Stream'),
          artwork: posterUrl
            ? [{ src: posterUrl, sizes: '512x512', type: 'image/jpeg' }]
            : [],
        });
      }

      navigator.mediaSession.playbackState = paused ? 'paused' : 'playing';

      const playHandler = () => {
        if (pausedRef) pausedRef.current = false;
        const video = videoRef?.current;
        if (video) video.play().catch(() => {});
        if (typeof onTogglePlayPause === 'function') onTogglePlayPause(true);
      };

      const pauseHandler = () => {
        if (pausedRef) pausedRef.current = true;
        const video = videoRef?.current;
        if (video) video.pause();
        if (typeof onTogglePlayPause === 'function') onTogglePlayPause(false);
      };

      const seekBackwardHandler = (details) => {
        const skip = details?.seekOffset || 10;
        const video = videoRef?.current;
        if (video && Number.isFinite(video.currentTime)) {
          video.currentTime = Math.max(0, video.currentTime - skip);
          if (lastKnownPosRef) lastKnownPosRef.current = video.currentTime;
        }
        if (typeof onSeekBy === 'function') onSeekBy(-skip);
      };

      const seekForwardHandler = (details) => {
        const skip = details?.seekOffset || 10;
        const video = videoRef?.current;
        if (video && Number.isFinite(video.currentTime)) {
          video.currentTime = Math.min(video.duration || 999999, video.currentTime + skip);
          if (lastKnownPosRef) lastKnownPosRef.current = video.currentTime;
        }
        if (typeof onSeekBy === 'function') onSeekBy(skip);
      };

      navigator.mediaSession.setActionHandler('play', playHandler);
      navigator.mediaSession.setActionHandler('pause', pauseHandler);
      navigator.mediaSession.setActionHandler('seekbackward', seekBackwardHandler);
      navigator.mediaSession.setActionHandler('seekforward', seekForwardHandler);
      navigator.mediaSession.setActionHandler('stop', pauseHandler);

      return () => {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('stop', null);
      };
    } catch (e) {
     String(e);
      return undefined;
    }
  }, [title, posterUrl, isLive, paused, videoRef, pausedRef, lastKnownPosRef, onTogglePlayPause, onSeekBy]);
}
