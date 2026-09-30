import { WEB_PLAYER_STYLES } from './inlineStyles.generated.js';

const STYLE_ELEMENT_ID = 'cinecrew-player-web-styles';

export function installWebPlayerStyles() {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  if (document.getElementById(STYLE_ELEMENT_ID)) return;

  const styleElement = document.createElement('style');
  styleElement.id = STYLE_ELEMENT_ID;
  styleElement.textContent = WEB_PLAYER_STYLES;
  (document.head || document.documentElement)?.appendChild(styleElement);
}
