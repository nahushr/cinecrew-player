import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildYouTubePlayerHtml } from '../../utils/youtubeHtml';

const stateName = (value) => ({ 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'cued' })[value] || 'unstarted';

export const YouTubeVideoPlayer = forwardRef(function YouTubeVideoPlayer({
  videoId,
  paused = false,
  muted = false,
  volume = 1,
  playbackRate = 1,
  onReady,
  onProgress,
  onPlaying,
  onBuffering,
  onStateChange,
  onError,
  onEnded,
}, ref) {
  const webViewRef = useRef(null);
  const handlersRef = useRef({});
  const latestPropsRef = useRef({});
  const readyRef = useRef(false);
  handlersRef.current = { onReady, onProgress, onPlaying, onBuffering, onStateChange, onError, onEnded };
  latestPropsRef.current = { paused, muted, volume, playbackRate };

  const sendCommand = useCallback((name, value) => {
    const serialized = JSON.stringify(value ?? null);
    webViewRef.current?.injectJavaScript(
      `window.cinecrewPlayerCommand && window.cinecrewPlayerCommand(${JSON.stringify(name)}, ${serialized}); true;`
    );
  }, []);

  const handleMessage = useCallback((event) => {
    let message;
    try { message = JSON.parse(event.nativeEvent.data); } catch { return; }
    const handlers = handlersRef.current;
    if (message.type === 'ready') {
      readyRef.current = true;
      handlers.onBuffering?.(false);
      handlers.onReady?.({ youtube: true });
      const latest = latestPropsRef.current;
      sendCommand(latest.paused ? 'pause' : 'play');
      sendCommand(latest.muted ? 'mute' : 'unmute');
      sendCommand('volume', Math.round(Math.max(0, Math.min(1, latest.volume)) * 100));
      sendCommand('rate', latest.playbackRate);
      return;
    }
    if (message.type === 'state') {
      const state = stateName(Number(message.data?.state));
      handlers.onStateChange?.(state);
      handlers.onBuffering?.(state === 'buffering');
      if (state === 'playing') handlers.onPlaying?.({ state, youtube: true });
      if (state === 'ended') handlers.onEnded?.();
      return;
    }
    if (message.type === 'progress') {
      const currentTime = Number(message.data?.currentTime) || 0;
      const duration = Number(message.data?.duration) || 0;
      handlers.onProgress?.({ currentTime: currentTime * 1000, duration: duration * 1000, target: currentTime });
      return;
    }
    if (message.type === 'error') {
      handlers.onError?.({ code: message.data?.code, message: `YouTube playback failed (${message.data?.code}).` });
    }
  }, [sendCommand]);

  useEffect(() => { if (readyRef.current) sendCommand(paused ? 'pause' : 'play'); }, [paused, sendCommand]);
  useEffect(() => {
    if (!readyRef.current) return;
    sendCommand(muted ? 'mute' : 'unmute');
    sendCommand('volume', Math.round(Math.max(0, Math.min(1, volume)) * 100));
  }, [muted, volume, sendCommand]);
  useEffect(() => { if (readyRef.current) sendCommand('rate', playbackRate); }, [playbackRate, sendCommand]);

  const validVideoId = /^[\w-]{11}$/.test(String(videoId || ''));
  const html = useMemo(
    () => validVideoId ? buildYouTubePlayerHtml(videoId, !paused) : '<!doctype html><html><body style="background:#000"></body></html>',
    [validVideoId, videoId],
  );
  const webViewSource = useMemo(() => ({ html, baseUrl: 'https://www.youtube.com' }), [html]);

  useEffect(() => {
    if (!validVideoId) handlersRef.current.onError?.(new Error('A valid YouTube video ID is required.'));
  }, [validVideoId]);

  useImperativeHandle(ref, () => ({
    play: () => sendCommand('play'),
    resume: () => sendCommand('play'),
    pause: () => sendCommand('pause'),
    seek: (ratio) => sendCommand('seekRatio', Math.max(0, Math.min(1, Number(ratio) || 0))),
    seekTo: (seconds) => sendCommand('seek', Math.max(0, Number(seconds) || 0)),
    getVideoElement: () => null,
  }), [sendCommand]);

  return React.createElement(View, { style: styles.container }, React.createElement(WebView, {
    ref: webViewRef,
    source: webViewSource,
    originWhitelist: ['*'],
    javaScriptEnabled: true,
    domStorageEnabled: true,
    allowsInlineMediaPlayback: true,
    mediaPlaybackRequiresUserAction: false,
    allowsFullscreenVideo: false,
    scrollEnabled: false,
    bounces: false,
    onMessage: handleMessage,
    onError: (event) => handlersRef.current.onError?.(event.nativeEvent || event),
    style: styles.webView,
  }));
});

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  webView: { flex: 1, backgroundColor: '#000' },
});

export default YouTubeVideoPlayer;
