import { useEffect, useRef } from 'react';
import flvjs from 'flv.js';

const isFlvSource = (url, type) => /flv/i.test(String(type || ''))
  || /\.flv(?:$|[?#])/i.test(String(url || ''))
  || /^(?:ws|wss):/i.test(String(url || ''));

function attemptPlayback(video, pausedRef, onAutoplayBlockedRef) {
  if (pausedRef.current) return;
  const playResult = video.play();
  playResult?.catch?.((error) => {
    if (error?.name !== 'NotAllowedError') return;
    // Autoplay may be blocked until a user gesture. Keep the requested audio
    // state intact and expose the player's normal Play control for that gesture.
    video.pause();
    pausedRef.current = true;
    onAutoplayBlockedRef.current?.();
  });
}

export function useWebFlvPlayback({
  activeUrl,
  type,
  isLive,
  videoRef,
  pausedRef,
  onErrorRef,
  onBufferingRef,
  onAutoplayBlocked,
}) {
  const useFlv = Boolean(isFlvSource(activeUrl, type));
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  onAutoplayBlockedRef.current = onAutoplayBlocked;

  useEffect(() => {
    if (!useFlv || !activeUrl || typeof window === 'undefined') return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    const flv = flvjs?.default || flvjs;
    if (!flv?.isSupported?.()) {
      onErrorRef.current?.({ message: 'FLV playback is not supported in this browser.' });
      return undefined;
    }

    let disposed = false;
    let playbackErrorReported = false;
    let specificCodecErrorReported = false;
    let player;
    const handleCanPlay = () => {
      onBufferingRef?.current?.(false);
      attemptPlayback(video, pausedRef, onAutoplayBlockedRef);
    };
    const handleWaiting = () => onBufferingRef?.current?.(true);
    const handleVideoError = () => {
      if (disposed || specificCodecErrorReported || video.readyState >= 2) return;
      const mediaError = video.error;
      onBufferingRef?.current?.(false);
      onErrorRef.current?.({
        message: mediaError?.message || 'The browser could not decode the FLV stream.',
        err: mediaError,
      });
    };

    try {
      player = flv.createPlayer({
        type: 'flv',
        url: activeUrl,
        isLive: Boolean(isLive),
        hasVideo: true,
      }, {
        // flv.js's worker bundle is webpack-specific and can fail to initialize
        // under consumer bundlers such as Vite/Metro. Inline transmuxing is
        // reliable for this bounded remux operation and matches the package's
        // default behavior.
        enableWorker: false,
        enableStashBuffer: true,
        stashInitialSize: isLive ? 384 * 1024 : 1024 * 1024,
        lazyLoad: false,
        autoCleanupSourceBuffer: Boolean(isLive),
      });

      player.on(flv.Events.ERROR, (errorType, errorDetail, errorInfo) => {
        if (disposed || specificCodecErrorReported) return;
        const details = [errorType, errorDetail, errorInfo?.msg, errorInfo?.message]
          .filter(Boolean)
          .join(' ');
        const unsupportedAudio = /unsupported codec in audio frame|unsupported audio codec|audio.*(?:unsupported|not supported)|(?:unsupported|not supported).*audio/i.test(details);
        const unsupportedVideo = /unsupported codec in video frame|unsupported.*video|video.*(?:unsupported|not supported).*codec/i.test(details);
        // flv.js rejects individual audio packets with codecs other than AAC
        // and MP3, but can continue transmuxing the remaining supported audio
        // and video packets. Don't turn a skippable packet into a fatal player
        // error or disable the stream's supported audio track.
        if (unsupportedAudio && !unsupportedVideo) return;
        if (playbackErrorReported && !unsupportedAudio && !unsupportedVideo) return;
        playbackErrorReported = true;
        specificCodecErrorReported = unsupportedAudio || unsupportedVideo;
        const status = Number(errorInfo?.code || errorInfo?.status);
        const httpStatus = Number.isFinite(status) && status >= 100 ? status : null;
        const message = httpStatus
          ? `FLV stream request failed (HTTP ${httpStatus}).`
          : unsupportedAudio
            ? 'This FLV audio codec is not supported by the browser player. Use AAC or MP3 audio in the FLV stream.'
            : unsupportedVideo
              ? 'This FLV video codec is not supported by the browser player. Use H.264/AVC video in the FLV stream.'
              : `FLV playback failed (${String(errorDetail || errorType || 'unknown error')}).`;
        onBufferingRef?.current?.(false);
        onErrorRef.current?.({ message, httpStatus, err: errorInfo || { errorType, errorDetail } });
      });

      video.crossOrigin = 'anonymous';
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('error', handleVideoError);
      player.attachMediaElement(video);
      player.load();
      attemptPlayback(video, pausedRef, onAutoplayBlockedRef);
    } catch (error) {
      onBufferingRef?.current?.(false);
      onErrorRef.current?.({
        message: error?.message || 'Failed to initialize FLV playback.',
        err: error,
      });
    }

    return () => {
      disposed = true;
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('error', handleVideoError);
      if (!player) return;
      try { player.pause(); } catch {}
      try { player.unload(); } catch {}
      try { player.detachMediaElement(); } catch {}
      try { player.destroy(); } catch {}
    };
  }, [activeUrl, isLive, useFlv, videoRef, pausedRef, onErrorRef, onBufferingRef]);

  return useFlv;
}
