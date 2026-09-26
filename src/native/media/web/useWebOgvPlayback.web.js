import { useEffect, useRef } from 'react';

const DEFAULT_OGV_RESOURCE_BASE = 'https://cdn.jsdelivr.net/npm/ogv@1.9.0/dist';
const ogvRuntimePromises = new Map();

function normalizeResourceBase(value) {
  const base = String(value || DEFAULT_OGV_RESOURCE_BASE).trim();
  return base.replace(/\/+$/, '');
}

function loadOgvRuntime(resourceBase) {
  if (window.OGVPlayer && window.OGVLoader) {
    return Promise.resolve({
      OGVPlayer: window.OGVPlayer,
      OGVLoader: window.OGVLoader,
      OGVCompat: window.OGVCompat,
    });
  }

  const scriptUrl = `${resourceBase}/ogv.js`;
  if (ogvRuntimePromises.has(scriptUrl)) return ogvRuntimePromises.get(scriptUrl);

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.dataset.cinecrewOgvRuntime = 'true';
    script.onload = () => {
      if (!window.OGVPlayer || !window.OGVLoader) {
        reject(new Error('The OGV runtime loaded but did not expose OGVPlayer.'));
        return;
      }
      resolve({
        OGVPlayer: window.OGVPlayer,
        OGVLoader: window.OGVLoader,
        OGVCompat: window.OGVCompat,
      });
    };
    script.onerror = () => reject(new Error(`Could not load the OGV runtime from ${scriptUrl}.`));
    document.head.appendChild(script);
  });

  ogvRuntimePromises.set(scriptUrl, promise);
  promise.catch(() => ogvRuntimePromises.delete(scriptUrl));
  return promise;
}

const isOgvSource = (url, type) => /(?:^|\/)video\/ogg(?:$|;)/i.test(String(type || ''))
  || /\bogv\b/i.test(String(type || ''))
  || /\.ogv(?:$|[?#])/i.test(String(url || ''));

function attemptPlayback(player, pausedRef) {
  if (pausedRef.current) return;
  const result = player.play();
  result?.catch?.((error) => {
    if (error?.name === 'NotAllowedError') {
      player.muted = true;
      player.play()?.catch?.(() => {});
    }
  });
}

function applyPlayerStyle(player, playerStyle) {
  if (!player?.style) return;

  // Ratio geometry belongs on the OGV video itself, not the full-size stage.
  // Reset previous custom geometry so switching back to FIT also restores it.
  [
    'position', 'inset', 'left', 'top', 'right', 'bottom', 'transform',
    'maxWidth', 'maxHeight', 'aspectRatio',
  ].forEach((key) => { player.style[key] = ''; });
  Object.assign(player.style, {
    width: '100%',
    height: '100%',
    display: 'block',
    visibility: 'visible',
    objectFit: 'contain',
    backgroundColor: '#000',
    opacity: '',
  });
  Object.assign(player.style, playerStyle || {});
}

/**
 * Use ogv.js for Ogg/Theora media on web, while keeping the returned media-like
 * player in videoRef so the shared controls, progress, and recording logic work.
 */
export function useWebOgvPlayback({
  activeUrl,
  type,
  videoRef,
  playerContainerRef,
  playerStyle,
  pausedRef,
  onErrorRef,
  onBufferingRef,
  resourceBase,
  paused = true,
  muted = false,
  volume = 1,
  playbackRate = 1,
  videoOnly = false,
  onProgressRef,
  onPlayingRef,
  onEndedRef,
  onPlaybackRouteRef,
}) {
  const useOgv = Boolean(isOgvSource(activeUrl, type));
  const playbackOptionsRef = useRef({ paused, muted, volume, playbackRate, videoOnly });
  playbackOptionsRef.current = { paused, muted, volume, playbackRate, videoOnly };
  const playerStyleRef = useRef(playerStyle);
  playerStyleRef.current = playerStyle;
  const playerStyleKey = JSON.stringify(playerStyle || {});

  useEffect(() => {
    if (!useOgv || !activeUrl || typeof window === 'undefined') return undefined;
    const container = playerContainerRef.current;
    if (!container) return undefined;

    let disposed = false;
    let player = null;
    const reportError = (error) => {
      if (disposed) return;
      onBufferingRef?.current?.(false);
      onErrorRef.current?.({
        message: error?.message || 'OGV playback failed. The browser could not decode this Ogg/Theora stream.',
        err: error,
      });
    };
    const handleWaiting = () => onBufferingRef?.current?.(true);
    const handleReady = () => {
      onBufferingRef?.current?.(false);
      onProgressRef?.current?.();
      onPlaybackRouteRef?.current?.(activeUrl);
      attemptPlayback(player, pausedRef);
    };
    const handlePlaying = () => {
      onBufferingRef?.current?.(false);
      onPlayingRef?.current?.();
    };
    const handleTimeUpdate = () => onProgressRef?.current?.();
    const handleEnded = () => onEndedRef?.current?.();
    const handleError = (event) => reportError(event?.error || event);

    onBufferingRef?.current?.(true);
    const resolvedBase = normalizeResourceBase(resourceBase);
    loadOgvRuntime(resolvedBase)
      .then(({ OGVPlayer, OGVLoader, OGVCompat }) => {
        if (disposed) return;
        if (!OGVPlayer || (OGVCompat?.supported && !OGVCompat.supported('OGVPlayer'))) {
          throw new Error('OGV playback is not supported in this browser (WebAssembly and Web Audio are required).');
        }

        OGVLoader.base = resolvedBase;
        player = new OGVPlayer({
          base: resolvedBase,
          worker: true,
        });
        player.className = 'cinecrew-player__video';
        applyPlayerStyle(player, playerStyleRef.current);
        const options = playbackOptionsRef.current;
        player.muted = Boolean(options.muted || options.videoOnly);
        player.volume = Math.max(0, Math.min(1, Number(options.volume) || 0));
        player.playbackRate = Number(options.playbackRate) || 1;
        player.preload = 'auto';

        player.addEventListener('waiting', handleWaiting);
        player.addEventListener('loadstart', handleWaiting);
        player.addEventListener('loadedmetadata', handleReady);
        player.addEventListener('canplay', handleReady);
        player.addEventListener('playing', handlePlaying);
        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('ended', handleEnded);
        player.addEventListener('error', handleError);
        container.replaceChildren(player);
        videoRef.current = player;
        player.src = activeUrl;
        if (!options.paused) attemptPlayback(player, pausedRef);
      })
      .catch(reportError);

    return () => {
      disposed = true;
      onBufferingRef?.current?.(false);
      if (player) {
        player.removeEventListener('waiting', handleWaiting);
        player.removeEventListener('loadstart', handleWaiting);
        player.removeEventListener('loadedmetadata', handleReady);
        player.removeEventListener('canplay', handleReady);
        player.removeEventListener('playing', handlePlaying);
        player.removeEventListener('timeupdate', handleTimeUpdate);
        player.removeEventListener('ended', handleEnded);
        player.removeEventListener('error', handleError);
        try { player.pause(); } catch {}
        try { player.src = ''; } catch {}
        try { player.remove(); } catch {}
        if (videoRef.current === player) videoRef.current = null;
      }
    };
  }, [activeUrl, useOgv, playerContainerRef, videoRef, pausedRef, onErrorRef, onBufferingRef, resourceBase, onProgressRef, onPlayingRef, onEndedRef, onPlaybackRouteRef]);

  useEffect(() => {
    if (!useOgv) return;
    const player = videoRef.current;
    if (!player) return;
    player.muted = Boolean(muted || videoOnly);
    player.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    player.playbackRate = Number(playbackRate) || 1;
    if (paused) player.pause();
    else attemptPlayback(player, pausedRef);
  }, [activeUrl, useOgv, videoRef, pausedRef, paused, muted, volume, playbackRate, videoOnly]);

  useEffect(() => {
    if (!useOgv) return;
    applyPlayerStyle(videoRef.current, playerStyleRef.current);
  }, [useOgv, videoRef, playerStyleKey]);

  return useOgv;
}
