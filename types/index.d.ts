import type * as React from 'react';

export type AspectRatio = 'FIT' | 'FILL' | 'STRETCH' | 'FILL_SCREEN' | string;
export interface AspectRatioOption { value: AspectRatio; label?: string }
export type PlayerMediaType = 'live' | 'channel' | 'movie' | 'series' | string;

export interface PlayerSource {
  /** Local media or a URL the target platform can play. */
  uri?: string;
  /** Alias for `uri`. */
  url?: string;
  title?: string;
  poster?: string;
  posterUrl?: string;
  type?: string;
  mimeType?: string;
  mediaType?: PlayerMediaType;
  isLive?: boolean;
  id?: string | number;
  streamId?: string | number;
  mediaId?: string | number;
  [key: string]: unknown;
}

export interface PlayerControls {
  back?: boolean;
  playPause?: boolean;
  restart?: boolean;
  lock?: boolean;
  mute?: boolean;
  aspectRatio?: boolean;
  videoOnly?: boolean;
  audioOnly?: boolean;
  audioTracks?: boolean;
  playbackRate?: boolean;
  fullscreen?: boolean;
  recording?: boolean;
  liveChat?: boolean;
  epg?: boolean;
  diagnostics?: boolean;
  seek?: boolean;
}

export type PlayerDrawerMode = 'overlay' | 'resize' | 'modal';

export interface PlayerApi {
  play(): void;
  pause(): void;
  togglePlayPause(nextPlaying?: boolean): void;
  restart(): void;
  setMuted(muted: boolean): void;
  toggleMute(): void;
  setAspectRatio(ratio: AspectRatio): void;
  setAudioTrack(trackId: string | number): void;
  setAudioOnly(enabled: boolean): void;
  setVideoOnly(enabled: boolean): void;
  seekTo(seconds: number): void;
  seekBy(seconds: number): void;
  back(): void;
  setPlaybackRate(rate: number): void;
  setPanel(panel: 'chat' | 'epg' | 'diagnostics' | null): void;
  closePanel(): void;
  getVideoElement(): unknown | null;
  getAudioTracks(): AudioTrack[];
  /** Start a built-in native VLC/LibVLC recording. The path is optional; when omitted the platform chooses an app-owned recordings folder. */
  startNativeRecording?(path?: string): boolean | Promise<{ path?: string; filename?: string } | null>;
  /** Pause capture without pausing playback; native recorders save the current segment. */
  pauseNativeRecording?(): boolean | Promise<{ ok?: boolean } | null>;
  /** Resume capture at the current playback position. */
  resumeNativeRecording?(): boolean | Promise<{ ok?: boolean; path?: string } | null>;
  /** Stop an active native VLC/LibVLC recording. */
  stopNativeRecording?(): boolean | Promise<{ path?: string; filename?: string; size?: number } | null>;
  /** Join native transport-stream segments created by pause/resume into one recording. */
  mergeNativeRecordingSegments?(paths: string[]): boolean | Promise<boolean>;
  enterFullscreen?(): void | Promise<void>;
  exitFullscreen?(): void | Promise<void>;
}

export interface AudioTrack {
  id: string | number;
  name?: string;
  language?: string;
  selected?: boolean;
  enabled?: boolean;
  nativeTrack?: unknown;
}

export interface PlayerActionContext {
  player: PlayerApi | null;
  video?: unknown | null;
}

/** Structured playback failure. `message` is suitable for the player UI; `actualMessage` and `cause`/`err` preserve the underlying engine diagnostic when available. */
export interface PlayerErrorDetails {
  message: string;
  actualMessage?: string;
  cause?: unknown;
  err?: unknown;
  errorType?: string;
  errorDetail?: string;
  httpStatus?: number | null;
  [key: string]: unknown;
}

export type PlayerError = Error | PlayerErrorDetails;

/** App callback for a player action. Back is app-owned and has no built-in behavior. */
export type PlayerAction = (payload?: Record<string, unknown>, context?: PlayerActionContext) => unknown;

export interface PlayerActions {
  /** User-owned navigation event. The player does not close or navigate on its own. */
  onBack?: PlayerAction;
  onPlayPause?: PlayerAction;
  onSeek?: PlayerAction;
  onRestart?: PlayerAction;
  onLock?: PlayerAction;
  onMute?: PlayerAction;
  onAspectRatioChange?: PlayerAction;
  onVideoOnlyChange?: PlayerAction;
  onAudioOnlyChange?: PlayerAction;
  onAudioTrackChange?: PlayerAction;
  onPlaybackRateChange?: PlayerAction;
  onFullscreen?: PlayerAction;
  onRecordingStart?: PlayerAction;
  onRecordingPause?: PlayerAction;
  onRecordingResume?: PlayerAction;
  onRecordingStop?: PlayerAction;
  onLiveChatOpen?: PlayerAction;
  onEpgOpen?: PlayerAction;
  onDiagnosticsOpen?: PlayerAction;
}

export interface PlayerTheme {
  /** Shared accent color for controls and active states. */
  accentColor?: string;
  backgroundColor?: string;
  controlBackground?: string;
  controlColor?: string;
  surfaceColor?: string;
  errorColor?: string;
  borderRadius?: number;
  /** React Native palette shape accepted by the native controls. */
  colors?: Record<string, string | number | undefined>;
  [key: string]: unknown;
}

export interface PlayerIconProps {
  name?: string;
  size?: number;
  color?: string;
  style?: unknown;
}

export type PlayerIcon = string | React.ReactNode | React.ComponentType<PlayerIconProps>;
export type PlayerIcons = Partial<Record<
  | 'play' | 'pause' | 'restart' | 'lock' | 'unlock' | 'mute' | 'unmute'
  | 'aspectRatio' | 'videoOnly' | 'audio' | 'back'
  | 'recording' | 'stop' | 'liveChat' | 'epg' | 'diagnostics' | 'fullscreen' | 'close'
  | string,
  PlayerIcon
>>;

export interface ChatUser {
  id?: string | number;
  userId?: string | number;
  username?: string;
  name?: string;
  avatarUrl?: string;
  imageUrl?: string;
  avatar?: string;
  image?: string;
  color?: string;
  avatarColor?: string;
  backgroundColor?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id?: string | number;
  username?: string;
  comment?: string;
  message?: string;
  createdAt?: string | number;
  timestamp?: string | number;
  avatarUrl?: string;
  imageUrl?: string;
  avatar?: string;
  image?: string;
  color?: string;
  avatarColor?: string;
  [key: string]: unknown;
}

export interface ChatMessagePage {
  messages?: ChatMessage[];
  items?: ChatMessage[];
  comments?: ChatMessage[];
  data?: ChatMessage[];
  hasMore?: boolean;
  pagination?: { hasMore?: boolean };
}

export interface EpgListing {
  title?: string;
  description?: string;
  startMs: number;
  endMs: number;
  [key: string]: unknown;
}

export interface PlayerIntegrations {
  user?: { id?: string | number; username?: string };
  getUser?: () => Promise<{ id?: string | number; username?: string } | null>;
  users?: ChatUser[];
  liveChat?: {
    loadMessages?: (args: { channelId: string; limit: number; offset?: number }) => Promise<ChatMessage[] | ChatMessagePage>;
    sendMessage?: (args: { channelId: string; userId?: string | number; username?: string; comment: string }) => Promise<unknown>;
    pollIntervalMs?: number;
    render?: (context: { title: string; source: PlayerSource; onClose: () => void }) => React.ReactNode;
  };
  epg?: {
    loadListings?: (args: { channelId: string | number; limit: number }) => Promise<EpgListing[]>;
    limit?: number;
    render?: (context: { title: string; source: PlayerSource; onClose: () => void }) => React.ReactNode;
  };
  recording?: {
    /** Optional override for the player's built-in recorder. */
    start?: (args: { getVideoElement: () => unknown | null; streamUrl: string; title?: string; player?: PlayerApi | null }) => Promise<unknown>;
    pause?: () => Promise<unknown>;
    resume?: () => Promise<unknown>;
    stop?: () => Promise<{ filename?: string } | unknown>;
    /** Allow the recording control on on-demand media, not only live sources. */
    supportsOnDemand?: boolean;
    /** Receives the completed local path emitted by the native VLC recorder. */
    onNativeRecordingCreated?: (recordingPath: string) => void;
    isActive?: () => boolean;
    subscribe?: (listener: (state: { status: string; elapsedMs: number }) => void) => (() => void) | void;
  };
  onEvent?: (event: { name: string; payload?: Record<string, unknown> }) => unknown;
  onProgress?: (progress: Record<string, unknown>) => unknown;
  onPresence?: (presence: { online: boolean; title: string; mediaType: string; mediaId?: string | number | null }) => unknown;
  onSleepTimerExpired?: (callback: () => void) => (() => void) | void;
}

export interface CineCrewPlayerProps {
  source?: string | PlayerSource;
  /** Alias for `source`. */
  url?: string;
  title?: string;
  poster?: string;
  posterUrl?: string;
  mediaType?: PlayerMediaType;
  isLive?: boolean;
  visible?: boolean;
  autoPlay?: boolean;
  /** Initial paused state; changes are observed by the web player and on source changes natively. */
  paused?: boolean;
  muted?: boolean;
  audioOnly?: boolean;
  /** Volume is normalized from 0 (silent) to 1 (full). */
  volume?: number;
  playbackRate?: number;
  controls?: PlayerControls;
  /** Show the playback progress/seek bar. When false, onProgressBarChange is not called. Defaults to true. */
  showProgressBar?: boolean;
  /** Show the in-video brightness slider. Brightness is simulated with a translucent black layer; device brightness is not changed. Defaults to false. */
  showBrightnessControl?: boolean;
  /** Custom accent color hash or string for the brightness bar slider. Defaults to '#00D4FF'. */
  brightnessColor?: string;
  brightnessAccentColor?: string;
  /** Show the in-video sound/volume slider on the opposite end. Defaults to false. */
  showVolumeControl?: boolean;
  showSoundControl?: boolean;
  /** Custom accent color hash or string for the sound/volume bar slider. Defaults to '#FFE066' (light yellow). */
  volumeColor?: string;
  soundColor?: string;
  /** Show the LIVE badge pill on the top left for the compact/inline player. Defaults to false. */
  showLiveBadge?: boolean;
  showLivePill?: boolean;
  showLiveButton?: boolean;
  /** Web/Electron chat and EPG drawer behavior. Overlay keeps the video full-size; resize shrinks it to make room. */
  drawerMode?: PlayerDrawerMode;
  /** Web CSS or React Native view-style overrides for the chat, EPG, and diagnostics drawer. */
  drawerStyle?: React.CSSProperties | import('react-native').ViewStyle;
  /** Number of chat messages fetched per page. Older pages load automatically when scrolling to the top. Defaults to 50. */
  messagePageSize?: number;
  /** Available aspect-ratio choices. Items may be values or labeled { value, label } options. */
  aspectRatios?: Array<AspectRatio | AspectRatioOption>;
  /** Initial aspect-ratio choice. Defaults to FIT. */
  defaultAspectRatio?: AspectRatio;
  features?: { diagnostics?: boolean; [key: string]: boolean | undefined };
  /** App callbacks invoked after each corresponding built-in action. */
  actions?: PlayerActions;
  integrations?: PlayerIntegrations;
  /** Custom user avatar colors and profiles for chat and overlays. */
  users?: ChatUser[];
  theme?: PlayerTheme;
  icons?: PlayerIcons;
  style?: unknown;
  className?: string;
  videoOnly?: boolean;
  /** Optional resolver for share pages or other non-media links. */
  resolveSource?: (source: PlayerSource, context: { platform: 'web' | 'native' | 'electron' }) => PlayerSource | string | Promise<PlayerSource | string>;
  /** Optional base URL for ogv.js worker/WASM assets; defaults to the versioned jsDelivr distribution. */
  ogvResourceBase?: string;
  audioTracks?: AudioTrack[];
  selectedAudioTrack?: string | number;
  /** Initial playback position as seconds or a zero-padded `HH:MM:SS` string. Takes precedence over `resumePosition`. */
  startTime?: number | string;
  resumePosition?: number;
  durationSecs?: number;
  mediaId?: string | number;
  episodeLabel?: string;
  season?: number;
  episode?: number;
  genre?: string;
  categoryName?: string;
  playlist?: Array<Record<string, unknown>>;
  shuffle?: boolean;
  onClose?: () => void;
  /** User-owned back event. The player does not close or navigate on its own. */
  onBack?: PlayerAction;
  /** Native fullscreen events include the resume timestamp for host-driven player remounts. */
  onFullscreen?: (state: { isFullscreen: boolean; currentTime?: number; startTime?: number; position?: number; progressTime?: string }) => void;
  /** Invoked after the player applies an aspect ratio selection; actions.onAspectRatioChange takes precedence when both are supplied. */
  onAspectRatioChange?: PlayerAction;
  onPlayerHostRef?: (node: unknown | null) => void;
  onInlinePreviewWheel?: (deltaY: number) => void;
  inlinePreview?: boolean;
  inlinePreviewRect?: { x: number; y: number; width: number; height: number };
  onPromotePreview?: () => void;
  initialShowLiveChat?: boolean;
  liveChatNonce?: number;
  onReady?: (playerOrEvent: unknown) => void;
  onProgress?: (event: unknown) => void;
  /** Called once for each elapsed playback second and after a completed seek/restart with a zero-padded HH:MM:SS position. */
  onProgressBarChange?: (time: string) => void;
  /** Called after a brightness drag/adjustment ends with the final integer percentage (10–100). */
  onBrightnessChangeEnd?: (brightnessPercent: number) => void;
  /** Called after a sound/volume drag/adjustment ends with the final integer percentage (0–100). */
  onVolumeChangeEnd?: (volumePercent: number) => void;
  onSoundChangeEnd?: (volumePercent: number) => void;
  onPlaying?: (event: unknown) => void;
  onBuffering?: (buffering: boolean) => void;
  /** Receives the player-facing error plus the underlying engine diagnostic (`actualMessage`, `cause`, `err`) when available. */
  onError?: (error: PlayerError) => void;
  onEnded?: () => void;
  onPlaybackRoute?: (url: string) => void;
  /** Called after a native/Electron recording is finalized and its local file path is available. */
  onRecordingComplete?: (recording: { path: string; filename: string; size?: number; platform?: string }) => void;
  onNextEpisode?: (episode: Record<string, unknown>) => void;
  onCwRefresh?: () => void;
  renderLiveChat?: PlayerIntegrations['liveChat'] extends infer T ? T extends { render?: infer R } ? R : never : never;
  renderEpg?: PlayerIntegrations['epg'] extends infer T ? T extends { render?: infer R } ? R : never : never;
}

export interface InlineLivePlayerProps {
  source?: string | PlayerSource;
  url?: string;
  title?: string;
  height?: number;
  poster?: string;
  posterChannel?: Record<string, unknown>;
  paused?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  /** @deprecated Inline fullscreen is self-contained. Use actions.onFullscreen to observe its state. */
  onFullscreen?: () => void;
  /** Promote the inline preview into the host app's full player. Receives the current playback position so it can resume without restarting. */
  onPromotePreview?: (position: { currentTime: number; startTime: number; position: number; progressTime: string; title: string; source: PlayerSource }) => void;
  controls?: Pick<PlayerControls, 'playPause' | 'mute' | 'fullscreen' | 'seek' | 'liveChat' | 'epg' | 'diagnostics'>;
  actions?: Pick<PlayerActions, 'onPlayPause' | 'onMute' | 'onFullscreen' | 'onLiveChatOpen' | 'onEpgOpen' | 'onDiagnosticsOpen'>;
  /** Enable stream diagnostics in the inline player's drawer. */
  features?: Pick<NonNullable<CineCrewPlayerProps['features']>, 'diagnostics'>;
  /** Drawer integrations and optional current-user metadata. */
  integrations?: PlayerIntegrations;
  /** Custom user avatar colors and profiles for chat and overlays. */
  users?: ChatUser[];
  /** Choose right-side overlay, resized video, or modal drawer presentation. Defaults to overlay. */
  drawerMode?: PlayerDrawerMode;
  /** Chat page size; older messages load automatically as the list is scrolled to the top. Defaults to 50. */
  messagePageSize?: number;
  mediaId?: string | number;
  drawerStyle?: React.CSSProperties | import('react-native').ViewStyle;
  /** Control drawer visibility externally. Pair with onLiveChatChange to control it. */
  showLiveChat?: boolean;
  /** Initial drawer visibility when showLiveChat is not supplied. Defaults to false. */
  initialShowLiveChat?: boolean;
  onLiveChatChange?: (isOpen: boolean) => void;
  theme?: PlayerTheme;
  icons?: PlayerIcons;
  style?: unknown;
  initialMuted?: boolean;
  /** Initial playback position as seconds or a zero-padded `HH:MM:SS` string. */
  startTime?: number | string;
  /** Show a brightness slider over the inline video. Defaults to false. */
  showBrightnessControl?: boolean;
  /** Custom accent color hash or string for the brightness bar slider. Defaults to '#00D4FF'. */
  brightnessColor?: string;
  brightnessAccentColor?: string;
  /** Show the sound/volume bar slider. Defaults to false. */
  showVolumeControl?: boolean;
  showSoundControl?: boolean;
  /** Custom accent color hash or string for the sound/volume bar slider. Defaults to '#FFE066' (light yellow). */
  volumeColor?: string;
  soundColor?: string;
  initialVolume?: number;
  /** Show the LIVE badge pill on the top left of the compact/inline player. Defaults to false. */
  showLiveBadge?: boolean;
  showLivePill?: boolean;
  showLiveButton?: boolean;
  /** Called when an inline brightness adjustment ends with the final integer percentage (10–100). */
  onBrightnessChangeEnd?: (brightnessPercent: number) => void;
  /** Called after a sound/volume drag/adjustment ends with the final integer percentage (0–100). */
  onVolumeChangeEnd?: (volumePercent: number) => void;
  onSoundChangeEnd?: (volumePercent: number) => void;
  /** Receives the player-facing error plus the underlying engine diagnostic (`actualMessage`, `cause`, `err`) when available. */
  onError?: (error: PlayerError) => void;
  onPlaying?: (event: unknown) => void;
  /** Called for each elapsed second and after a seek with the exact HH:MM:SS playback position. */
  onProgressBarChange?: (time: string) => void;
}

export interface VerticalBrightnessControlProps {
  value?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  accentColor?: string;
  compact?: boolean;
  availableHeight?: number;
  topInset?: number;
  bottomInset?: number;
  leftInset?: number;
}

export interface VerticalVolumeControlProps {
  value?: number;
  onChange?: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  accentColor?: string;
  compact?: boolean;
  availableHeight?: number;
  topInset?: number;
  bottomInset?: number;
  rightInset?: number;
}

export const VerticalBrightnessControl: React.FC<VerticalBrightnessControlProps>;
export const VerticalVolumeControl: React.FC<VerticalVolumeControlProps>;
export const CineCrewPlayer: React.ForwardRefExoticComponent<CineCrewPlayerProps & React.RefAttributes<PlayerApi>>;
export const InlineLivePlayer: React.MemoExoticComponent<React.FC<InlineLivePlayerProps>>;
export const PlayerCustomizationProvider: React.FC<{ icons?: PlayerIcons; theme?: PlayerTheme; children?: React.ReactNode }>;
export default CineCrewPlayer;
