import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { WEB_NO_PROXY_URL_CODE, WEB_NO_PROXY_URL_MESSAGE } from './web/webPlaybackErrors';

import { useWebMediaSession } from './web/useWebMediaSession';
import { useWebVideoAspectRatio } from './web/useWebVideoAspectRatio';
import { useWebMpegTsPlayback } from './web/useWebMpegTsPlayback';
import { useWebHlsPlayback } from './web/useWebHlsPlayback';
import { useWebAc3AudioPlayback } from './web/useWebAc3AudioPlayback';

export const WebVideoPlayer = forwardRef(({
  streamUrl,
  paused,
  muted,
  volume = 100,
  playbackRate = 1,
  videoAspectRatio,
  title,
  posterUrl,
  isLive,
  audioOnly = false,
  videoOnly = false,
  webProxyAvailable,
  webPlaybackError,
  onProgress,
  onPlaying,
  onBuffering,
  onError,
  onEnded,
  onTogglePlayPause,
  onSeekBy,
  onPlaybackRoute,
}, ref) => {
  const videoRef = useRef(null);
  const pausedRef = useRef(paused);
  const playbackRateRef = useRef(playbackRate);
  const lastKnownPosRef = useRef(0);
  const onPlaybackRouteRef = useRef(onPlaybackRoute);
  const onPlayingRef = useRef(onPlaying);
  const onBufferingRef = useRef(onBuffering);
  const onErrorRef = useRef(onError);
  const playbackErrorRef = useRef(onError);
  const onEndedRef = useRef(onEnded);
  const [activeUrl, setActiveUrl] = useState('');
  pausedRef.current = paused;
  playbackRateRef.current = playbackRate;
  onPlaybackRouteRef.current = onPlaybackRoute;
  onPlayingRef.current = onPlaying;
  onBufferingRef.current = onBuffering;
  onErrorRef.current = onError;
  onEndedRef.current = onEnded;

  const handlePlaybackError = useCallback((error) => {
    onErrorRef.current?.(error);
  }, []);
  playbackErrorRef.current = handlePlaybackError;

  const mpegTsPlayback = useWebMpegTsPlayback({
    streamUrl,
    activeUrl,
    isLive,
    videoOnly,
    videoRef,
    pausedRef,
    onErrorRef: playbackErrorRef,
    onBufferingRef,
  });
  const useMpegTsSource = mpegTsPlayback.useMpegTs;
  const useAc3Fallback = mpegTsPlayback.useAc3Fallback;
  const useHlsSource = useWebHlsPlayback({
    activeUrl,
    isLive,
    videoRef,
    pausedRef,
    onErrorRef: playbackErrorRef,
  });
  const ac3Audio = useWebAc3AudioPlayback({
    active: useAc3Fallback,
    streamUrl: activeUrl,
    enabled: !muted,
    paused,
    volume,
    videoRef,
  });

  // 1. Aspect Ratio Styling
  const { videoStyle, applyAspectRatio } = useWebVideoAspectRatio(videoAspectRatio, audioOnly);

  // Report active streaming route
  const reportPlaybackRoute = useCallback((video, attachedUrl) => {
    const emit = onPlaybackRouteRef.current;
    if (typeof emit !== 'function') return;
    const current = video?.currentSrc || video?.src || '';
    const httpCurrent = /^https?:/i.test(current) && !current.startsWith('blob:') ? current : '';
    const raw = httpCurrent || attachedUrl || '';
    if (raw) emit(raw);
  }, []);

  // Progress emitter
  const emitProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const curTime = video.currentTime || 0;
    const duration = video.duration || 0;

    if (Number.isFinite(curTime)) {
      lastKnownPosRef.current = curTime;
    }

    if (typeof onProgress === 'function') {
      onProgress({
        currentTime: curTime * 1000,
        duration: (Number.isFinite(duration) && duration > 0 ? duration : 0) * 1000,
        target: curTime,
      });
    }
  }, [onProgress]);

  // The host supplies a playable URL. Provider-specific resolution stays out
  // of the player so the same package works with any backend.
  useEffect(() => {
    if (!streamUrl) {
      setActiveUrl('');
      return undefined;
    }
    if (isLive && (webProxyAvailable === false || webPlaybackError)) {
      setActiveUrl('');
      onErrorRef.current?.({
        code: WEB_NO_PROXY_URL_CODE,
        blockPlayback: true,
        message: typeof webPlaybackError === 'string'
          ? webPlaybackError
          : webPlaybackError?.message || WEB_NO_PROXY_URL_MESSAGE,
      });
      return undefined;
    }
    setActiveUrl(streamUrl);
    return undefined;
  }, [isLive, streamUrl, webProxyAvailable, webPlaybackError]);

  // MediaSession API
  useWebMediaSession({
    title,
    posterUrl,
    isLive,
    paused,
    videoRef,
    pausedRef,
    lastKnownPosRef,
    onTogglePlayPause,
    onSeekBy,
  });

  // Sync play/pause prop changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      video.pause();
    } else if (
      video.dataset.mpegtsCodecGate !== 'pending'
      && video.paused
      && (video.src || video.currentSrc)
    ) {
      video.play().catch(() => {});
    }
  }, [paused, activeUrl]);

  // Gain and volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.muted = muted;
      video.volume = Math.max(0, Math.min(1, (volume ?? 100) / 100));
    } catch {}

  }, [muted, volume, activeUrl]);

  // Playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playbackRate) {
      try {
        video.playbackRate = playbackRate;
      } catch {}
    }
  }, [playbackRate, activeUrl]);

  // Imperative handle for parent component control
  useImperativeHandle(ref, () => ({
    reload() {
      const video = videoRef.current;
      if (video && activeUrl) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    },
    seek(ratio) {
      const video = videoRef.current;
      if (!video) return;
      const duration = video.duration || 0;
      if (Number.isFinite(duration) && duration > 0) {
        video.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
      }
    },
    seekTo(seconds) {
      const video = videoRef.current;
      if (!video || !Number.isFinite(seconds)) return;
      video.currentTime = seconds;
    },
    changeVideoAspectRatio(aspect) {
      applyAspectRatio(aspect);
    },
    async requestPictureInPicture() {
      const video = videoRef.current;
      if (video && typeof video.requestPictureInPicture === 'function' && typeof document !== 'undefined' && document.pictureInPictureEnabled) {
        return await video.requestPictureInPicture();
      }
      return null;
    },
    async exitPictureInPicture() {
      if (typeof document !== 'undefined' && document.pictureInPictureElement && typeof document.exitPictureInPicture === 'function') {
        return await document.exitPictureInPicture();
      }
      return null;
    },
    getVideoElement() {
      return videoRef.current;
    },
    activateAudio(nextVolume) {
      return ac3Audio.activateAudio(nextVolume);
    },
    deactivateAudio() {
      ac3Audio.deactivateAudio();
    },
  }));

  return (
    <View style={styles.container} collapsable={false}>
      {activeUrl ? (
        <video
          key={activeUrl}
          ref={videoRef}
          data-resolved-scheme={activeUrl ? new URL(activeUrl, 'http://localhost').protocol.replace(':', '') : ''}
          data-stream-mode={useHlsSource ? 'hls' : useMpegTsSource ? 'mpegts' : 'native'}
          src={useMpegTsSource || useHlsSource ? undefined : activeUrl}
          autoPlay={!paused}
          muted={muted}
          playsInline
          controls={false}
          style={videoStyle}
          onPlaying={() => {
            const video = videoRef.current;
            reportPlaybackRoute(video, activeUrl);
            onPlayingRef.current?.();
            onBufferingRef.current?.(false);
            emitProgress();
          }}
          onWaiting={() => {
            onBufferingRef.current?.(true);
          }}
          onPause={() => {
            onBufferingRef.current?.(false);
          }}
          onTimeUpdate={emitProgress}
          onLoadedMetadata={() => {
            emitProgress();
            reportPlaybackRoute(videoRef.current, activeUrl);
          }}
          onEnded={() => {
            onEndedRef.current?.();
          }}
          onCanPlay={() => {
            const video = videoRef.current;
            if (video && video.dataset.mpegtsCodecGate !== 'pending' && !pausedRef.current && video.paused) {
              video.play().catch(() => {});
            }
          }}
          onError={(e) => {
            const video = videoRef.current;
            const mediaError = video?.error;
            if (!video?.src && !video?.currentSrc) {
              return;
            }
            if (video && video.readyState >= 2) {
              return;
            }
            playbackErrorRef.current?.({
              message: mediaError?.message || 'Failed to load stream.',
              err: mediaError || e,
            });
          }}
        >
        </video>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
