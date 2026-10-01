import {
  CORE_STYLES,
  CONTROLS_STYLES,
  BRIGHTNESS_STYLES,
  AUDIO_CARD_STYLES,
  RECORDING_STYLES,
  PANEL_STYLES,
  DIAGNOSTICS_STYLES,
  EMOJI_PICKER_STYLES,
  RESPONSIVE_STYLES,
  WEB_PLAYER_STYLES,
} from './inlineStyles.generated.js';

const STYLE_ELEMENT_ID = 'cinecrew-player-web-styles';

export function installStyleChunk(id, css) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  if (document.getElementById(id)) return;

  const styleElement = document.createElement('style');
  styleElement.id = id;
  styleElement.textContent = css;
  (document.head || document.documentElement)?.appendChild(styleElement);
}

export function installCoreStyles() {
  installStyleChunk('cinecrew-player-core-styles', CORE_STYLES);
  installStyleChunk('cinecrew-player-responsive-styles', RESPONSIVE_STYLES);
}

export function installControlsStyles() {
  installStyleChunk('cinecrew-player-controls-styles', CONTROLS_STYLES);
}

export function installBrightnessStyles() {
  installStyleChunk('cinecrew-player-brightness-styles', BRIGHTNESS_STYLES);
}

export function installAudioCardStyles() {
  installStyleChunk('cinecrew-player-audio-card-styles', AUDIO_CARD_STYLES);
}

export function installRecordingStyles() {
  installStyleChunk('cinecrew-player-recording-styles', RECORDING_STYLES);
}

export function installPanelStyles() {
  installStyleChunk('cinecrew-player-panel-styles', PANEL_STYLES);
}

export function installDiagnosticsStyles() {
  installStyleChunk('cinecrew-player-diagnostics-styles', DIAGNOSTICS_STYLES);
}

export function installEmojiPickerStyles() {
  installStyleChunk('cinecrew-player-emoji-picker-styles', EMOJI_PICKER_STYLES);
}

export function installWebPlayerStyles() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const styleElement = document.createElement('style');
  styleElement.id = STYLE_ELEMENT_ID;
  styleElement.textContent = WEB_PLAYER_STYLES;
  (document.head || document.documentElement)?.appendChild(styleElement);
}
