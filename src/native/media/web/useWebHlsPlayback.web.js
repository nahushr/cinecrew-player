import { useEffect } from 'react';
import Hls from 'hls.js';

const isHlsUrl = (url) => /\.m3u8(?:$|[?#])/i.test(String(url || ''));

export function useWebHlsPlayback({ activeUrl, isLive, videoRef, pausedRef, onErrorRef }) {
  const useHls = Boolean(isHlsUrl(activeUrl));

  useEffect(() => {
    if (!useHls || !activeUrl || typeof window === 'undefined') return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let hls;
    let disposed = false;
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 1000,
        manifestLoadingMaxRetryTimeout: 8000,
        levelLoadingTimeOut: 8000,
        levelLoadingMaxRetry: 2,
        levelLoadingRetryDelay: 1000,
        levelLoadingMaxRetryTimeout: 8000,
        fragLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1000,
        fragLoadingMaxRetryTimeout: 15000,
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (disposed || !data?.fatal) return;
        const status = Number(data?.response?.code || data?.response?.status);
        const httpStatus = Number.isFinite(status) && status >= 100 ? status : null;
        const message = httpStatus
          ? `Stream request failed (HTTP ${httpStatus}).`
          : `HLS playback failed (${String(data?.details || data?.type || 'unknown error')}).`;
        onErrorRef.current?.({ message, httpStatus, err: data });
      });
      hls.loadSource(activeUrl);
      video.crossOrigin = 'anonymous';
      hls.attachMedia(video);
      const attemptPlay = () => {
        if (pausedRef.current) return;
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (err?.name === 'NotAllowedError') {
              video.muted = true;
              video.play().catch(() => {});
            }
          });
        }
      };
      hls.on(Hls.Events.MANIFEST_PARSED, attemptPlay);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = activeUrl;
      video.load();
      if (!pausedRef.current) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (err?.name === 'NotAllowedError') {
              video.muted = true;
              video.play().catch(() => {});
            }
          });
        }
      }
    } else {
      onErrorRef.current?.({ message: 'This browser does not support HLS playback.' });
    }

    return () => {
      disposed = true;
      if (hls) {
        hls.destroy();
      } else if (video.src === activeUrl) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [activeUrl, useHls, videoRef, pausedRef, onErrorRef]);

  return useHls;
}
