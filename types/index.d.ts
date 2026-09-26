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

export type PlayerDrawerMode = 'overlay' | 'resize';

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

export interface ChatMessage {
  id?: string | number;
  username?: string;
  comment?: string;
  message?: string;
  createdAt?: string | number;
  timestamp?: string | number;
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
    /** Starts host-managed recording for the active direct media source. */
    start?: (args: { getVideoElement: () => unknown | null; streamUrl: string; title?: string }) => Promise<unknown>;
    pause?: () => Promise<unknown>;
    resume?: () => Promise<unknown>;
    stop?: () => Promise<{ filename?: string } | unknown>;
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
  theme?: PlayerTheme;
  icons?: PlayerIcons;
  style?: unknown;
  className?: string;
  videoOnly?: boolean;
  /** Optional resolver for share pages or other non-media links. */
  resolveSource?: (source: PlayerSource, context: { platform: 'web' | 'native' | 'electron' }) => PlayerSource | string | Promise<PlayerSource | string>;
  audioTracks?: AudioTrack[];
  selectedAudioTrack?: string | number;
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
  onFullscreen?: (state: { isFullscreen: boolean }) => void;
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
  onPlaying?: (event: unknown) => void;
  onBuffering?: (buffering: boolean) => void;
  onError?: (error: Error | Record<string, unknown>) => void;
  onEnded?: () => void;
  onPlaybackRoute?: (url: string) => void;
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
  onFullscreen?: () => void;
  controls?: Pick<PlayerControls, 'playPause' | 'mute' | 'fullscreen'>;
  actions?: Pick<PlayerActions, 'onPlayPause' | 'onMute' | 'onFullscreen'>;
  theme?: PlayerTheme;
  icons?: PlayerIcons;
  style?: unknown;
  initialMuted?: boolean;
  onError?: (error: Error | Record<string, unknown>) => void;
  onPlaying?: (event: unknown) => void;
}

export const CineCrewPlayer: React.ForwardRefExoticComponent<CineCrewPlayerProps & React.RefAttributes<PlayerApi>>;
export const InlineLivePlayer: React.MemoExoticComponent<React.FC<InlineLivePlayerProps>>;
export const PlayerCustomizationProvider: React.FC<{ icons?: PlayerIcons; theme?: PlayerTheme; children?: React.ReactNode }>;
export default CineCrewPlayer;
