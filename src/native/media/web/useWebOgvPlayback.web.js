import { useEffect, useRef } from 'react';

const DEFAULT_OGV_RESOURCE_BASE = 'https://cdn.jsdelivr.net/npm/ogv@1.9.0/dist';
const ogvRuntimePromises = new Map();

function normalizeResourceBase(value) {
  const base = String(value || DEFAULT_OGV_RESOURCE_BASE).trim();
  let lastNonSlash = base.length;
  while (lastNonSlash > 0 && base[lastNonSlash - 1] === '/') {
    lastNonSlash -= 1;
  }
  return base.slice(0, lastNonSlash);
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

function readCustomRatio(playerStyle) {
  if (playerStyle?.width !== 'auto' || playerStyle?.height !== 'auto') return null;
  const parts = String(playerStyle.aspectRatio || '').split('/').map(Number);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const ratio = parts[0] / parts[1];
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

function applyPlayerStyle(stage, frame, player, playerStyle) {
  if (!stage?.style || !frame?.style || !player?.style) return;

  const style = playerStyle || {};
  const ratio = readCustomRatio(style);
  const stageWidth = stage.clientWidth;
  const stageHeight = stage.clientHeight;

  Object.assign(stage.style, {
    overflow: 'hidden',
    backgroundColor: style.backgroundColor || '#000',
  });

  // OGVPlayer has no intrinsic CSS size. Applying width/height:auto directly
  // to it collapses its canvas in browsers. Size a wrapper from the measured
  // stage instead, keeping the decoder element itself at 100% of that frame.
  if (ratio && stageWidth > 0 && stageHeight > 0) {
    const frameWidth = Math.min(stageWidth, stageHeight * ratio);
    const frameHeight = frameWidth / ratio;
    Object.assign(frame.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      right: 'auto',
      bottom: 'auto',
      transform: 'translate(-50%, -50%)',
      width: `${frameWidth}px`,
      height: `${frameHeight}px`,
      maxWidth: '100%',
      maxHeight: '100%',
      aspectRatio: style.aspectRatio,
      opacity: style.opacity == null ? '1' : String(style.opacity),
      backgroundColor: style.backgroundColor || '#000',
      overflow: 'hidden',
    });
  } else {
    Object.assign(frame.style, {
      position: 'absolute',
      inset: '0',
      left: '0',
      top: '0',
      right: '0',
      bottom: '0',
      transform: 'none',
      width: '100%',
      height: '100%',
      maxWidth: 'none',
      maxHeight: 'none',
      aspectRatio: 'auto',
      opacity: style.opacity == null ? '1' : String(style.opacity),
      backgroundColor: style.backgroundColor || '#000',
      overflow: 'hidden',
    });
  }

  // Only the wrapper owns custom ratio geometry. Reset it from the decoder
  // element so switching between custom ratios and FIT never leaves stale CSS.
  Object.assign(player.style, {
    position: 'relative',
    inset: 'auto',
    left: 'auto',
    top: 'auto',
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
    maxWidth: 'none',
    maxHeight: 'none',
    aspectRatio: 'auto',
    width: '100%',
    height: '100%',
    display: 'block',
    visibility: 'visible',
    objectFit: style.objectFit || 'contain',
    backgroundColor: style.backgroundColor || '#000',
    opacity: '1',
  });
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
  const playerFrameRef = useRef(null);
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
    let playerFrame = null;
    let resizeObserver = null;
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
    const handleResize = () => {
      applyPlayerStyle(container, playerFrame, player, playerStyleRef.current);
    };

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
        playerFrame = document.createElement('div');
        playerFrame.className = 'cinecrew-player__ogv-frame';
        playerFrameRef.current = playerFrame;
        playerFrame.appendChild(player);
        applyPlayerStyle(container, playerFrame, player, playerStyleRef.current);
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(handleResize);
          resizeObserver.observe(container);
        } else {
          window.addEventListener('resize', handleResize);
        }
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
        container.replaceChildren(playerFrame);
        videoRef.current = player;
        player.src = activeUrl;
        if (!options.paused) attemptPlayback(player, pausedRef);
      })
      .catch(reportError);

    return () => {
      disposed = true;
      onBufferingRef?.current?.(false);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);
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
      if (playerFrameRef.current === playerFrame) playerFrameRef.current = null;
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
    applyPlayerStyle(
      playerContainerRef.current,
      playerFrameRef.current,
      videoRef.current,
      playerStyleRef.current,
    );
  }, [useOgv, playerContainerRef, videoRef, playerStyleKey]);

  return useOgv;
}
