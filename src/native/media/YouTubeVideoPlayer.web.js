import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

let youtubeApiPromise;
function loadYouTubeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('YouTube playback requires a browser.'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-cinecrew-youtube-api]');
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        try { previousReady?.(); } catch {}
        resolve(window.YT);
      };
      if (!existing) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.dataset.cinecrewYoutubeApi = 'true';
        script.onerror = () => reject(new Error('Could not load the YouTube player API.'));
        document.head.appendChild(script);
      }
    });
  }
  return youtubeApiPromise;
}

const stateName = (value) => ({ 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' })[value] || 'unstarted';

export const YouTubeVideoPlayer = forwardRef(function YouTubeVideoPlayer({
  videoId,
  paused = false,
  muted = false,
  volume = 1,
  playbackRate = 1,
  onReady,
  onProgress,
  onPlaying,
  onBuffering,
  onStateChange,
  onError,
  onEnded,
}, ref) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const latestPropsRef = useRef({});
  const onReadyRef = useRef(onReady);
  const onProgressRef = useRef(onProgress);
  const onPlayingRef = useRef(onPlaying);
  const onBufferingRef = useRef(onBuffering);
  const onStateChangeRef = useRef(onStateChange);
  const onErrorRef = useRef(onError);
  const onEndedRef = useRef(onEnded);
  const readyRef = useRef(false);
  latestPropsRef.current = { paused, muted, volume, playbackRate };
  const stateRef = useRef('unstarted');
  onReadyRef.current = onReady;
  onProgressRef.current = onProgress;
  onPlayingRef.current = onPlaying;
  onBufferingRef.current = onBuffering;
  onStateChangeRef.current = onStateChange;
  onErrorRef.current = onError;
  onEndedRef.current = onEnded;

  useEffect(() => {
    let cancelled = false;
    let progressTimer;
    let player;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      player = new YT.Player(hostRef.current, {
        width: '100%',
        height: '100%',
        videoId,
        playerVars: {
          autoplay: paused ? 0 : 1,
          controls: 0,
          playsinline: 1,
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          fs: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            playerRef.current = event.target;
            readyRef.current = true;
            const latest = latestPropsRef.current;
            event.target.setVolume(Math.round(Math.max(0, Math.min(1, latest.volume)) * 100));
            if (latest.muted) event.target.mute();
            if (latest.paused) event.target.pauseVideo();
            else event.target.playVideo();
            event.target.setPlaybackRate?.(Number(latest.playbackRate) || 1);
            onBufferingRef.current?.(false);
            onReadyRef.current?.(event.target);
            progressTimer = setInterval(() => {
              const target = playerRef.current;
              if (!target || stateRef.current !== 'playing') return;
              const currentTime = Number(target.getCurrentTime?.()) || 0;
              const duration = Number(target.getDuration?.()) || 0;
              onProgressRef.current?.({ currentTime: currentTime * 1000, duration: duration * 1000, target: currentTime });
            }, 500);
          },
          onStateChange: (event) => {
            const state = stateName(event.data);
            stateRef.current = state;
            onStateChangeRef.current?.(state);
            onBufferingRef.current?.(state === 'buffering');
            if (state === 'playing') onPlayingRef.current?.(event);
            if (state === 'ended') onEndedRef.current?.();
          },
          onError: (event) => onErrorRef.current?.({ code: event.data, message: `YouTube playback failed (${event.data}).` }),
        },
      });
      playerRef.current = player;
    }).catch((error) => {
      if (!cancelled) onErrorRef.current?.(error);
    });
    return () => {
      cancelled = true;
      clearInterval(progressTimer);
      readyRef.current = false;
      try { player?.destroy?.(); } catch {}
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    if (paused) player.pauseVideo?.();
    else player.playVideo?.();
  }, [paused, videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !readyRef.current) return;
    if (muted) player.mute?.();
    else player.unMute?.();
    player.setVolume?.(Math.round(Math.max(0, Math.min(1, volume)) * 100));
  }, [muted, volume, videoId]);

  useEffect(() => {
    if (readyRef.current) playerRef.current?.setPlaybackRate?.(Number(playbackRate) || 1);
  }, [playbackRate, videoId]);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo?.(),
    resume: () => playerRef.current?.playVideo?.(),
    pause: () => playerRef.current?.pauseVideo?.(),
    seek: (ratio) => {
      const player = playerRef.current;
      const duration = Number(player?.getDuration?.()) || 0;
      if (duration > 0) player?.seekTo?.(duration * Math.max(0, Math.min(1, Number(ratio) || 0)), true);
    },
    seekTo: (seconds) => playerRef.current?.seekTo?.(Math.max(0, Number(seconds) || 0), true),
    getVideoElement: () => null,
  }), []);

  return React.createElement('div', {
    ref: hostRef,
    className: 'cinecrew-player__youtube',
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#000' },
  });
});

export default YouTubeVideoPlayer;
