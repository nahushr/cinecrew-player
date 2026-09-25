import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useWebVideoAspectRatio } from '../native/media/web/useWebVideoAspectRatio';
import { useWebMpegTsPlayback } from '../native/media/web/useWebMpegTsPlayback.web';
import { useWebHlsPlayback } from '../native/media/web/useWebHlsPlayback.web';
import { useWebAc3AudioPlayback } from '../native/media/web/useWebAc3AudioPlayback.web';
import { YouTubeVideoPlayer } from '../native/media/YouTubeVideoPlayer.web.js';
import { getYouTubeVideoId, getWebRuntimePlatform, useResolvedPlayerSource } from '../utils/sourceUtils';
import { EMOJI_GROUPS, searchEmojis } from '../data/emoji';
import './styles.css';

const h = React.createElement;
const DEFAULT_THEME = {
  accentColor: '#00E5FF',
  backgroundColor: '#050b14',
  controlBackground: 'rgba(5, 11, 20, 0.76)',
  controlColor: '#ffffff',
  surfaceColor: 'rgba(13, 26, 44, 0.96)',
  errorColor: '#ff647c',
  borderRadius: 14,
};
const DEFAULT_ICONS = {
  play: 'play', pause: 'pause', restart: 'restart', lock: 'lock', unlock: 'lock-open',
  mute: 'volume-mute', unmute: 'volume-high', aspectRatio: 'aspect-ratio', videoOnly: 'video',
  audio: 'music-note', audioOnly: 'headphones', back: 'arrow-left', recording: 'record-rec', stop: 'stop',
  liveChat: 'comment-text-multiple-outline', epg: 'television-classic', diagnostics: 'logs',
  fullscreen: 'fullscreen', close: 'close',
};

// Inline SVG keeps the React DOM/Electron entry independent of React Native,
// Expo, and native icon-font packages. The native entry uses Expo vector icons.
const WEB_ICON_PATHS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  restart: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-5.65 8H4.26A9 9 0 1 0 12 5z',
  lock: 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  'lock-open': 'M18 8h-1V6a5 5 0 0 0-9.8-1H9a3 3 0 0 1 6 .8V8H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  'volume-mute': 'M3 9v6h4l5 5V4L7 9H3zm13.59 3 2.12-2.12 1.41 1.41L19 13.41l2.12 2.12-1.41 1.41-2.12-2.12-2.12 2.12-1.41-1.41 2.12-2.12-2.12-2.12 1.41-1.41z',
  'volume-high': 'M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z',
  'aspect-ratio': 'M3 5h18v14H3zm2 2v10h14V7zm2 2h4v2H9v4H7zm10 6h-4v-2h2V9h2z',
  video: 'M18 7V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2l4 4V5zm-2 12H4V5h12z',
  'music-note': 'M12 3v12.26A4 4 0 1 0 14 19V7h6V3z',
  headphones: 'M12 3a9 9 0 0 0-9 9v6a3 3 0 0 0 3 3h3v-9H5v-1a7 7 0 0 1 14 0v1h-4v9h3a3 3 0 0 0 3-3v-6a9 9 0 0 0-9-9z',
  'arrow-collapse': 'M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z',
  logs: 'M3 3h18v18H3zm2 2v14h14V5zm3 3h2v2H8zm4 0h7v2h-7zm-4 4h2v2H8zm4 0h7v2h-7zm-4 4h2v2H8zm4 0h7v2h-7z',
  'arrow-left': 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z',
  'record-rec': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z',
  stop: 'M6 6h12v12H6z',
  'comment-text-multiple-outline': 'M4 4h16v12H7l-3 3zm2 2v8h12V6zm2 2h8v2H8zm0 3h6v2H8z',
  'television-classic': 'M21 3H3a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h7v2h4v-2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 15H3V5h18zM5 7h14v9H5z',
  fullscreen: 'M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  send: 'M2 21 23 12 2 3v7l15 2-15 2z',
  network: 'M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm16 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM10.7 7.4 5.3 16.7l1.7 1 5.4-9.3zm2.6 0 5.4 9.3-1.7 1-5.4-9.3z',
  speedometer: 'M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-2.05-4.95l1.42-1.42A8.96 8.96 0 0 0 12 3zm7.7 1.3-6.4 6.4a2.5 2.5 0 1 0 1.4 1.4l6.4-6.4z',
  buffer: 'M4 5h16v3H4zm0 5.5h16v3H4zm0 5.5h16v3H4z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.3z',
  display: 'M3 4h18v13H3zm2 2v9h14V6zm5 13h4v2h-4z',
  frames: 'M4 4h16v12H4zm2 2v8h12V6zm-4 13h16v2H2zm4-3h16v2H6z',
};

function getSource(source, url) {
  const value = source ?? url ?? '';
  if (typeof value === 'string') return { uri: value };
  return value && typeof value === 'object' ? value : { uri: '' };
}

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function Icon({ name, icons, color }) {
  const icon = icons?.[name];
  if (React.isValidElement(icon)) return React.cloneElement(icon, { 'aria-hidden': true });
  if (typeof icon === 'function') return h(icon, { size: 18, color, 'aria-hidden': true });
  if (typeof icon === 'string' && !/^[a-z0-9-]+$/i.test(icon)) {
    return h('span', { className: 'cinecrew-player__icon', style: { color }, 'aria-hidden': true }, icon);
  }
  const iconName = icon || DEFAULT_ICONS[name] || name;
  const path = WEB_ICON_PATHS[iconName] || WEB_ICON_PATHS[name];
  return path
    ? h('svg', { className: 'cinecrew-player__icon', viewBox: '0 0 24 24', width: 18, height: 18, fill: 'currentColor', style: { color }, 'aria-hidden': true }, h('path', { d: path }))
    : h('span', { className: 'cinecrew-player__icon', style: { color }, 'aria-hidden': true }, '•');
}

function PlayerButton({ name, label, icons, theme, onClick, active, disabled, children }) {
  return h('button', {
    type: 'button',
    className: `cinecrew-player__button${active ? ' is-active' : ''}`,
    style: { color: theme.controlColor, background: theme.controlBackground },
    'aria-label': label,
    title: label,
    onClick,
    disabled,
  }, h(Icon, { name, icons, color: active ? theme.accentColor : theme.controlColor }), children);
}

function isControlEnabled(overrides, name, fallback = true) {
  return overrides[name] ?? fallback;
}

function renderControlButton({ name, label, callback, options = {}, overrides, icons, theme }) {
  if (!isControlEnabled(overrides, name, options.defaultVisible ?? true)) return null;
  return h(PlayerButton, {
    key: name,
    name: options.icon || name,
    label,
    icons,
    theme,
    onClick: callback,
    active: options.active,
    disabled: options.disabled,
  });
}

function getPanelActionName(panel) {
  if (panel === 'chat') return 'onLiveChatOpen';
  if (panel === 'epg') return 'onEpgOpen';
  return 'onDiagnosticsOpen';
}

function WebSeekControl({ currentTime, duration, theme, onSeek }) {
  const [seekDraft, setSeekDraft] = useState(currentTime);
  const [isDragging, setIsDragging] = useState(false);
  const seekDraftRef = useRef(currentTime);

  useEffect(() => {
    if (!isDragging) {
      seekDraftRef.current = currentTime;
      setSeekDraft(currentTime);
    }
  }, [currentTime, isDragging]);

  const updateDraft = (event) => {
    const nextTime = Number(event.currentTarget.value);
    seekDraftRef.current = nextTime;
    setSeekDraft(nextTime);
  };

  const finishSeek = (event) => {
    if (!isDragging) return;
    const nextTime = event?.currentTarget && event.type !== 'blur'
      ? Number(event.currentTarget.value)
      : seekDraftRef.current;
    seekDraftRef.current = nextTime;
    setSeekDraft(nextTime);
    setIsDragging(false);
    onSeek(nextTime);
  };
  const displayTime = Math.min(isDragging ? seekDraft : currentTime, duration);
  const remainingTime = Math.max(0, duration - displayTime);

  return h('div', { className: 'cinecrew-player__seek' },
    h('span', null, formatTime(displayTime)),
    h('input', {
      type: 'range',
      'aria-label': 'Seek video',
      min: 0,
      max: duration,
      step: 'any',
      value: displayTime,
      onChange: updateDraft,
      onPointerDown: (event) => {
        event.stopPropagation();
        setIsDragging(true);
        seekDraftRef.current = Number(event.currentTarget.value);
        setSeekDraft(seekDraftRef.current);
      },
      onPointerUp: finishSeek,
      onPointerCancel: finishSeek,
      onBlur: finishSeek,
      onKeyDown: (event) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) setIsDragging(true);
      },
      onKeyUp: (event) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) finishSeek(event);
      },
      style: { accentColor: theme.accentColor },
    }),
    h('span', null, `−${formatTime(remainingTime)}`));
}

function WebAspectRatioMenu({ open, theme, icons, onToggle, onSelect }) {
  const ratios = ['FIT', 'FILL', 'STRETCH', '16:9', '4:3', '1:1'];
  let menu = null;
  if (open) {
    menu = h('div', { className: 'cinecrew-player__menu', style: { background: theme.surfaceColor } },
      ratios.map((ratio) => h('button', {
        key: ratio,
        type: 'button',
        onClick: () => onSelect(ratio),
      }, ratio)));
  }
  return h('div', { className: 'cinecrew-player__menu-wrap cinecrew-player__menu-wrap--aspect', key: 'aspectRatio' },
    h(PlayerButton, { name: 'aspectRatio', label: 'Aspect ratio', icons, theme, onClick: onToggle, active: open }),
    menu);
}

function WebAudioTrackMenu({ open, tracks, theme, icons, onToggle, onSelect }) {
  let menu = null;
  if (open) {
    menu = h('div', { className: 'cinecrew-player__menu', style: { background: theme.surfaceColor } },
      tracks.length
        ? tracks.map((track, index) => h('button', {
          key: track.id ?? index,
          type: 'button',
          onClick: () => onSelect(track.id),
        }, track.name || track.language || `Track ${index + 1}`))
        : h('div', { className: 'cinecrew-player__menu-empty', role: 'status' }, 'No audio tracks available'));
  }
  return h('div', { className: 'cinecrew-player__menu-wrap', key: 'audioTracks' },
    h(PlayerButton, { name: 'audio', label: 'Audio tracks', icons, theme, onClick: onToggle, active: open }),
    menu);
}

function WebPlaybackRateControl({ value, onChange }) {
  const rates = [0.5, 0.75, 1, 1.25, 1.5, 2];
  return h('select', {
    className: 'cinecrew-player__rate',
    'aria-label': 'Playback speed',
    value,
    onChange: (event) => onChange(Number(event.target.value)),
  }, rates.map((rate) => h('option', { key: rate, value: rate }, `${rate}x`)));
}

function WebBottomControls(props) {
  const {
    isLive, overrides, theme, icons, currentTime, duration, seekTo,
    showAspectMenu, setShowAspectMenu, selectAspect, videoOnly,
    setVideoOnlyMode, audioOnly, setAudioOnlyMode, availableTracks,
    showAudioMenu, setShowAudioMenu, selectAudio, playbackRate,
    setPlaybackRateAction, fullscreen, toggleFullscreen,
  } = props;
  let seek = null;
  if (duration > 0 && isControlEnabled(overrides, 'seek', true)) {
    seek = h(WebSeekControl, { currentTime, duration, theme, onSeek: seekTo });
  }
  let aspect = null;
  if (isControlEnabled(overrides, 'aspectRatio', true)) {
    aspect = h(WebAspectRatioMenu, {
      open: showAspectMenu,
      theme,
      icons,
      onToggle: () => setShowAspectMenu((value) => !value),
      onSelect: (ratio) => {
        selectAspect(ratio);
        setShowAspectMenu(false);
      },
    });
  }
  let audioTracks = null;
  if (isControlEnabled(overrides, 'audioTracks', true)) {
    audioTracks = h(WebAudioTrackMenu, {
      open: showAudioMenu,
      tracks: availableTracks,
      theme,
      icons,
      onToggle: () => setShowAudioMenu((value) => !value),
      onSelect: (id) => {
        selectAudio(id);
        setShowAudioMenu(false);
      },
    });
  }
  let playbackRateControl = null;
  if (isControlEnabled(overrides, 'playbackRate', true) && !isLive) {
    playbackRateControl = h(WebPlaybackRateControl, { value: playbackRate, onChange: setPlaybackRateAction });
  }
  const videoOnlyLabel = 'Video only';
  const audioOnlyLabel = 'Audio only';
  const fullscreenLabel = fullscreen ? 'Exit full screen' : 'Full screen';

  return h('div', { className: 'cinecrew-player__bottom-controls' },
    seek,
    h('div', { className: 'cinecrew-player__bottom-actions' },
      h('div', { className: 'cinecrew-player__bottom-left-actions' },
        renderControlButton({ name: 'audioOnly', label: audioOnlyLabel, callback: () => setAudioOnlyMode(true), options: { active: audioOnly }, overrides, icons, theme }),
        renderControlButton({ name: 'videoOnly', label: videoOnlyLabel, callback: () => setVideoOnlyMode(!videoOnly), options: { active: videoOnly, defaultVisible: false }, overrides, icons, theme }),
        aspect),
      h('div', { className: 'cinecrew-player__bottom-right-actions' },
        audioTracks,
        playbackRateControl,
        renderControlButton({ name: 'fullscreen', label: fullscreenLabel, callback: toggleFullscreen, options: { icon: 'fullscreen' }, overrides, icons, theme }))));
}

function WebPlayerControls({ locked, buffering, overrides, theme, icons, unlockedControls, toggleLock, paused, togglePlay, bottomProps }) {
  let leftControls = locked ? null : unlockedControls.left;
  let rightControls = unlockedControls.right;
  if (locked) {
    rightControls = renderControlButton({
      name: 'lock', label: 'Unlock controls', callback: toggleLock,
      options: { active: true, defaultVisible: true }, overrides, icons, theme,
    });
  }
  let centerControls = null;
  let bottomControls = null;
  if (!locked) {
    if (!buffering) {
      const playLabel = paused ? 'Play' : 'Pause';
      const playIcon = paused ? 'play' : 'pause';
      centerControls = h('div', { className: 'cinecrew-player__center-controls' },
        renderControlButton({ name: 'playPause', label: playLabel, callback: togglePlay, options: { icon: playIcon }, overrides, icons, theme }));
    }
    bottomControls = h(WebBottomControls, bottomProps);
  }
  return h('div', { className: 'cinecrew-player__controls', style: { color: theme.controlColor } },
    h('div', { className: 'cinecrew-player__top-controls' },
      h('div', { className: 'cinecrew-player__top-left-actions' }, leftControls),
      h('div', { className: 'cinecrew-player__top-right-actions' }, rightControls)),
    centerControls,
    bottomControls);
}

function WebPlayerSurface({
  youtubeVideoId,
  streamUrl,
  videoRef,
  youtubeRef,
  directVideoSource,
  poster,
  autoPlay,
  paused,
  muted,
  volume,
  playbackRate,
  videoOnly,
  videoStyle,
  drawerResize,
  audioOnly,
  inlinePreview,
  onPromotePreview,
  bufferingRef,
  onReady,
  onProgress,
  onPlaying,
  onEnded,
  onStateChange,
  onError,
  handleError,
}) {
  if (youtubeVideoId) {
    return h(YouTubeVideoPlayer, {
      ref: youtubeRef,
      videoId: youtubeVideoId,
      paused,
      muted: muted || videoOnly,
      volume,
      playbackRate,
      onReady,
      onProgress,
      onPlaying,
      onBuffering: bufferingRef.current,
      onStateChange,
      onError,
      onEnded,
      style: drawerResize ? { width: 'var(--cinecrew-media-width, 64%)', height: '100%', inset: '0 auto 0 0' } : undefined,
    });
  }
  if (!streamUrl) return h('div', { className: 'cinecrew-player__empty' });
  let resizedVideoStyle = {};
  if (drawerResize && videoStyle.width === 'auto') {
    resizedVideoStyle = {
      left: 'calc(var(--cinecrew-media-width, 64%) / 2)',
      top: '50%',
      right: 'auto',
      bottom: 'auto',
      maxWidth: 'var(--cinecrew-media-width, 64%)',
      transform: 'translate(-50%, -50%)',
    };
  } else if (drawerResize) {
    resizedVideoStyle = {
      width: 'var(--cinecrew-media-width, 64%)',
      height: '100%',
      left: 0,
      top: 0,
      right: 'auto',
      bottom: 0,
      transform: 'none',
    };
  }
  return h('video', {
    ref: videoRef,
    className: 'cinecrew-player__video',
    src: directVideoSource,
    poster,
    autoPlay,
    muted: muted || videoOnly,
    playsInline: true,
    preload: 'auto',
    style: {
      ...videoStyle,
      ...resizedVideoStyle,
      opacity: audioOnly ? 0 : 1,
    },
    onClick: inlinePreview ? onPromotePreview : undefined,
    onError: (event) => {
      if (!directVideoSource) return;
      const mediaError = event.currentTarget?.error;
      handleError({ message: mediaError?.message || 'The browser could not load this stream. Check URL, codec and CORS support.', code: mediaError?.code, cause: mediaError });
    },
  });
}

function WebAudioOnlyCard({ poster, title, theme, icons, onSwitchToVideo }) {
  return h('div', {
    className: 'cinecrew-player__audio-card',
    style: { background: theme.surfaceColor, color: theme.controlColor, borderColor: theme.accentColor },
  },
  poster
    ? h('img', { className: 'cinecrew-player__audio-poster', src: poster, alt: '' })
    : h('div', { className: 'cinecrew-player__audio-placeholder', role: 'img', 'aria-label': 'Audio artwork placeholder' },
      h(Icon, { name: 'audioOnly', icons, color: theme.accentColor })),
  h('span', { className: 'cinecrew-player__audio-wave', style: { color: theme.accentColor }, 'aria-hidden': true }, '•••••••'),
  h('strong', null, title || 'Audio only'),
  h('button', {
    type: 'button',
    onClick: onSwitchToVideo,
    style: { color: theme.accentColor, borderColor: theme.accentColor },
  }, 'Switch to video'));
}

function WebPlayerError({ error, theme, renderBackButton }) {
  if (!error) return null;
  return h('div', { className: 'cinecrew-player__error', style: { color: theme.controlColor, background: theme.surfaceColor } },
    h('strong', { style: { color: theme.errorColor } }, 'Playback error'),
    h('span', null, error),
    renderBackButton());
}

function getDirectVideoSource({ mpegTs, useHls, sourceType, activeUrl }) {
  if (mpegTs || useHls || /mpegurl|mpeg-ts/.test(sourceType)) return undefined;
  return activeUrl;
}

function isAudioPlaybackEnabled(muted, videoOnly) {
  return !muted && !videoOnly;
}

function getPanelIntegration(activePanel, integrations) {
  if (activePanel === 'chat') return integrations.liveChat;
  if (activePanel === 'epg') return integrations.epg;
  return null;
}

function getActiveMediaUrl(youtubeVideoId, streamUrl) {
  return youtubeVideoId ? '' : streamUrl;
}

function getInlinePlayerStyle(inlinePreview, rect) {
  if (!inlinePreview || !rect) return {};
  return { position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}

function buildUnlockedControls({
  control, onBack, isLive, restart, toggleLock, toggleMute, muted, hasRecording,
  recording, integrations, action, videoRef, streamUrl, title, activePanel,
  hasChat, hasEpg, hasDiagnostics, handleOpenPanel, setRecording, backVisible,
}) {
  const leftControls = [control('back', 'Back', onBack, { defaultVisible: backVisible })];
  let recordingControl = null;
  if (hasRecording) {
    const recordingLabel = recording ? 'Stop recording' : 'Start recording';
    const recordingAction = recording ? 'onRecordingStop' : 'onRecordingStart';
    const handleRecordingToggle = async () => {
      const handler = recording ? integrations.recording?.stop : integrations.recording?.start;
      const fallback = handler ? () => handler({ getVideoElement: () => videoRef.current, streamUrl, title }) : undefined;
      await action(recordingAction, fallback, { source: streamUrl, title });
      setRecording((value) => !value);
    };
    recordingControl = control('recording', recordingLabel, handleRecordingToggle, { active: recording });
  }
  const chatLabel = activePanel === 'chat' ? 'Close live chat' : 'Live chat';
  const epgLabel = activePanel === 'epg' ? 'Close programme guide' : 'Programme guide';
  const rightControls = [
    recordingControl,
    control('liveChat', chatLabel, () => handleOpenPanel('chat'), { active: activePanel === 'chat', defaultVisible: hasChat }),
    control('epg', epgLabel, () => handleOpenPanel('epg'), { active: activePanel === 'epg', defaultVisible: hasEpg }),
    ...(!isLive ? [control('restart', 'Restart', restart)] : []),
  ];
  const muteLabel = muted ? 'Unmute' : 'Mute';
  rightControls.push(
    control('mute', muteLabel, toggleMute, { icon: muted ? 'mute' : 'unmute' }),
    control('diagnostics', 'Stream diagnostics', () => handleOpenPanel('diagnostics'), { active: activePanel === 'diagnostics', defaultVisible: hasDiagnostics }),
    control('lock', 'Lock controls', toggleLock, { active: false, defaultVisible: true }),
  );
  return { left: leftControls, right: rightControls };
}

function getDrawerLabel(activePanel) {
  if (activePanel === 'chat') return 'Live chat drawer';
  if (activePanel === 'epg') return 'Programme guide drawer';
  return 'Stream diagnostics drawer';
}

function getPlaybackStatus(error, buffering, paused) {
  if (error) return 'Error';
  if (buffering) return 'Buffering';
  return paused ? 'Paused' : 'Playing';
}

function WebPlayerLayout(props) {
  let controlLayer = null;
  if (!props.error && !props.audioOnly) {
    controlLayer = h(WebPlayerControls, {
      locked: props.locked,
      buffering: props.buffering,
      overrides: props.controlOverrides,
      theme: props.theme,
      icons: props.icons,
      unlockedControls: props.unlockedControls,
      toggleLock: props.toggleLock,
      paused: props.isPaused,
      togglePlay: props.togglePlay,
      bottomProps: props.bottomControlProps,
    });
  }
  let playerTitle = null;
  if (props.title && !props.audioOnly) {
    playerTitle = h('div', { className: 'cinecrew-player__title', style: { color: props.theme.controlColor } }, props.title);
  }
  let loadingNotice = null;
  if (props.buffering && !props.error) {
    loadingNotice = h('div', { className: 'cinecrew-player__status', style: { color: props.theme.controlColor } },
      h('span', { className: 'cinecrew-player__spinner', style: { borderTopColor: props.theme.accentColor } }), 'Loading stream…')
  }
  let audioCard = null;
  if (props.audioOnly) {
    audioCard = h(WebAudioOnlyCard, { poster: props.poster, title: props.title, theme: props.theme, icons: props.icons, onSwitchToVideo: props.onSwitchToVideo });
  }
  let panelNode = null;
  if (props.activePanel && props.webPanel) {
    panelNode = h('aside', {
      className: `cinecrew-player__panel${props.drawerMode === 'resize' ? ' is-resizing' : ''}`,
      style: { color: props.theme.controlColor, ...props.drawerStyle },
      'aria-label': getDrawerLabel(props.activePanel),
    }, props.webPanel);
  }
  return h('div', {
    ref: props.playerRef,
    className: `cinecrew-player${props.inlinePreview ? ' cinecrew-player--inline-preview' : ''}${props.drawerMode === 'resize' && props.activePanel ? ' cinecrew-player--drawer-resize' : ''} ${props.className}`.trim(),
    style: { ...props.rootStyle, ...props.style, background: props.theme.backgroundColor, borderRadius: props.theme.borderRadius, '--cinecrew-accent': props.theme.accentColor, '--cinecrew-text': props.theme.controlColor, '--cinecrew-surface': props.theme.surfaceColor, '--cinecrew-media-width': '64%' },
    onWheel: props.onWheel,
    'data-stream-mode': props.streamMode,
  },
  props.mediaSurface,
  h('div', { className: 'cinecrew-player__shade', style: { background: 'linear-gradient(180deg, rgba(0,0,0,.48), transparent 28%, transparent 68%, rgba(0,0,0,.64))' } }),
  playerTitle,
  loadingNotice,
  h(WebPlayerError, { error: props.error, theme: props.theme, renderBackButton: props.locked ? () => null : props.renderBackButton }),
  controlLayer,
  audioCard,
  panelNode);
}

function getStreamMode(youtubeVideoId, mpegTs, useHls) {
  if (youtubeVideoId) return 'youtube';
  if (mpegTs) return 'mpegts';
  if (useHls) return 'hls';
  return 'native';
}

function normalizeTracks(video, suppliedTracks) {
  if (Array.isArray(suppliedTracks) && suppliedTracks.length) return suppliedTracks;
  const tracks = video?.audioTracks;
  if (!tracks) return [];
  return Array.from(tracks).map((track, index) => ({
    id: track.id ?? index,
    name: track.label || track.language || `Track ${index + 1}`,
    nativeTrack: track,
  }));
}

function responseRows(value, keys) {
  if (Array.isArray(value)) return value;
  for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function formatListingTime(value) {
  const date = new Date(Number(value) || value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getPanelRenderer(activePanel, renderLiveChat, renderEpg, integrations) {
  if (activePanel === 'chat') return renderLiveChat || integrations.liveChat?.render;
  if (activePanel === 'epg') return renderEpg || integrations.epg?.render;
  return null;
}

function createWebPanelNode({
  renderer, integration, activePanel, integrations, source, title, theme, icons, onClose,
  diagnostics, messagePageSize,
}) {
  if (activePanel === 'diagnostics') {
    return h(WebDiagnosticsPanel, { title, theme, icons, onClose, ...diagnostics });
  }
  if (renderer) return h(renderer, { title, source, onClose });
  if (!integration) return null;
  const hasLoader = activePanel === 'chat'
    ? typeof integration.loadMessages === 'function'
    : typeof integration.loadListings === 'function';
  if (!hasLoader) return null;
  return h(WebIntegrationPanel, {
    kind: activePanel,
    integration,
    integrations,
    source,
    title,
    theme,
    onClose,
    messagePageSize,
  });
}

function getBufferedAhead(video, currentTime) {
  if (!video?.buffered) return null;
  for (let index = 0; index < video.buffered.length; index += 1) {
    const start = video.buffered.start(index);
    const end = video.buffered.end(index);
    if (currentTime >= start && currentTime <= end) return Math.max(0, end - currentTime);
  }
  return 0;
}

function getFrameQuality(video) {
  try {
    const quality = video?.getVideoPlaybackQuality?.();
    if (quality) return { dropped: quality.droppedVideoFrames, total: quality.totalVideoFrames };
  } catch {
    // Playback quality is optional and may not be exposed by a media engine.
  }
  if (Number.isFinite(video?.webkitDroppedFrameCount) || Number.isFinite(video?.webkitDecodedFrameCount)) {
    return { dropped: video.webkitDroppedFrameCount, total: video.webkitDecodedFrameCount };
  }
  return null;
}

function WebDiagnosticsPanel({ title, theme, icons, onClose, streamMode, status, currentTime, duration, videoRef }) {
  const video = videoRef?.current;
  const resolution = video?.videoWidth && video?.videoHeight
    ? `${video.videoWidth} × ${video.videoHeight}`
    : 'Not available';
  const connection = globalThis.navigator?.connection;
  const buffered = getBufferedAhead(video, currentTime);
  const frames = getFrameQuality(video);
  const cards = [
    { icon: 'display', label: 'Video resolution', value: resolution },
    { icon: 'network', label: 'Connection rate', value: Number.isFinite(connection?.downlink) ? `${connection.downlink} Mbps` : 'Not reported' },
    { icon: 'clock', label: 'Network RTT estimate', value: Number.isFinite(connection?.rtt) ? `${connection.rtt} ms` : 'Not reported' },
    { icon: 'buffer', label: 'Buffered ahead', value: buffered === null ? 'Not reported' : `${buffered.toFixed(1)} sec` },
    { icon: 'frames', label: 'Dropped / total frames', value: frames && Number.isFinite(frames.dropped) ? `${frames.dropped} / ${frames.total ?? '—'}` : 'Not reported' },
    { icon: 'speedometer', label: 'Playback position', value: `${formatTime(currentTime)} / ${formatTime(duration)}` },
    { icon: 'network', label: 'Connection type', value: connection?.effectiveType || 'Not reported' },
    { icon: 'video', label: 'Stream format', value: streamMode || 'Unknown' },
  ];
  return h('section', {
    className: 'cinecrew-player__diagnostics',
    style: { color: theme.controlColor },
    'aria-label': 'Stream diagnostics',
  },
  h('header', { className: 'cinecrew-player__diagnostics-heading' },
    h('div', null,
      h('strong', null, 'Stream diagnostics'),
      h('span', null, title || 'Current playback')),
    h('button', {
      type: 'button',
      className: 'cinecrew-player__diagnostics-close',
      onClick: onClose,
      'aria-label': 'Close stream diagnostics',
      title: 'Close diagnostics',
    }, h(Icon, { name: 'close', icons, color: theme.controlColor }))),
  h('div', { className: 'cinecrew-player__diagnostics-status' },
    h('span', { className: `cinecrew-player__status-dot is-${String(status || 'unknown').toLowerCase()}` }),
    h('span', null, status || 'Unknown'),
    h('span', null, streamMode || 'Unknown format')),
  h('div', { className: 'cinecrew-player__diagnostic-grid' },
    cards.map(({ icon, label, value }) => h('article', { className: 'cinecrew-player__diagnostic-card', key: label },
      h('span', { className: 'cinecrew-player__diagnostic-icon' }, h(Icon, { name: icon, icons, color: theme.accentColor })),
      h('span', { className: 'cinecrew-player__diagnostic-label' }, label),
      h('strong', null, value)))),
  h('small', { className: 'cinecrew-player__diagnostics-note' }, 'Network rate and RTT are browser-reported estimates when supported; no extra ping or stream requests are sent.'));
}

function getChatMessageKey(message, index = 0) {
  return String(message?.id ?? message?.messageId ?? message?.createdAt ?? message?.timestamp
    ?? `${message?.username || message?.userName || ''}:${message?.comment || message?.message || message?.text || index}`);
}

function mergeChatMessages(existing, incoming, prepend = false) {
  const messages = prepend ? [...incoming, ...existing] : [...existing, ...incoming];
  const unique = new Map();
  messages.forEach((message, index) => unique.set(getChatMessageKey(message, index), message));
  return [...unique.values()];
}

function formatChatTimestamp(value) {
  if (value === null || value === undefined || value === '') return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const EMOJI_BATCH_SIZE = 96;

function WebEmojiPicker({ onSelect }) {
  const [emojiGroup, setEmojiGroup] = useState(EMOJI_GROUPS[0].name);
  const [emojiQuery, setEmojiQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(EMOJI_BATCH_SIZE);
  const listRef = useRef(null);
  const activeGroup = EMOJI_GROUPS.find((group) => group.name === emojiGroup) || EMOJI_GROUPS[0];
  const filteredEmojis = useMemo(
    () => emojiQuery.trim() ? searchEmojis(emojiQuery) : activeGroup.items,
    [activeGroup, emojiQuery],
  );
  const visibleEmojis = filteredEmojis.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(EMOJI_BATCH_SIZE);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [emojiGroup, emojiQuery]);

  const loadMore = () => setVisibleCount((count) => Math.min(count + EMOJI_BATCH_SIZE, filteredEmojis.length));
  const handleScroll = (event) => {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 32) loadMore();
  };

  return h('div', { className: 'cinecrew-player__emoji-picker', role: 'dialog', 'aria-label': 'Choose an emoji' },
    h('input', {
      className: 'cinecrew-player__emoji-search',
      type: 'search',
      value: emojiQuery,
      onChange: (event) => setEmojiQuery(event.target.value),
      placeholder: 'Search all emojis',
      'aria-label': 'Search all emojis',
    }),
    h('nav', { className: 'cinecrew-player__emoji-categories', 'aria-label': 'Emoji categories' },
      EMOJI_GROUPS.map((group) => h('button', {
        key: group.name,
        type: 'button',
        className: !emojiQuery.trim() && group.name === emojiGroup ? 'is-active' : '',
        onClick: () => {
          setEmojiGroup(group.name);
          setEmojiQuery('');
        },
        'aria-label': group.name,
        title: group.name,
        'aria-pressed': !emojiQuery.trim() && group.name === emojiGroup,
      }, group.icon))),
    h('div', {
      className: 'cinecrew-player__emoji-grid',
      role: 'grid',
      ref: listRef,
      onScroll: handleScroll,
    },
    visibleEmojis.map((item) => h('button', {
      key: item.codepoints,
      type: 'button',
      onClick: () => onSelect(item.emoji),
      'aria-label': `Insert ${item.short_name}`,
      title: item.short_name,
    }, item.emoji)),
    visibleCount < filteredEmojis.length ? h('button', {
      type: 'button',
      className: 'cinecrew-player__emoji-load-more',
      onClick: loadMore,
    }, 'Load more emojis') : null));
}

function WebChatComposer({ sending, canSend, onSend }) {
  const [message, setMessage] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const handleSubmit = async (event) => {
    event.preventDefault();
    const comment = message.trim();
    if (!comment || sending || !canSend) return;
    const sent = await onSend(comment);
    if (sent) setMessage('');
  };
  const insertEmoji = (emoji) => setMessage((current) => `${current}${emoji}`);

  return h('form', { className: 'cinecrew-player__chat-form', onSubmit: handleSubmit },
    h('div', { className: 'cinecrew-player__chat-composer' },
      h('button', {
        type: 'button',
        className: 'cinecrew-player__emoji-toggle',
        onClick: () => setEmojiOpen((open) => !open),
        'aria-label': emojiOpen ? 'Close emoji picker' : 'Open emoji picker',
      }, '☺'),
      h('input', {
        value: message,
        onChange: (event) => setMessage(event.target.value),
        placeholder: 'Add a message…',
        'aria-label': 'Chat message',
        maxLength: 1000,
      }),
      h('button', {
        type: 'submit',
        disabled: sending || !message.trim() || !canSend,
        'aria-label': sending ? 'Sending message' : 'Send message',
        title: sending ? 'Sending…' : 'Send message',
      }, h(Icon, { name: 'send', color: '#07111e' }))),
    emojiOpen ? h(WebEmojiPicker, { onSelect: insertEmoji }) : null);
}

function WebPanelRow({ row, index, isChat }) {
  if (isChat) {
    const timestamp = row.createdAt ?? row.timestamp ?? row.sentAt ?? row.time;
    return h('article', { key: row.id ?? row.messageId ?? index, className: 'cinecrew-player__chat-message' },
      h('header', null,
        h('strong', null, row.username || row.userName || row.name || 'Viewer'),
        timestamp ? h('time', { dateTime: String(timestamp) }, formatChatTimestamp(timestamp)) : null),
      h('span', null, row.comment || row.message || row.text || ''));
  }
  const start = row.startMs ?? row.start ?? row.startTime;
  const end = row.endMs ?? row.end ?? row.endTime;
  return h('article', { key: row.id ?? row.startMs ?? index, className: 'cinecrew-player__epg-item' },
    h('small', null, [formatListingTime(start), formatListingTime(end)].filter(Boolean).join(' – ')),
    h('strong', null, row.title || row.name || 'Programme'),
    row.description ? h('span', null, row.description) : null);
}

function WebLoadMoreMessages({ loading, onClick }) {
  return h('button', {
    type: 'button',
    className: 'cinecrew-player__load-more',
    onClick,
    disabled: loading,
  }, loading ? 'Loading more…' : 'See more messages');
}

function WebIntegrationPanel({ kind, integration, integrations, source, title, theme, onClose, messagePageSize = 50 }) {
  const [rows, setRows] = useState([]);
  const [user, setUser] = useState(integrations.user || null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const rowsRef = useRef([]);
  const channelId = String(source.streamId || source.mediaId || source.id || '');
  const isChat = kind === 'chat';
  const pageSize = Math.max(1, Math.floor(Number(messagePageSize) || 50));
  const emptyStateMessage = isChat ? 'No messages yet.' : 'No programme information available.';

  const updateRows = (nextRows) => {
    rowsRef.current = nextRows;
    setRows(nextRows);
  };

  const load = useCallback(async () => {
    if (!channelId) {
      setError('A channel ID is required to load this panel.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const value = isChat
        ? await integration.loadMessages({ channelId, limit: pageSize, offset: 0 })
        : await integration.loadListings({ channelId, limit: integration.limit || 48 });
      const nextRows = responseRows(value, isChat ? ['messages', 'items', 'comments'] : ['listings', 'programmes', 'epg', 'items']);
      if (isChat) {
        const previousCount = rowsRef.current.length;
        const mergedRows = mergeChatMessages(rowsRef.current, nextRows);
        updateRows(mergedRows);
        const addedCount = Math.max(0, mergedRows.length - previousCount);
        setMessageOffset((offset) => previousCount === 0
          ? nextRows.length
          : Math.max(offset, nextRows.length) + addedCount);
        if (previousCount === 0) {
          const explicitHasMore = value?.hasMore ?? value?.pagination?.hasMore;
          setHasMoreMessages(explicitHasMore === undefined ? nextRows.length >= pageSize : Boolean(explicitHasMore));
        }
      } else {
        setRows(nextRows);
      }
    } catch (loadError) {
      setError(loadError?.message || `Could not load ${isChat ? 'live chat' : 'the programme guide'}.`);
    } finally {
      setLoading(false);
    }
  }, [channelId, integration, isChat, pageSize]);

  useEffect(() => {
    let cancelled = false;
    if (isChat && !user && integrations.getUser) {
      Promise.resolve(integrations.getUser()).then((value) => {
        if (!cancelled) setUser(value || null);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [isChat, user, integrations]);

  useEffect(() => {
    setLoading(true);
    rowsRef.current = [];
    setRows([]);
    setMessageOffset(0);
    setHasMoreMessages(false);
    load();
    if (!isChat) return undefined;
    const timer = setInterval(load, Math.max(1000, Number(integration.pollIntervalMs) || 5000));
    return () => clearInterval(timer);
  }, [load, isChat, integration.pollIntervalMs]);

  const loadOlderMessages = async () => {
    if (!isChat || !hasMoreMessages || loadingOlder) return;
    setLoadingOlder(true);
    try {
      setError('');
      const value = await integration.loadMessages({ channelId, limit: pageSize, offset: messageOffset });
      const olderRows = responseRows(value, ['messages', 'items', 'comments']);
      updateRows(mergeChatMessages(rowsRef.current, olderRows, true));
      setMessageOffset((offset) => offset + olderRows.length);
      const explicitHasMore = value?.hasMore ?? value?.pagination?.hasMore;
      setHasMoreMessages(explicitHasMore === undefined ? olderRows.length >= pageSize : Boolean(explicitHasMore));
    } catch (loadError) {
      setError(loadError?.message || 'Could not load more messages.');
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async (comment) => {
    if (!comment || sending || !integration.sendMessage) return false;
    setSending(true);
    try {
      await integration.sendMessage({
        channelId,
        userId: user?.id,
        username: user?.username || 'Viewer',
        comment,
      });
      await load();
      return true;
    } catch (sendError) {
      setError(sendError?.message || 'Could not send your message.');
      return false;
    } finally {
      setSending(false);
    }
  };

  return h('section', {
    className: 'cinecrew-player__panel-content',
    style: { color: theme.controlColor },
    'aria-label': isChat ? 'Live chat' : 'Programme guide',
  },
  h('header', { className: 'cinecrew-player__panel-heading' },
    h('strong', null, isChat ? 'Live chat' : `${title || 'Channel'} · EPG`),
    h('button', { type: 'button', onClick: onClose, 'aria-label': 'Close panel' }, '×')),
  loading ? h('div', { className: 'cinecrew-player__panel-state' }, 'Loading…') : null,
  error ? h('div', { className: 'cinecrew-player__panel-state is-error', role: 'status' }, error) : null,
  !loading && !error && rows.length === 0 ? h('div', { className: 'cinecrew-player__panel-state' }, emptyStateMessage) : null,
    h('div', { className: 'cinecrew-player__panel-list' },
      isChat && hasMoreMessages ? h(WebLoadMoreMessages, { loading: loadingOlder, onClick: loadOlderMessages }) : null,
      rows.map((row, index) => h(WebPanelRow, { key: getChatMessageKey(row, index), row, index, isChat }))),
    isChat ? h(WebChatComposer, {
      sending,
      canSend: typeof integration.sendMessage === 'function',
      onSend: send,
    }) : null);
}

/**
 * URL-first browser player. It does not resolve provider URLs or proxy streams;
 * pass a browser-playable URL and provide UI adapters for optional services.
 */
export const CineCrewPlayer = forwardRef(function CineCrewPlayer(props, ref) {
  const {
    source,
    url,
    title = '',
    poster,
    isLive: liveProp,
    autoPlay = true,
    muted: mutedProp = false,
    volume: volumeProp = 1,
    playbackRate: playbackRateProp = 1,
    paused: pausedProp,
    controls: controlOverrides = {},
    features = {},
    drawerMode = 'overlay',
    drawerStyle,
    messagePageSize = 50,
    actions = {},
    theme: themeProp = {},
    icons = {},
    style,
    className = '',
    resolveSource,
    videoOnly: videoOnlyProp = false,
    audioOnly: audioOnlyProp = false,
    audioTracks: tracksProp,
    selectedAudioTrack,
    renderLiveChat,
    renderEpg,
    integrations = {},
    onPlayerHostRef,
    onInlinePreviewWheel,
    inlinePreview = false,
    inlinePreviewRect,
    onPromotePreview,
    initialShowLiveChat = false,
    liveChatNonce = 0,
    onBack,
    mediaId,
    onFullscreen,
    onReady,
    onProgress,
    onPlaying,
    onBuffering,
    onError,
    onEnded,
    onPlaybackRoute,
  } = props;
  const resolution = useResolvedPlayerSource(source, url, resolveSource, getWebRuntimePlatform());
  const media = resolution.source || {};
  const streamUrl = String(media.uri || media.url || '');
  const youtubeVideoId = getYouTubeVideoId(media);
  const isLive = liveProp ?? media.isLive ?? false;
  const theme = { ...DEFAULT_THEME, ...themeProp };
  const videoRef = useRef(null);
  const youtubeRef = useRef(null);
  const playerRef = useRef(null);
  const publicPlayerRef = useRef(null);
  const pausedRef = useRef(pausedProp ?? !autoPlay);
  const errorRef = useRef(onError);
  const [isPaused, setIsPaused] = useState(pausedProp ?? !autoPlay);
  const [muted, setMuted] = useState(!!mutedProp);
  const [volume, setVolume] = useState(Math.max(0, Math.min(1, Number(volumeProp) || 0)));
  const [videoOnly, setVideoOnly] = useState(!!videoOnlyProp);
  const [audioOnly, setAudioOnly] = useState(!!audioOnlyProp);
  const [aspectRatio, setAspectRatio] = useState('FIT');
  const [locked, setLocked] = useState(false);
  const [buffering, setBuffering] = useState(Boolean(streamUrl) || resolution.loading);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [recording, setRecording] = useState(false);
  const [availableTracks, setAvailableTracks] = useState([]);
  const [fullscreen, setFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(Number(playbackRateProp) || 1);
  const { videoStyle } = useWebVideoAspectRatio(aspectRatio, false);
  const pausedStateRef = pausedRef;
  pausedRef.current = isPaused;
  errorRef.current = onError;

  const handleError = useCallback((detail) => {
    const message = typeof detail === 'string' ? detail : detail?.message || 'Unable to play this media source.';
    setError(message);
    setBuffering(false);
    errorRef.current?.(detail instanceof Error ? detail : { ...detail, message });
  }, []);
  const onErrorRef = useRef(handleError);
  onErrorRef.current = handleError;
  const onBufferingRef = useRef((next) => {
    setBuffering(!!next);
    onBuffering?.(!!next);
  });
  onBufferingRef.current = (next) => {
    setBuffering(!!next);
    onBuffering?.(!!next);
  };

  useEffect(() => {
    setError('');
    setBuffering(Boolean(streamUrl) || resolution.loading);
    setCurrentTime(0);
    setDuration(0);
    setAvailableTracks([]);
    if (resolution.error) {
      handleError(resolution.error);
      return;
    }
    if (!streamUrl) {
      setBuffering(Boolean(resolution.loading));
    }
  }, [streamUrl, resolution.loading, resolution.error, handleError]);

  useEffect(() => {
    if (pausedProp !== undefined) setIsPaused(!!pausedProp);
  }, [pausedProp]);

  useEffect(() => setAudioOnly(!!audioOnlyProp), [audioOnlyProp]);

  useEffect(() => {
    setMuted(!!mutedProp);
  }, [mutedProp]);

  useEffect(() => setPlaybackRate(Number(playbackRateProp) || 1), [playbackRateProp]);
  useEffect(() => setVolume(Math.max(0, Math.min(1, Number(volumeProp) || 0))), [volumeProp]);

  useEffect(() => {
    onPlayerHostRef?.(playerRef.current);
    return () => onPlayerHostRef?.(null);
  }, [onPlayerHostRef]);

  useEffect(() => {
    if (initialShowLiveChat) setActivePanel('chat');
  }, [initialShowLiveChat]);

  useEffect(() => {
    if (liveChatNonce) setActivePanel('chat');
  }, [liveChatNonce]);

  const activeUrl = getActiveMediaUrl(youtubeVideoId, streamUrl);

  const mpegTs = useWebMpegTsPlayback({
    streamUrl,
    activeUrl,
    isLive,
    videoOnly,
    videoRef,
    pausedRef: pausedStateRef,
    onErrorRef,
    onBufferingRef,
  });
  const useHls = useWebHlsPlayback({
    activeUrl,
    isLive,
    videoRef,
    pausedRef: pausedStateRef,
    onErrorRef,
  });
  const streamMode = getStreamMode(youtubeVideoId, mpegTs.useMpegTs, useHls);
  useWebAc3AudioPlayback({
    active: mpegTs.useAc3Fallback,
    streamUrl,
    enabled: isAudioPlaybackEnabled(muted, videoOnly),
    paused: isPaused,
    volume: volume * 100,
    videoRef,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPaused) video.pause();
    else video.play().catch((playError) => {
      if (playError?.name !== 'NotAllowedError' && playError?.name !== 'AbortError') {
        handleError(playError);
      }
    });
  }, [isPaused, streamUrl, youtubeVideoId, handleError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted || videoOnly;
    video.volume = volume;
    video.playbackRate = Number(playbackRate) || 1;
  }, [muted, volume, playbackRate, videoOnly, streamUrl, youtubeVideoId]);

  useEffect(() => {
    if (!streamUrl) return undefined;
    onPlaybackRoute?.(streamUrl);
    return undefined;
  }, [streamUrl, onPlaybackRoute]);

  const setPaused = useCallback((next) => {
    const value = typeof next === 'boolean' ? next : !pausedRef.current;
    pausedRef.current = value;
    setIsPaused(value);
  }, []);

  const action = useCallback((name, fallback, payload) => {
    const callback = actions?.[name];
    if (typeof callback === 'function') return callback(payload, { video: videoRef.current, player: publicPlayerRef.current });
    return fallback?.(payload);
  }, [actions]);

  const togglePlay = useCallback(() => action('onPlayPause', () => setPaused(), { isPlaying: !pausedRef.current }), [action, setPaused]);
  const restart = useCallback(() => action('onRestart', () => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    else youtubeRef.current?.seekTo?.(0);
    setPaused(false);
  }, { currentTime: Number(videoRef.current?.currentTime) || 0 }), [action, setPaused]);
  const toggleMute = useCallback(() => action('onMute', () => setMuted((value) => !value), { muted: !muted }), [action, muted]);
  const toggleLock = useCallback(() => action('onLock', () => setLocked((value) => !value), { locked: !locked }), [action, locked]);
  const selectAspect = useCallback((next) => action('onAspectRatioChange', () => setAspectRatio(next), { aspectRatio: next }), [action]);
  const selectAudio = useCallback((id) => action('onAudioTrackChange', () => {
    const track = availableTracks.find((item) => String(item.id) === String(id));
    if (track?.nativeTrack) {
      for (const item of availableTracks) item.nativeTrack.enabled = String(item.id) === String(id);
    }
  }, { trackId: id }), [action, availableTracks]);
  const setVideoOnlyMode = useCallback((next) => action('onVideoOnlyChange', () => setVideoOnly(next), { enabled: next }), [action]);
  const setAudioOnlyMode = useCallback((next) => action('onAudioOnlyChange', () => setAudioOnly(next), { enabled: next }), [action]);
  const setPlaybackRateAction = useCallback((next) => action('onPlaybackRateChange', () => setPlaybackRate(next), { playbackRate: next }), [action]);
  const seekTo = useCallback((seconds) => action('onSeek', () => {
    if (videoRef.current) videoRef.current.currentTime = Math.max(0, Number(seconds) || 0);
    else youtubeRef.current?.seekTo?.(Math.max(0, Number(seconds) || 0));
  }, { seconds: Number(seconds) || 0 }), [action]);
  const handleBack = useCallback(() => action('onBack', onBack || props.onClose, { title, source: media }), [action, onBack, props.onClose, title, media]);
  useImperativeHandle(ref, () => {
    const api = {
      play: () => setPaused(false),
      pause: () => setPaused(true),
      togglePlayPause: togglePlay,
      restart,
      toggleMute,
      mute: () => setMuted(true),
      unmute: () => setMuted(false),
      setMuted,
      setAspectRatio,
      setAudioTrack: (id) => {
        for (const item of availableTracks) if (item.nativeTrack) item.nativeTrack.enabled = String(item.id) === String(id);
      },
      setAudioOnly: setAudioOnlyMode,
      setVideoOnly: setVideoOnlyMode,
      setPlaybackRate: setPlaybackRateAction,
      seekTo,
      seekBy: (delta) => seekTo((Number(videoRef.current?.currentTime) || currentTime) + (Number(delta) || 0)),
      back: handleBack,
      getVideoElement: () => videoRef.current,
      enterFullscreen: () => playerRef.current?.requestFullscreen?.(),
      exitFullscreen: () => typeof document !== 'undefined' ? document.exitFullscreen?.() : undefined,
      getAudioTracks: () => normalizeTracks(videoRef.current, tracksProp),
    };
    publicPlayerRef.current = api;
    return api;
  }, [setPaused, togglePlay, restart, toggleMute, setMuted, setAspectRatio, setAudioOnlyMode, setVideoOnlyMode, setPlaybackRateAction, seekTo, handleBack, availableTracks, tracksProp, currentTime]);

  const hasChat = typeof integrations.liveChat?.loadMessages === 'function' || typeof renderLiveChat === 'function' || typeof integrations.liveChat?.render === 'function' || typeof actions.onLiveChatOpen === 'function';
  const hasEpg = typeof integrations.epg?.loadListings === 'function' || typeof renderEpg === 'function' || typeof integrations.epg?.render === 'function' || typeof actions.onEpgOpen === 'function';
  const hasRecording = !!integrations.recording || typeof actions.onRecordingStart === 'function';
  const hasDiagnostics = Boolean(features.diagnostics) || typeof actions.onDiagnosticsOpen === 'function';
  const sourceType = String(media.type || media.mimeType || '').toLowerCase();
  const directVideoSource = getDirectVideoSource({
    mpegTs: mpegTs.useMpegTs,
    useHls,
    sourceType,
    activeUrl,
  });

  const handleYouTubeStateChange = useCallback((state) => {
    if (state === 'playing') setIsPaused(false);
    if (state === 'paused' || state === 'ended') setIsPaused(true);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const updateTracks = () => setAvailableTracks(normalizeTracks(video, tracksProp));
    const updateTime = () => {
      setCurrentTime(Number(video.currentTime) || 0);
      if (Number.isFinite(video.duration)) setDuration(video.duration);
      onProgress?.({ currentTime: (Number(video.currentTime) || 0) * 1000, duration: (Number(video.duration) || 0) * 1000, target: video.currentTime });
    };
    const onReadyEvent = () => {
      setBuffering(false);
      updateTracks();
      onReady?.(video);
    };
    const onPlayingEvent = () => {
      setBuffering(false);
      onPlaying?.(video);
    };
    const onWaitingEvent = () => setBuffering(true);
    video.addEventListener('loadedmetadata', onReadyEvent);
    video.addEventListener('canplay', onReadyEvent);
    video.addEventListener('playing', onPlayingEvent);
    video.addEventListener('waiting', onWaitingEvent);
    video.addEventListener('timeupdate', updateTime);
    const endedHandler = () => onEnded?.();
    video.addEventListener('ended', endedHandler);
    return () => {
      video.removeEventListener('loadedmetadata', onReadyEvent);
      video.removeEventListener('canplay', onReadyEvent);
      video.removeEventListener('playing', onPlayingEvent);
      video.removeEventListener('waiting', onWaitingEvent);
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('ended', endedHandler);
    };
  }, [onReady, onPlaying, onProgress, onEnded, tracksProp]);

  useEffect(() => {
    if (selectedAudioTrack === undefined || selectedAudioTrack === null) return;
    for (const track of availableTracks) {
      if (track.nativeTrack) track.nativeTrack.enabled = String(track.id) === String(selectedAudioTrack);
    }
  }, [selectedAudioTrack, availableTracks]);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => action('onFullscreen', () => {
    if (typeof onFullscreen === 'function') return onFullscreen({ isFullscreen: !fullscreen });
    if (document.fullscreenElement) document.exitFullscreen?.();
    else playerRef.current?.requestFullscreen?.();
  }, { isFullscreen: !fullscreen });
  const openPanel = (panel) => action(
    getPanelActionName(panel),
    () => setActivePanel((current) => {
      if (current === panel) return null;
      return panel;
    }),
    { tab: panel, isOpen: activePanel === panel, close: () => setActivePanel(null) },
  );
  const control = (name, label, callback, options = {}) => renderControlButton({
    name, label, callback, options, overrides: controlOverrides, icons, theme,
  });

  const panelRenderer = getPanelRenderer(activePanel, renderLiveChat, renderEpg, integrations);
  const panelIntegration = getPanelIntegration(activePanel, integrations);
  const panelSource = mediaId == null ? media : { ...media, mediaId };
  const rootStyle = getInlinePlayerStyle(inlinePreview, inlinePreviewRect);
  const unlockedControls = buildUnlockedControls({
    control,
    actions,
    onBack: handleBack,
    backVisible: typeof actions.onBack === 'function' || typeof onBack === 'function' || typeof props.onClose === 'function',
    isLive,
    restart,
    toggleLock,
    toggleMute,
    muted,
    hasRecording,
    recording,
    integrations,
    action,
    videoRef,
    streamUrl,
    title,
    activePanel,
    hasChat,
    hasEpg,
    hasDiagnostics,
    handleOpenPanel: openPanel,
    setRecording,
  });
  const webPanel = createWebPanelNode({
    renderer: panelRenderer,
    integration: panelIntegration,
    activePanel,
    integrations,
    source: panelSource,
    title,
    theme,
    icons,
    onClose: () => setActivePanel(null),
    diagnostics: {
      streamMode,
      status: getPlaybackStatus(error, buffering, isPaused),
      currentTime,
      duration,
      videoRef,
    },
    messagePageSize,
  });

  const handleYouTubeProgress = (event) => {
    setCurrentTime(Number(event.currentTime) / 1000 || 0);
    setDuration(Number(event.duration) / 1000 || 0);
    onProgress?.(event);
  };
  const mediaSurface = h(WebPlayerSurface, {
    youtubeVideoId,
    streamUrl,
    videoRef,
    youtubeRef,
    directVideoSource,
    poster,
    autoPlay,
    paused: isPaused,
    muted,
    volume,
    playbackRate,
    videoOnly,
    videoStyle,
    drawerResize: Boolean(activePanel) && drawerMode === 'resize',
    audioOnly,
    inlinePreview,
    onPromotePreview,
    bufferingRef: onBufferingRef,
    onReady,
    onProgress: handleYouTubeProgress,
    onPlaying,
    onEnded,
    onStateChange: handleYouTubeStateChange,
    onError: handleError,
    handleError,
  });
  const bottomControlProps = {
    isLive,
    overrides: controlOverrides,
    theme,
    icons,
    currentTime,
    duration,
    seekTo,
    muted,
    toggleMute,
    showAspectMenu,
    setShowAspectMenu,
    selectAspect,
    videoOnly,
    setVideoOnlyMode,
    audioOnly,
    setAudioOnlyMode,
    availableTracks,
    showAudioMenu,
    setShowAudioMenu,
    selectAudio,
    playbackRate,
    setPlaybackRateAction,
    fullscreen,
    toggleFullscreen,
  };
  return h(WebPlayerLayout, {
    playerRef,
    inlinePreview,
    className,
    rootStyle,
    style,
    theme,
    streamMode,
    mediaSurface,
    title,
    poster,
    error,
    buffering,
    audioOnly,
    activePanel,
    webPanel,
    renderBackButton: () => control('back', 'Close player', () => action('onBack', props.onBack || props.onClose, { title, source: media }), { icon: 'close' }),
    onSwitchToVideo: () => setAudioOnlyMode(false),
    locked,
    controlOverrides,
    icons,
    unlockedControls,
    toggleLock,
    isPaused,
    togglePlay,
    bottomControlProps,
    onWheel: (event) => onInlinePreviewWheel?.(event.deltaY),
    drawerMode,
    drawerStyle,
  });
});

export default CineCrewPlayer;

export const InlineLivePlayer = React.memo(function InlineLivePlayer({
  source,
  url,
  title = 'Live TV',
  height = 220,
  poster,
  paused = false,
  isActive = true,
  onActivate,
  onFullscreen,
  controls = {},
  actions = {},
  theme,
  icons,
  style,
  initialMuted = true,
  onError,
  onPlaying,
}) {
  const media = getSource(source, url);
  const playbackSource = { ...media, isLive: true, title: title || media.title };
  if (!isActive) {
    return h('button', {
      type: 'button',
      className: 'cinecrew-player__inline-poster',
      style: { height, ...style },
      onClick: onActivate,
      'aria-label': `Play ${title}`,
    }, poster || media.poster || media.posterUrl
      ? h('img', { src: poster || media.poster || media.posterUrl, alt: '' })
      : h('span', null, '▶'));
  }
  return h(CineCrewPlayer, {
    source: playbackSource,
    title,
    isLive: true,
    autoPlay: !paused,
    paused,
    muted: initialMuted,
    poster: poster || media.poster || media.posterUrl,
    controls: {
      back: false, restart: false, lock: false, recording: false, liveChat: false, epg: false,
      seek: false, aspectRatio: false, videoOnly: false, audioOnly: false, audioTracks: false,
      playbackRate: false, playPause: true, mute: true, fullscreen: true,
      ...controls,
    },
    actions: {
      ...actions,
      ...(onFullscreen && !actions.onFullscreen ? { onFullscreen: () => onFullscreen() } : {}),
    },
    theme,
    icons,
    onError,
    onPlaying,
    inlinePreview: true,
    onPromotePreview: onFullscreen,
    style: { width: '100%', height, aspectRatio: '16 / 9', ...style },
  });
});
