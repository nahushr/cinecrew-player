import { Easing } from 'react-native';
import { isWeb } from '../../../utils/runtimePlatform';

export const USER_AGENT = 'Lavf/58.29.100';
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.25, 1.5, 1.75, 2];
export const PIP_WIDTH = isWeb() ? 360 : 280;
export const PIP_HEIGHT = isWeb() ? 202 : 158;
export const PIP_RIGHT = isWeb() ? 24 : 16;
export const PIP_BOTTOM = isWeb() ? 24 : 36;
export const PIP_ANIM_EASING = Easing.bezier(0.22, 1, 0.36, 1);
export const PIP_CORNERS = ['tl', 'tr', 'bl', 'br'];

export function getPipCornerPosition(corner, winW, winH, insets = {}) {
  const padX = PIP_RIGHT;
  const padTop = Math.max(insets.top || 0, isWeb() ? 16 : 8) + 8;
  const padBottom = PIP_BOTTOM;
  const left = corner === 'tl' || corner === 'bl'
    ? padX
    : Math.max(padX, winW - PIP_WIDTH - padX);
  const top = corner === 'tl' || corner === 'tr'
    ? padTop
    : Math.max(padBottom, winH - PIP_HEIGHT - padBottom);
  return { left, top };
}

export function nearestPipCorner(x, y, winW, winH, insets) {
  let best = 'br';
  let bestDist = Infinity;
  for (const corner of PIP_CORNERS) {
    const pos = getPipCornerPosition(corner, winW, winH, insets);
    const dist = (pos.left - x) ** 2 + (pos.top - y) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = corner;
    }
  }
  return best;
}

export const ASPECT_OPTIONS = [
  { label: 'Fit Screen', value: 'FIT' },
  { label: 'Fill Screen', value: 'FILL_SCREEN' },
  { label: '16:9', value: '16:9' },
  { label: '4:3', value: '4:3' },
  { label: '21:9', value: '21:9' },
  { label: '1:1', value: '1:1' },
];

export function calculateScreenAspectRatio(width, height) {
  if (!width || !height) return '16:9';
  const w = Math.max(width, height);
  const h = Math.min(width, height);
  const ratio = w / h;

  if (Math.abs(ratio - (16 / 9)) < 0.05) return '16:9';
  if (Math.abs(ratio - (4 / 3)) < 0.05) return '4:3';
  if (Math.abs(ratio - (16 / 10)) < 0.05) return '16:10';
  if (Math.abs(ratio - (18 / 9)) < 0.05) return '18:9';
  if (Math.abs(ratio - (19.5 / 9)) < 0.05) return '39:18';
  if (Math.abs(ratio - (20 / 9)) < 0.05) return '20:9';
  if (Math.abs(ratio - (21 / 9)) < 0.05) return '21:9';

  const num = Math.round(ratio * 100);
  return `${num}:100`;
}

export function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds) || seconds <= 0) return '00:00';
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}:${pad(mins % 60)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function getBrightnessIcon(val) {
  if (val >= 0.7) return 'white-balance-sunny';
  if (val >= 0.4) return 'brightness-6';
  return 'brightness-4';
}

export function isSafariOrIOS() {
  if (!isWeb() || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua) || (/AppleWebKit/i.test(ua) && !/Chrome|CriOS|OPR|Edge|Edg/i.test(ua));
  return isIOS || isSafari;
}

export function getVolumeIcon(vol) {
  if (!vol || vol <= 0) return 'volume-mute';
  if (vol > 50) return 'volume-high';
  return 'volume-medium';
}

export function getWebPoint(e) {
  const ne = e?.nativeEvent ?? e;
  const touch = e?.touches?.[0]
    || ne?.touches?.[0]
    || ne?.changedTouches?.[0];
  const x = Number(touch?.clientX ?? e?.clientX ?? ne?.clientX ?? ne?.pageX);
  const y = Number(touch?.clientY ?? e?.clientY ?? ne?.clientY ?? ne?.pageY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

export function bindWebVerticalDrag(e, updateFromY) {
  if (bindWebVerticalDrag.active) return;
  if (typeof e?.stopPropagation === 'function') e.stopPropagation();
  const point = getWebPoint(e);
  if (!point) return;
  const target = e.currentTarget;
  const rect = typeof target?.getBoundingClientRect === 'function'
    ? target.getBoundingClientRect()
    : null;
  if (!rect) return;
  bindWebVerticalDrag.active = true;
  updateFromY(point.y, rect.top, rect.height);
  const pointerId = e.pointerId ?? e.nativeEvent?.pointerId;
  if (pointerId !== null && typeof target.setPointerCapture === 'function') {
    try { target.setPointerCapture(pointerId); } catch { /* ignore */ }
  }
  const onMove = (moveEvt) => {
    const next = getWebPoint(moveEvt);
    if (!next) return;
    if (typeof moveEvt.preventDefault === 'function') moveEvt.preventDefault();
    updateFromY(next.y, rect.top, rect.height);
  };
  const onUp = () => {
    bindWebVerticalDrag.active = false;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend', onUp);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

export function applyTrackDefaults(selected, setSelected, setTracks, tracksProp) {
  if (!Array.isArray(tracksProp)) return;
  setTracks(tracksProp);
  if (selected !== null) return;
  const active = tracksProp.find((t) => t.selected || t.active) || tracksProp[0];
  if (active) setSelected(active.id);
}

