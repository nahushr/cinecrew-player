import { useEffect, useState } from 'react';
import flvjs from 'flv.js';

const isFlvSource = (url, type) => /flv/i.test(String(type || ''))
  || /\.flv(?:$|[?#])/i.test(String(url || ''))
  || /^(?:ws|wss):/i.test(String(url || ''));

function attemptPlayback(video, pausedRef) {
  if (pausedRef.current) return;
  const playResult = video.play();
  playResult?.catch?.((error) => {
    if (error?.name === 'NotAllowedError') {
      video.muted = true;
      video.play()?.catch?.(() => {});
    }
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
}) {
  const useFlv = Boolean(isFlvSource(activeUrl, type));
  const [audioDisabledForUrl, setAudioDisabledForUrl] = useState('');
  const disableAudio = useFlv && audioDisabledForUrl === activeUrl;

  useEffect(() => {
    setAudioDisabledForUrl('');
  }, [activeUrl]);

  useEffect(() => {
    if (!useFlv || !activeUrl || typeof window === 'undefined') return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    if (!flvjs.isSupported()) {
      onErrorRef.current?.({ message: 'FLV playback is not supported in this browser.' });
      return undefined;
    }

    let disposed = false;
    let player;
    const handleCanPlay = () => {
      onBufferingRef?.current?.(false);
      attemptPlayback(video, pausedRef);
    };
    const handleWaiting = () => onBufferingRef?.current?.(true);

    try {
      player = flvjs.createPlayer({
        type: 'flv',
        url: activeUrl,
        isLive: Boolean(isLive),
        hasAudio: !disableAudio,
        hasVideo: true,
      }, {
        enableWorker: true,
        enableStashBuffer: true,
        stashInitialSize: isLive ? 384 * 1024 : 1024 * 1024,
        lazyLoad: false,
        autoCleanupSourceBuffer: Boolean(isLive),
      });

      player.on(flvjs.Events.ERROR, (errorType, errorDetail, errorInfo) => {
        if (disposed) return;
        const details = [errorType, errorDetail, errorInfo?.msg, errorInfo?.message]
          .filter(Boolean)
          .join(' ');
        if (!disableAudio && /codecunsupported|unsupported codec/i.test(details)) {
          setAudioDisabledForUrl(activeUrl);
          return;
        }
        const status = Number(errorInfo?.code || errorInfo?.status);
        const httpStatus = Number.isFinite(status) && status >= 100 ? status : null;
        const message = httpStatus
          ? `FLV stream request failed (HTTP ${httpStatus}).`
          : `FLV playback failed (${String(errorDetail || errorType || 'unknown error')}).`;
        onBufferingRef?.current?.(false);
        onErrorRef.current?.({ message, httpStatus, err: errorInfo || { errorType, errorDetail } });
      });

      video.crossOrigin = 'anonymous';
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('waiting', handleWaiting);
      player.attachMediaElement(video);
      player.load();
      attemptPlayback(video, pausedRef);
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
      if (!player) return;
      try { player.pause(); } catch {}
      try { player.unload(); } catch {}
      try { player.detachMediaElement(); } catch {}
      try { player.destroy(); } catch {}
    };
  }, [activeUrl, disableAudio, isLive, useFlv, videoRef, pausedRef, onErrorRef, onBufferingRef]);

  return useFlv;
}
