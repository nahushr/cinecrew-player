import { useEffect } from 'react';

const isDashUrl = (url, type) => {
  if (type && /dash/i.test(type)) return true;
  return /\.mpd(?:$|[?#])/i.test(String(url || ''));
};

export function useWebDashPlayback({
  activeUrl,
  type,
  videoRef,
  pausedRef,
  onErrorRef,
}) {
  const useDash = Boolean(isDashUrl(activeUrl, type));

  useEffect(() => {
    if (!useDash || !activeUrl || typeof window === 'undefined') return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let player = null;
    let disposed = false;

    import('dashjs')
      .then((mod) => {
        if (disposed) return;
        const dashjs = mod.default || mod;
        if (!dashjs || !dashjs.MediaPlayer) {
          onErrorRef.current?.({ message: 'Dash.js is not supported in this browser.' });
          return;
        }

        player = dashjs.MediaPlayer().create();
        video.crossOrigin = 'anonymous';
        player.initialize(video, activeUrl, !pausedRef.current);

        player.on(dashjs.MediaPlayer.events.ERROR, (event) => {
          if (disposed) return;
          const status = Number(event?.error?.data?.response?.status || event?.data?.status);
          const httpStatus = Number.isFinite(status) && status >= 100 ? status : null;
          const errorMsg = httpStatus
            ? `Stream request failed (HTTP ${httpStatus}).`
            : `MPEG-DASH playback failed (${String(event?.error?.message || event?.message || 'playback error')}).`;
          onErrorRef.current?.({ message: errorMsg, httpStatus, err: event });
        });

        const attemptAutoplay = () => {
          if (disposed || pausedRef.current) return;
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

        player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, attemptAutoplay);
        player.on(dashjs.MediaPlayer.events.CAN_PLAY, attemptAutoplay);
      })
      .catch((err) => {
        if (!disposed) {
          onErrorRef.current?.({ message: 'Failed to initialize MPEG-DASH engine.', err });
        }
      });

    return () => {
      disposed = true;
      if (player) {
        try {
          player.destroy();
        } catch {}
      } else if (video.src === activeUrl) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [activeUrl, useDash, videoRef, pausedRef, onErrorRef]);

  return useDash;
}
