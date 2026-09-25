import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

const PLAYER_STAGE_ID = 'cinecrew-electron-vlc-stage';

function getElectronIpcRenderer() {
  if (typeof window === 'undefined' || typeof window.require !== 'function') return null;
  try {
    return window.require('electron')?.ipcRenderer || null;
  } catch {
    return null;
  }
}

export const ElectronVideoPlayer = forwardRef(function ElectronVideoPlayer({
  streamUrl,
  paused,
  muted,
  volume = 100,
  playbackRate = 1,
  audioTrack,
  videoAspectRatio,
  isLive,
  audioOnly = false,
  onProgress,
  onPlaying,
  onPlaybackStateChange,
  onBuffering,
  onError,
  onEnded,
  onTracksChanged,
  onPlaybackRoute,
  onClose,
}, ref) {
  const ipcRef = useRef(null);
  const mountPromiseRef = useRef(null);
  const latestPropsRef = useRef(null);
  const sourceRef = useRef('');
  const tracksRef = useRef([]);
  const stageRef = useRef(null);

  latestPropsRef.current = {
    onProgress,
    onPlaying,
    onPlaybackStateChange,
    onBuffering,
    onError,
    onEnded,
    onTracksChanged,
    onPlaybackRoute,
    onClose,
    paused,
    muted,
    volume,
    playbackRate,
    audioTrack,
    audioOnly,
  };

  const invokePlayer = useCallback(async (channel, payload) => {
    const ipc = ipcRef.current;
    const mounted = mountPromiseRef.current;
    if (!ipc || !mounted) return null;
    try {
      const mountResult = await mounted;
      if (!mountResult?.ok) return null;
      const result = await ipc.invoke(channel, payload);
      if (result?.ok === false) throw new Error(result.error || 'Electron VLC request failed.');
      return result;
    } catch (error) {
      latestPropsRef.current?.onError?.(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }, []);

  const handleNativeEvent = useCallback((_event, payload = {}) => {
    const callbacks = latestPropsRef.current || {};
    switch (payload.type) {
      case 'progress':
        callbacks.onProgress?.(payload);
        break;
      case 'playing': {
        const audioTracks = Array.isArray(payload.audioTracks) ? payload.audioTracks : [];
        tracksRef.current = audioTracks;
        callbacks.onPlaybackStateChange?.(true);
        callbacks.onTracksChanged?.({ audioTracks });
        callbacks.onPlaying?.({ audioTracks });
        callbacks.onBuffering?.(false);
        break;
      }
      case 'paused':
        callbacks.onPlaybackStateChange?.(false);
        break;
      case 'tracks': {
        const audioTracks = Array.isArray(payload.audioTracks) ? payload.audioTracks : [];
        tracksRef.current = audioTracks;
        callbacks.onTracksChanged?.({ audioTracks });
        break;
      }
      case 'buffering':
        callbacks.onBuffering?.(!!payload.isBuffering);
        break;
      case 'ended':
        callbacks.onEnded?.();
        break;
      case 'error':
        callbacks.onError?.(new Error(payload.message || 'libVLC could not play this stream.'));
        break;
      case 'route':
        callbacks.onPlaybackRoute?.(payload.url || '');
        break;
      case 'close':
        callbacks.onClose?.();
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    const ipc = getElectronIpcRenderer();
    if (!ipc) {
      latestPropsRef.current?.onError?.(new Error('CineCrew’s bundled VLC player is available only in the Electron app.'));
      return undefined;
    }

    let disposed = false;
    let layoutFrame = null;
    const requestLayoutSync = () => {
      if (layoutFrame !== null) return;
      layoutFrame = requestAnimationFrame(() => {
        layoutFrame = null;
        ipc.send('cinecrew:vlc:layout');
      });
    };

    ipcRef.current = ipc;
    ipc.on('cinecrew:vlc:event', handleNativeEvent);
    const mountPromise = ipc.invoke('cinecrew:vlc:mount', {
      container: `#${PLAYER_STAGE_ID}`,
    }).then((result) => {
      if (!result?.ok) throw new Error(result?.error || 'Could not initialize CineCrew’s bundled VLC player.');
      if (disposed) void ipc.invoke('cinecrew:vlc:unmount').catch(() => {});
      return result;
    }).catch((error) => {
      if (!disposed) {
        latestPropsRef.current?.onBuffering?.(false);
        latestPropsRef.current?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
      return { ok: false };
    });
    mountPromiseRef.current = mountPromise;

    window.addEventListener('scroll', requestLayoutSync, true);
    window.addEventListener('resize', requestLayoutSync);
    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined' && stageRef.current) {
      resizeObserver = new ResizeObserver(requestLayoutSync);
      resizeObserver.observe(stageRef.current);
    }

    return () => {
      disposed = true;
      window.removeEventListener('scroll', requestLayoutSync, true);
      window.removeEventListener('resize', requestLayoutSync);
      resizeObserver?.disconnect();
      if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
      ipc.removeListener('cinecrew:vlc:event', handleNativeEvent);
      ipcRef.current = null;
      mountPromiseRef.current = null;
      void ipc.invoke('cinecrew:vlc:unmount').catch(() => {});
    };
  }, [handleNativeEvent]);

  useEffect(() => {
    let cancelled = false;
    if (!streamUrl) return undefined;

    const loadSource = async () => {
      try {
        // Electron uses VLC and should receive the provider URL directly. The
        // Worker redirect resolver is a browser-only compatibility path.
        const source = streamUrl;
        if (!source || cancelled) return;
        sourceRef.current = source;
        latestPropsRef.current?.onBuffering?.(true);
        const result = await invokePlayer('cinecrew:vlc:load', {
          source,
          isLive: !!isLive,
          paused: latestPropsRef.current?.paused === true,
          muted: latestPropsRef.current?.muted === true,
          volume: latestPropsRef.current?.volume,
          playbackRate: latestPropsRef.current?.playbackRate,
          audioOnly: latestPropsRef.current?.audioOnly === true,
        });
        if (!cancelled && result?.ok === true) {
          latestPropsRef.current?.onPlaybackRoute?.(source);
        }
      } catch (error) {
        if (!cancelled) {
          latestPropsRef.current?.onBuffering?.(false);
          latestPropsRef.current?.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };

    void loadSource();
    return () => {
      cancelled = true;
    };
  }, [streamUrl, isLive, invokePlayer]);

  useEffect(() => {
    void invokePlayer('cinecrew:vlc:set-paused', paused);
  }, [paused, invokePlayer]);

  useEffect(() => {
    void invokePlayer('cinecrew:vlc:set-volume', { muted, volume });
  }, [muted, volume, invokePlayer]);

  useEffect(() => {
    void invokePlayer('cinecrew:vlc:set-rate', playbackRate);
  }, [playbackRate, invokePlayer]);

  useEffect(() => {
    if (audioTrack !== null && audioTrack !== undefined) {
      void invokePlayer('cinecrew:vlc:set-audio-track', audioTrack);
    }
  }, [audioTrack, invokePlayer]);

  useEffect(() => {
    void invokePlayer('cinecrew:vlc:set-audio-only', audioOnly);
  }, [audioOnly, invokePlayer]);

  useEffect(() => {
    void invokePlayer('cinecrew:vlc:set-aspect-ratio', videoAspectRatio);
  }, [videoAspectRatio, invokePlayer]);

  useImperativeHandle(ref, () => ({
    seek(ratio) {
      return invokePlayer('cinecrew:vlc:seek', Math.max(0, Math.min(1, Number(ratio) || 0)));
    },
    seekTo(seconds) {
      return invokePlayer('cinecrew:vlc:seek-to', Math.max(0, Number(seconds) || 0) * 1000);
    },
    reload() {
      return invokePlayer('cinecrew:vlc:seek-to', 0);
    },
    changeVideoAspectRatio(aspect) {
      return invokePlayer('cinecrew:vlc:set-aspect-ratio', aspect);
    },
    setAudioTrack(trackId) {
      return invokePlayer('cinecrew:vlc:set-audio-track', trackId);
    },
    getAudioTracks() {
      return tracksRef.current;
    },
    async requestPictureInPicture() {
      return null;
    },
    async exitPictureInPicture() {
      return null;
    },
    getVideoElement() {
      return null;
    },
  }), [invokePlayer]);

  return (
    <View
      ref={stageRef}
      nativeID={PLAYER_STAGE_ID}
      collapsable={false}
      pointerEvents="none"
      style={styles.stage}
    />
  );
});

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
});
