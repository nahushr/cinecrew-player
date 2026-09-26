import { useEffect, useRef, useState } from 'react';
import '../../../../vendor/mpegts.js/mpegts.js';
import {
  WEB_AC3_UNSUPPORTED_CODE,
  WEB_AC3_UNSUPPORTED_MESSAGE,
} from './webPlaybackErrors';

const getMpegts = () => (typeof globalThis !== 'undefined' && globalThis.mpegts
  ? globalThis.mpegts
  : (typeof window !== 'undefined' && window.mpegts ? window.mpegts : undefined));

const initialMpegts = getMpegts();
if (initialMpegts?.LoggingControl) {
  initialMpegts.LoggingControl.enableAll = false;
}

const isRawLiveTransportStream = (url) => {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url, 'http://localhost');
    return /\.ts$/i.test(parsed.pathname)
      || (/\/live\//i.test(parsed.pathname) && !/\.m3u8$/i.test(parsed.pathname));
  } catch {
    return /\/live\/.*\.ts(?:\?|$)/i.test(url);
  }
};

const isFlvStream = (url) => {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url, 'http://localhost');
    return /\.flv$/i.test(parsed.pathname) || /^(?:ws|wss):/i.test(url);
  } catch {
    return /\.flv(?:$|[?#])/i.test(url) || /^(?:ws|wss):/i.test(url);
  }
};

const isHlsUrl = (url) => /\.m3u8(?:$|[?#])/i.test(String(url || ''));

function containsAc3Codec(value) {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized.includes('ac3') || normalized.includes('dolby');
}

function buildRetryFailureMessage(message) {
  const detail = message ? ` (${message})` : '';
  return 'The live stream connection failed after 3 reconnect attempts' + detail + '.';
}

function redactStreamDetails(value) {
  return String(value || '')
    .replace(/https?:\/\/\S+/gi, '[stream endpoint]')
    .replace(/\/live\/[^?#\s]*/gi, '/live/[redacted]');
}

function isTransientStreamFailure(detailCode, status) {
  return detailCode === 'Exception'
    || /NetworkError|Timeout/i.test(detailCode)
    || [408, 425, 429].includes(status)
    || status >= 500;
}

function formatStreamFailure({ detailCode, status, isTransient, recoveryAttempts, message }) {
  if (detailCode === 'HttpStatusCodeInvalid') {
    if (Number.isFinite(status) && status > 0) return `Stream request failed (HTTP ${status}).`;
    return 'Stream request failed with an unreadable HTTP response.';
  }
  if (isTransient && recoveryAttempts >= 3) return buildRetryFailureMessage(message);
  const prefix = detailCode || 'Failed to load live stream.';
  return message ? `${prefix}: ${message}` : prefix;
}

function createErrorContext(type, detail, info, player) {
  const detailCode = String(detail || type || '');
  const mediaSourceMessage = String(info?.msg || info?.message || '');
  const codecText = [
    detailCode,
    mediaSourceMessage,
    player?.mediaInfo?.audioCodec,
    player?.mediaInfo?.mimeType,
  ].filter(Boolean).join(' ');
  const status = Number(info?.code);
  return {
    detailCode,
    mediaSourceMessage,
    isAc3: containsAc3Codec(codecText),
    status,
    isTransient: isTransientStreamFailure(detailCode, status),
  };
}

export function useWebMpegTsPlayback({
  streamUrl,
  activeUrl,
  isLive,
  videoOnly = false,
  videoRef,
  pausedRef,
  onErrorRef,
  onBufferingRef,
}) {
  const [unavailableForUrl, setUnavailableForUrl] = useState('');
  const [ac3FallbackForUrl, setAc3FallbackForUrl] = useState('');
  const ac3FallbackForUrlRef = useRef('');
  const isFlv = isFlvStream(streamUrl) || isFlvStream(activeUrl);
  const isRawTs = isRawLiveTransportStream(streamUrl) || isRawLiveTransportStream(activeUrl);
  const useMpegTs = !isFlv && isRawTs
    && !isHlsUrl(activeUrl)
    && unavailableForUrl !== streamUrl;
  const useVideoOnly = useMpegTs && videoOnly;
  const useAc3Fallback = useMpegTs && !useVideoOnly && ac3FallbackForUrl === streamUrl;

  useEffect(() => {
    setUnavailableForUrl('');
    ac3FallbackForUrlRef.current = '';
    setAc3FallbackForUrl('');
  }, [streamUrl]);

  useEffect(() => {
    if (!activeUrl || !useMpegTs || typeof window === 'undefined') return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    let disposed = false;
    let blockedByAudioCodec = false;
    let player;
    const previousVideoVisibility = video.style.visibility;
    let recoveryTimer = null;
    let recoveryAttempts = 0;
    let recoveryPending = false;
    let stallWatchdog = null;
    let stablePlaybackTimer = null;
    let lastPlaybackProgressAt = Date.now();
    let lastPlaybackTime = Number(video.currentTime) || 0;
    let handleCanPlay = null;

    const clearStablePlaybackTimer = () => {
      if (stablePlaybackTimer) {
        clearTimeout(stablePlaybackTimer);
        stablePlaybackTimer = null;
      }
    };

    const notePlaybackProgress = () => {
      const currentTime = Number(video.currentTime) || 0;
      if (currentTime < lastPlaybackTime - 1) {
        lastPlaybackTime = currentTime;
        lastPlaybackProgressAt = Date.now();
        return;
      }
      if (currentTime <= lastPlaybackTime + 0.05) return;
      lastPlaybackTime = currentTime;
      lastPlaybackProgressAt = Date.now();
      if (stablePlaybackTimer || recoveryAttempts === 0) return;
      stablePlaybackTimer = setTimeout(() => {
        stablePlaybackTimer = null;
        if (!disposed && !pausedRef.current && video.readyState >= 2
          && Date.now() - lastPlaybackProgressAt < 2500) {
          recoveryAttempts = 0;
        }
      }, 15000);
    };

    const scheduleRecovery = (message, httpStatus = null, error = null) => {
      if (disposed || recoveryPending || pausedRef.current || !player) return;
      if (recoveryAttempts >= 3) {
        onErrorRef.current?.({
          message: buildRetryFailureMessage(message),
          httpStatus,
          err: error,
        });
        return;
      }

      clearStablePlaybackTimer();
      const delayMs = [500, 1200, 2500][recoveryAttempts];
      recoveryAttempts += 1;
      recoveryPending = true;
      lastPlaybackProgressAt = Date.now();
      onBufferingRef.current?.(true);
      recoveryTimer = setTimeout(() => {
        recoveryTimer = null;
        recoveryPending = false;
        if (disposed || !player || pausedRef.current) return;
        try {
          player.unload();
          player.load();
          lastPlaybackTime = Number(video.currentTime) || 0;
          lastPlaybackProgressAt = Date.now();
          const playResult = player.play();
          playResult?.catch?.(() => {});
        } catch (recoveryError) {
          onErrorRef.current?.({
            message: recoveryError?.message || 'Could not reconnect to the live stream.',
            err: recoveryError,
          });
        }
      }, delayMs);
    };
    const handlePlaying = () => {
      lastPlaybackProgressAt = Date.now();
      if (recoveryAttempts > 0 && !stablePlaybackTimer) {
        stablePlaybackTimer = setTimeout(() => {
          stablePlaybackTimer = null;
          if (!disposed && !pausedRef.current && video.readyState >= 2
            && Date.now() - lastPlaybackProgressAt < 2500) {
            recoveryAttempts = 0;
          }
        }, 15000);
      }
    };
    const handleWaiting = () => onBufferingRef.current?.(true);

    const blockAc3Playback = () => {
      if (disposed || blockedByAudioCodec) return;
      blockedByAudioCodec = true;
      video.dataset.mpegtsCodecGate = 'blocked';
      video.style.visibility = 'hidden';
      video.pause();
      onBufferingRef.current?.(false);
      try {
        player?.pause();
      } catch {
        // The media engine may already have been disposed.
      }
      try {
        player?.unload();
      } catch {
        // The media engine may already have been disposed.
      }
      onErrorRef.current?.({
        code: WEB_AC3_UNSUPPORTED_CODE,
        blockPlayback: true,
        message: WEB_AC3_UNSUPPORTED_MESSAGE,
      });
    };

    const handleMediaInfo = (info) => {
      const codecSummary = [info?.audioCodec, info?.mimeType].filter(Boolean).join(' ');
      if (containsAc3Codec(codecSummary)) {
        blockAc3Playback();
        return;
      }
      delete video.dataset.mpegtsCodecGate;
      if (!pausedRef.current && player) {
        const playResult = player.play();
        playResult?.catch?.((err) => {
          if (err?.name === 'NotAllowedError') {
            video.muted = true;
            player.play()?.catch?.(() => {});
          }
        });
      }
    };

    try {
      const mpegts = getMpegts();
      if (!mpegts?.isSupported()) {
        setUnavailableForUrl(streamUrl);
        return undefined;
      }

      player = mpegts.createPlayer({
        type: isFlv ? 'flv' : 'mpegts',
        url: activeUrl,
        isLive: Boolean(isLive),
        hasAudio: !useAc3Fallback && !useVideoOnly,
        hasVideo: true,
      }, {
        enableWorker: !useVideoOnly,
        lazyLoad: false,
        enableStashBuffer: true,
        stashInitialSize: useVideoOnly ? 2048 : (isLive ? 512 * 1024 : 1024 * 1024),
        liveBufferLatencyChasing: Boolean(isLive && !useVideoOnly),
        liveBufferLatencyMaxLatency: 8,
        liveBufferLatencyMinRemain: 3,
        autoCleanupSourceBuffer: Boolean(isLive),
        autoCleanupMaxBackwardDuration: useVideoOnly ? 120 : 30,
        autoCleanupMinBackwardDuration: useVideoOnly ? 60 : 15,
        disableAudio: useAc3Fallback || useVideoOnly,
      });
      video.autoplay = false;
      if (!isFlv) {
        video.dataset.mpegtsCodecGate = 'pending';
      } else {
        delete video.dataset.mpegtsCodecGate;
      }
      player.on(mpegts.Events.MEDIA_INFO, handleMediaInfo);
      handleCanPlay = () => {
        delete video.dataset.mpegtsCodecGate;
        if (!pausedRef.current && player) {
          const playResult = player.play();
          playResult?.catch?.((err) => {
            if (err?.name === 'NotAllowedError') {
              video.muted = true;
              player.play()?.catch?.(() => {});
            }
          });
        }
      };
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('timeupdate', notePlaybackProgress);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('waiting', handleWaiting);

      player.on(mpegts.Events.ERROR, (type, detail, info) => {
        if (disposed || recoveryPending || blockedByAudioCodec) return;
        const errorContext = createErrorContext(type, detail, info, player);
        const { detailCode, mediaSourceMessage, status, isTransient } = errorContext;
        if (errorContext.isAc3) {
          if (isLive) {
            blockAc3Playback();
            return;
          }
          if (ac3FallbackForUrlRef.current !== streamUrl) {
            ac3FallbackForUrlRef.current = streamUrl;
            setAc3FallbackForUrl(streamUrl);
          }
          return;
        }
        const safeMediaSourceMessage = redactStreamDetails(mediaSourceMessage);
        if (isTransient && recoveryAttempts < 3) {
          scheduleRecovery(safeMediaSourceMessage || detailCode, status, info || detail || type);
          return;
        }
        const message = formatStreamFailure({
          detailCode,
          status,
          isTransient,
          recoveryAttempts,
          message: safeMediaSourceMessage,
        });
        onErrorRef.current?.({
          message,
          httpStatus: Number.isFinite(status) && status > 0 ? status : null,
          err: info || detail || type,
        });
      });
      player.attachMediaElement(video);
      player.load();
      if (!pausedRef.current) {
        const playResult = player.play();
        playResult?.catch?.((err) => {
          if (err?.name === 'NotAllowedError') {
            video.muted = true;
            player.play()?.catch?.(() => {});
          }
        });
      }
      stallWatchdog = setInterval(() => {
        if (disposed || pausedRef.current || recoveryPending || video.currentTime <= 0) return;
        if (Date.now() - lastPlaybackProgressAt >= 12000) {
          scheduleRecovery('playback stalled');
        }
      }, 3000);
    } catch (error) {
      setUnavailableForUrl(streamUrl);
      onErrorRef.current?.({ message: error?.message || 'Failed to initialize live playback.', err: error });
    }

    return () => {
      disposed = true;
      if (recoveryTimer) clearTimeout(recoveryTimer);
      if (stallWatchdog) clearInterval(stallWatchdog);
      clearStablePlaybackTimer();
      if (handleCanPlay) video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', notePlaybackProgress);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('waiting', handleWaiting);
      delete video.dataset.mpegtsCodecGate;
      video.autoplay = !pausedRef.current;
      video.style.visibility = previousVideoVisibility;
      if (!player) return;
      try {
        player.pause();
      } catch {
        // The media engine may already be disposed.
      }
      try {
        player.unload();
      } catch {
        // The media engine may already be disposed.
      }
      try {
        player.detachMediaElement();
      } catch {
        // The media engine may already be disposed.
      }
      try {
        player.destroy();
      } catch {
        // The media engine may already be disposed.
      }
    };
  }, [activeUrl, useMpegTs, useAc3Fallback, useVideoOnly, streamUrl, videoRef, pausedRef, onErrorRef, onBufferingRef]);

  return { useMpegTs, useAc3Fallback, isFlv };
}
