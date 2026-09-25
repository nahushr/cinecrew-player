import {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

function sendProgress(player, onProgress) {
  if (typeof onProgress !== 'function') return;
  const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0;
  const currentTime = Number.isFinite(player.currentTime) && player.currentTime > 0 ? player.currentTime : 0;
  onProgress({ currentTime: currentTime * 1000, duration: duration * 1000, target: currentTime });
}

function handleReadyStatus(player, callbacks) {
  callbacks.onPlaying?.();
  callbacks.onBuffering?.(false);
  if (!callbacks.paused) callbacks.withActivePlayer((activePlayer) => activePlayer.play());
  callbacks.onTracksChanged?.({ audioTracks: player.audioTracks ? Array.from(player.audioTracks) : [] });
  sendProgress(player, callbacks.onProgress);
}

function notifyPlayerStatus(event, callbacks) {
  const { status, error } = event;
  if (status === 'readyToPlay') {
    handleReadyStatus(callbacks.player, callbacks);
    return;
  }
  if (status === 'loading' || status === 'idle') {
    callbacks.onBuffering?.(true);
    return;
  }
  if (status === 'error') callbacks.onError?.({ message: 'Failed to load stream.', error });
}

/**
 * Native fallback player (expo-video) used when the VLC native module is not
 * registered — e.g. running inside Expo Go, where react-native-vlc-media-player
 * is not bundled. Mirrors the imperative API + events MediaPlayerView expects.
 */
export const ExoVideoFallback = forwardRef(function ExoVideoFallback(
  {
    streamUrl,
    paused,
    muted,
    volume = 100,
    playbackRate = 1,
    videoAspectRatio,
    onProgress,
    onPlaying,
    onBuffering,
    onEnded,
    onError,
    onTracksChanged,
    audioTrack,
    audioOnly = false,
  },
  ref
) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [contentFit, setContentFit] = useState('contain');
  const [boxStyle, setBoxStyle] = useState(undefined);

  const effectiveStreamUrl = streamUrl || '';
  const player = useVideoPlayer(effectiveStreamUrl, (p) => {
    p.loop = false;
    p.muted = !!muted;
    p.volume = Math.max(0, Math.min(1, (volume ?? 100) / 100));
    p.playbackRate = playbackRate;
    p.staysActiveInBackground = !!audioOnly;
    p.showNowPlayingNotification = !!audioOnly;
    if (audioOnly) {
      p.audioMixingMode = 'doNotMix';
    }
    // iOS default is 0, which disables timeUpdate events entirely.
    p.timeUpdateEventInterval = 0.5;
  });

  // useVideoPlayer owns the native shared object and releases it during its
  // cleanup. Mark the player inactive in the layout cleanup (before passive
  // effects are torn down) so no command can race that release.
  const activePlayerRef = useRef(null);
  useLayoutEffect(() => {
    activePlayerRef.current = player;
    return () => {
      if (activePlayerRef.current === player) {
        activePlayerRef.current = null;
      }
    };
  }, [player]);

  const withActivePlayer = useCallback(
    (operation) => {
      if (activePlayerRef.current !== player) return;

      try {
        const result = operation(player);
        // Expo's native implementation is typed as void, but some versions
        // return a rejected promise when a shared object is released during a
        // native transition. Never let that become an unhandled render error.
        if (result && typeof result.catch === 'function') {
          result.catch(() => {});
        }
      } catch {
        // The hook may release the native object between the active check and
        // the command. Teardown is best-effort and must remain idempotent.
      }
    },
    [player],
  );

  useEffect(() => {
    withActivePlayer((activePlayer) => {
      if (paused) {
        activePlayer.pause();
      } else {
        activePlayer.play();
      }
    });
  }, [paused, withActivePlayer]);

  useEffect(() => {
    withActivePlayer((activePlayer) => {
      activePlayer.muted = !!muted;
      activePlayer.volume = Math.max(0, Math.min(1, (volume ?? 100) / 100));
    });
  }, [muted, volume, withActivePlayer]);

  useEffect(() => {
    withActivePlayer((activePlayer) => {
      activePlayer.playbackRate = playbackRate;
    });
  }, [playbackRate, withActivePlayer]);

  useEffect(() => {
    withActivePlayer((activePlayer) => {
      activePlayer.staysActiveInBackground = !!audioOnly;
      activePlayer.showNowPlayingNotification = !!audioOnly;
      if (audioOnly) {
        activePlayer.audioMixingMode = 'doNotMix';
      }
    });
  }, [audioOnly, withActivePlayer]);

  // Apply track selections natively
  useEffect(() => {
    if (audioTrack === undefined || audioTrack === null) return;

    withActivePlayer((activePlayer) => {
      if (activePlayer.audioTracks) {
        activePlayer.audioTracks.forEach((t) => {
          t.selected = t.id === audioTrack;
        });
      }
    });
  }, [audioTrack, withActivePlayer]);

  const applyAspect = useCallback(
    (aspect) => {
      let fit = 'contain';
      let style;

      if (aspect === 'FILL_SCREEN' || aspect === 'FILL') {
        fit = 'cover';
      } else if (aspect === 'STRETCH') {
        fit = 'fill';
      } else if (aspect === 'CENTER') {
        fit = 'none';
      } else if (typeof aspect === 'string' && aspect.includes(':')) {
        const parts = aspect.split(':');
        const ratio = Number(parts[0]) / Number(parts[1]);
        if (Number.isFinite(ratio) && ratio > 0 && windowWidth > 0 && windowHeight > 0) {
          const boxHeight = windowWidth / ratio;
          const dims = boxHeight <= windowHeight ? { width: '100%' } : { height: '100%' };
          fit = 'fill';
          style = { aspectRatio: ratio, ...dims };
        }
      }

      setContentFit(fit);
      setBoxStyle(style);
    },
    [windowWidth, windowHeight]
  );

  useEffect(() => {
    applyAspect(videoAspectRatio);
  }, [videoAspectRatio, applyAspect]);

  useEffect(() => {
    if (activePlayerRef.current !== player) return undefined;

    let offs;
    try {
      offs = [
        player.addListener('timeUpdate', (event) => {
          if (activePlayerRef.current !== player) return;

          let cur = 0;
          if (Number.isFinite(event?.currentTime)) {
            cur = event.currentTime;
          } else if (Number.isFinite(player.currentTime)) {
            cur = player.currentTime;
          }
          const dur = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0;
          if (typeof onProgress === 'function') {
            onProgress({
              currentTime: cur * 1000,
              duration: dur * 1000,
              target: cur,
            });
          }
        }),
        player.addListener('playingChange', ({ isPlaying }) => {
          if (activePlayerRef.current !== player) return;
          if (isPlaying && typeof onBuffering === 'function') onBuffering(false);
        }),
        player.addListener('statusChange', (event) => {
          if (activePlayerRef.current !== player) return;
          notifyPlayerStatus(event, {
            player,
            paused,
            onPlaying,
            onBuffering,
            onTracksChanged,
            onProgress,
            onError,
            withActivePlayer,
          });
        }),
        player.addListener('playToEnd', () => {
          if (activePlayerRef.current === player && typeof onEnded === 'function') onEnded();
        }),
      ];
    } catch {
      // The shared object can be released while React is replacing the view.
      // There is nothing left to unsubscribe in that case.
      return undefined;
    }

    return () =>
      offs.forEach((off) => {
        try {
          if (typeof off === 'function') {
            off();
          } else if (off && typeof off.remove === 'function') {
            off.remove();
          }
        } catch {
          // Listener cleanup is also best-effort after native release.
        }
      });
  }, [
    player,
    paused,
    onProgress,
    onPlaying,
    onBuffering,
    onEnded,
    onError,
    onTracksChanged,
    withActivePlayer,
  ]);

  // Safety net: keep progress flowing even if the timeUpdate event is
  // unreliable in Expo Go.
  useEffect(() => {
    const id = setInterval(() => {
      if (activePlayerRef.current !== player) return;

      let cur = 0;
      let dur = 0;
      try {
        cur = Number.isFinite(player.currentTime) ? player.currentTime : 0;
        dur = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0;
      } catch {
        return;
      }
      if (typeof onProgress === 'function') {
        onProgress({
          currentTime: cur * 1000,
          duration: dur * 1000,
          target: cur,
        });
      }
    }, 500);
    return () => clearInterval(id);
  }, [player, onProgress]);

  useImperativeHandle(ref, () => ({
    seek(ratio) {
      withActivePlayer((activePlayer) => {
        if (activePlayer.duration && Number.isFinite(activePlayer.duration) && activePlayer.duration > 0) {
          activePlayer.currentTime = Math.max(0, Math.min(1, ratio)) * activePlayer.duration;
        }
      });
    },
    changeVideoAspectRatio(aspect) {
      applyAspect(aspect);
    },
  }), [applyAspect, withActivePlayer]);

  return (
    <View style={boxStyle || styles.video}>
      {/* TextureView is required here because the player is resized and
          layered under the in-app PiP overlay. */}
      <VideoView
        player={player}
        style={styles.video}
        contentFit={contentFit}
        surfaceType="textureView"
        nativeControls={false}
        allowsFullscreen={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
  },
});
