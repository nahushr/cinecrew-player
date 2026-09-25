import React, { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import ReactNative from 'react-native';
import PropTypes from 'prop-types';
import resolveAssetSource from 'react-native/Libraries/Image/resolveAssetSource';

const { StyleSheet, requireNativeComponent, View, UIManager } = ReactNative;

const VLCPlayer = forwardRef(function VLCPlayer(props, forwardedRef) {
  const {
    autoplay = true,
    source: sourceProp,
    repeat,
    onBuffering,
    onError,
    onOpen,
    onLoadStart,
    onProgress,
    onEnd,
    onStopped,
    onPaused,
    onPlaying,
    onLoad,
    onRecordingCreated,
    onSnapshot,
    ...otherProps
  } = props;
  const rootRef = useRef(null);
  const lastRecordingRef = useRef(null);

  useImperativeHandle(forwardedRef, () => {
    const dispatchCommand = (command, args) => {
      const viewTag = ReactNative.findNodeHandle(rootRef.current);
      if (viewTag == null) return;
      const manager = UIManager.getViewManagerConfig('RCTVLCPlayer');
      const commandId = manager?.Commands?.[command];
      if (commandId == null) return;
      UIManager.dispatchViewManagerCommand(viewTag, commandId, args);
    };
    const setNativeProps = (nativeProps) => rootRef.current?.setNativeProps?.(nativeProps);

    return {
      setNativeProps,
      startRecording: (path) => dispatchCommand('startRecording', [path]),
      stopRecording: () => dispatchCommand('stopRecording', []),
      stopPlayer: () => dispatchCommand('stopPlayer', []),
      snapshot: (path) => dispatchCommand('snapshot', [path]),
      seek: (position) => setNativeProps({ seek: position }),
      resume: (shouldResume) => setNativeProps({ resume: shouldResume }),
      autoAspectRatio: (isAuto) => setNativeProps({ autoAspectRatio: isAuto }),
      changeVideoAspectRatio: (ratio) => setNativeProps({ videoAspectRatio: ratio }),
      _onStopped: () => {
        setNativeProps({ paused: true });
        onStopped?.();
      },
    };
  }, [onStopped]);

  const handleNativeEvent = useCallback(
    (callback) => (event) => callback?.(event.nativeEvent),
    [],
  );
  const handleStopped = useCallback(
    (event) => {
      rootRef.current?.setNativeProps?.({ paused: true });
      onStopped?.(event.nativeEvent);
    },
    [onStopped],
  );
  const handleRecordingState = useCallback(
    (event) => {
      const { isRecording, recordPath } = event.nativeEvent;
      if (lastRecordingRef.current === recordPath) return;
      if (!isRecording && recordPath) {
        lastRecordingRef.current = recordPath;
        onRecordingCreated?.(recordPath);
      }
    },
    [onRecordingCreated],
  );
  const handleSnapshot = useCallback(
    (event) => {
      if (event.nativeEvent.success) onSnapshot?.(event.nativeEvent);
    },
    [onSnapshot],
  );

  const resolvedSource = resolveAssetSource(sourceProp) || {};
  const source = { ...resolvedSource };
  if (Array.isArray(resolvedSource.initOptions)) {
    source.initOptions = [...resolvedSource.initOptions];
  }

  let uri = source.uri || '';
  if (uri.startsWith('/')) uri = `file://${uri}`;

  let isNetwork = /^https?:/i.test(uri);
  const isAsset = /^(assets-library|file|content|ms-appx|ms-appdata):/i.test(uri);
  if (!isAsset) isNetwork = true;
  if (uri.startsWith('/')) isNetwork = false;
  source.isNetwork = isNetwork;
  source.autoplay = autoplay;
  source.initOptions = source.initOptions || [];

  if (repeat) {
    const hasRepeatOption = source.initOptions.some(
      (item) => item.startsWith('--repeat') || item.startsWith('--input-repeat'),
    );
    if (!hasRepeatOption) source.initOptions.push('--repeat');
  }

  const nativeProps = {
    ...otherProps,
    autoplay,
    repeat,
    style: [styles.base, otherProps.style],
    source,
    src: {
      uri,
      isNetwork,
      isAsset,
      type: source.type || '',
      mainVer: source.mainVer || 0,
      patchVer: source.patchVer || 0,
    },
    onVideoLoadStart: handleNativeEvent(onLoadStart),
    onVideoOpen: handleNativeEvent(onOpen),
    onVideoError: handleNativeEvent(onError),
    onVideoProgress: handleNativeEvent(onProgress),
    onVideoEnded: handleNativeEvent(onEnd),
    onVideoEnd: handleNativeEvent(onEnd),
    onVideoPlaying: handleNativeEvent(onPlaying),
    onVideoPaused: handleNativeEvent(onPaused),
    onVideoStopped: handleStopped,
    onVideoBuffering: handleNativeEvent(onBuffering),
    onVideoLoad: handleNativeEvent(onLoad),
    onRecordingState: handleRecordingState,
    onSnapshot: handleSnapshot,
    progressUpdateInterval: onProgress ? 250 : 0,
  };

  return <NativeVLCPlayer ref={rootRef} {...nativeProps} />;
});

VLCPlayer.displayName = 'VLCPlayer';
VLCPlayer.propTypes = {
  rate: PropTypes.number,
  seek: PropTypes.number,
  resume: PropTypes.bool,
  paused: PropTypes.bool,
  autoAspectRatio: PropTypes.bool,
  videoAspectRatio: PropTypes.string,
  volume: PropTypes.number,
  disableFocus: PropTypes.bool,
  src: PropTypes.string,
  playInBackground: PropTypes.bool,
  playWhenInactive: PropTypes.bool,
  resizeMode: PropTypes.string,
  poster: PropTypes.string,
  muted: PropTypes.bool,
  audioTrack: PropTypes.number,
  textTrack: PropTypes.number,
  acceptInvalidCertificates: PropTypes.bool,
  onVideoLoadStart: PropTypes.func,
  onVideoError: PropTypes.func,
  onVideoProgress: PropTypes.func,
  onVideoEnded: PropTypes.func,
  onVideoEnd: PropTypes.func,
  onVideoPlaying: PropTypes.func,
  onVideoPaused: PropTypes.func,
  onVideoStopped: PropTypes.func,
  onVideoBuffering: PropTypes.func,
  onVideoOpen: PropTypes.func,
  onVideoLoad: PropTypes.func,
  onRecordingState: PropTypes.func,
  onSnapshot: PropTypes.func,
  autoplay: PropTypes.bool,
  source: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.string]),
  repeat: PropTypes.bool,
  onBuffering: PropTypes.func,
  onError: PropTypes.func,
  onOpen: PropTypes.func,
  onLoadStart: PropTypes.func,
  onProgress: PropTypes.func,
  onEnd: PropTypes.func,
  onEnded: PropTypes.func,
  onStopped: PropTypes.func,
  onPaused: PropTypes.func,
  onPlaying: PropTypes.func,
  onLoad: PropTypes.func,
  onRecordingCreated: PropTypes.func,
  onSnapshot: PropTypes.func,
  scaleX: PropTypes.number,
  scaleY: PropTypes.number,
  translateX: PropTypes.number,
  translateY: PropTypes.number,
  rotation: PropTypes.number,
  ...View.propTypes,
};

const NativeVLCPlayer = requireNativeComponent('RCTVLCPlayer', VLCPlayer);

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});

export default VLCPlayer;
