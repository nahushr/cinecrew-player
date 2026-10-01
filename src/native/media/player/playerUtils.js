import { isWeb } from '../../../utils/runtimePlatform';
import { ASPECT_OPTIONS } from './playerConstants';

export const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
};

export const normalizeBrightness = (value) => Number(clampNumber(value, 0.1, 1, 1).toFixed(2));
export const normalizeVolume = (value) => Math.round(clampNumber(value, 0, 100, 100));

export function pickShuffleCandidate(candidates, season, episode) {
  if (candidates.length < 2) return candidates[0] || null;

  const cryptoProvider = globalThis.crypto;
  if (typeof cryptoProvider?.getRandomValues === 'function') {
    try {
      const randomValue = new Uint32Array(1);
      cryptoProvider.getRandomValues(randomValue);
      return candidates[randomValue[0] % candidates.length];
    } catch {
      // The fallback only selects an episode; it is not used for security tokens.
    }
  }

  const seed = `${season ?? ''}:${episode ?? ''}:${Date.now()}`;
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  return candidates[(hash >>> 0) % candidates.length];
}

export function normalizeAspectOptions(values) {
  if (!Array.isArray(values) || values.length === 0) return ASPECT_OPTIONS;
  const unique = new Map();
  values.forEach((item) => {
    const value = typeof item === 'string' ? item : item?.value;
    if (!value || typeof value !== 'string') return;
    unique.set(value, { value, label: typeof item === 'string' ? item : item.label || value });
  });
  return unique.size ? [...unique.values()] : ASPECT_OPTIONS;
}

export const scheduleControlFrame = (callback) => {
  if (typeof requestAnimationFrame === 'function') {
    return { kind: 'raf', id: requestAnimationFrame(callback) };
  }
  return { kind: 'timeout', id: setTimeout(callback, 16) };
};

export const cancelControlFrame = (handle) => {
  if (!handle) return;
  if (handle.kind === 'raf' && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle.id);
  } else {
    clearTimeout(handle.id);
  }
};

export const scheduleNativeVolumeFrame = (callback) => ({
  kind: 'timeout',
  id: setTimeout(callback, 32),
});

export const DEFAULT_ASPECT_RATIO = 'FIT';

export function getPanelActionName(tab) {
  if (tab === 'chat') return 'onLiveChatOpen';
  if (tab === 'epg') return 'onEpgOpen';
  return 'onDiagnosticsOpen';
}

export function normalizeProgressEvent(data, audioOffsetMs) {
  if (!data) return null;
  const payload = data.nativeEvent || data;
  let currentMs = payload.currentTime;
  let durationMs = payload.duration;
  const usePositionFallback = currentMs === null || currentMs === undefined || currentMs === 0;
  if (usePositionFallback && payload.position !== null && payload.position !== undefined && durationMs > 0) {
    currentMs = payload.position * durationMs;
  }
  if (audioOffsetMs > 0) {
    currentMs = Number(currentMs || 0) + audioOffsetMs;
    if (Number(durationMs) > 0) durationMs = Number(durationMs) + audioOffsetMs;
  }
  return {
    currentMs,
    durationMs,
    hasPosition: Number(currentMs) > 0 || Number(payload.position) > 0,
    seconds: Math.max(0, Math.floor((currentMs || 0) / 1000)),
    durationSeconds: Math.max(0, Math.floor((durationMs || 0) / 1000)),
  };
}

export function applyPendingSeek(pendingSeekRef, lastKnownDurationRef, audioOffsetSeconds, playerRef) {
  if (pendingSeekRef.current === null || pendingSeekRef.current === undefined || lastKnownDurationRef.current <= 0) return;
  const playerDuration = Math.max(0, lastKnownDurationRef.current - audioOffsetSeconds);
  const playerTarget = Math.max(0, Number(pendingSeekRef.current) - audioOffsetSeconds);
  const ratio = Math.max(0, Math.min(1, playerTarget / Math.max(playerDuration, 1)));
  pendingSeekRef.current = null;
  try {
    if (typeof playerRef.current?.seek === 'function') playerRef.current.seek(ratio);
  } catch {
    // Native seek is best-effort while the player is transitioning.
  }
}

export function applyProgressState(progress, state) {
  if (!progress) return;
  if (progress.hasPosition) {
    state.hasStartedPlaybackRef.current = true;
    state.clearAudioOnlyFallbackTimer();
    state.clearBufferingIndicator();
  } else if (state.hasStartedPlaybackRef.current) {
    state.clearBufferingIndicator();
  }
  if (progress.durationSeconds > 0) {
    state.setDuration(progress.durationSeconds);
    state.lastKnownDurationRef.current = progress.durationSeconds;
  }

  applyPendingSeek(state.pendingSeekRef, state.lastKnownDurationRef, state.audioOffsetSeconds, state.playerRef);
  const now = Date.now();
  if (state.isSeeking.current && now - state.seekCompletedAt.current > 2000) state.isSeeking.current = false;
  if (!state.isSeeking.current && now - state.seekCompletedAt.current > 1000) {
    state.setCurrentTime(progress.seconds);
    state.lastKnownTimeRef.current = progress.seconds;
    state.setSliderPosition(progress.seconds);
  }
}

export function handlePinchMove(touches, zoomState) {
  if (touches?.length !== 2) return false;
  const [firstTouch, secondTouch] = touches;
  const currentDistance = Math.hypot(firstTouch.pageX - secondTouch.pageX, firstTouch.pageY - secondTouch.pageY);
  if (zoomState.initialDistance.current === 0) {
    zoomState.initialDistance.current = currentDistance;
    zoomState.initialScale.current = zoomState.scale.current;
    return true;
  }
  if (zoomState.initialDistance.current > 0 && currentDistance > 0) {
    const ratio = currentDistance / zoomState.initialDistance.current;
    const nextScale = Math.max(0.25, Math.min(3.5, zoomState.initialScale.current * ratio));
    zoomState.scale.current = nextScale;
    zoomState.setScale(nextScale);
    zoomState.setBadge(`${Math.round(nextScale * 100)}% Zoom`);
    if (zoomState.badgeTimer.current) clearTimeout(zoomState.badgeTimer.current);
    zoomState.badgeTimer.current = setTimeout(() => zoomState.setBadge(''), 1500);
  }
  return true;
}

export function handleVerticalGestureMove(touches, gestureState) {
  if (!isWeb() || gestureState.isLocked.current) return;
  const touch = touches?.[0];
  if (!touch) return;
  const deltaY = gestureState.startY.current - touch.pageY;
  const deltaX = Math.abs(touch.pageX - gestureState.startX.current);
  if (!gestureState.isSwiping.current && Math.abs(deltaY) > 10 && Math.abs(deltaY) > deltaX * 0.8) {
    gestureState.isSwiping.current = true;
  }
  if (!gestureState.isSwiping.current) return;
  const dragHeight = Math.max(180, (gestureState.windowHeight.current || 400) * 0.55);
  const deltaPercent = (deltaY / dragHeight) * 100;
  if (gestureState.side.current === 'brightness') {
    const value = Math.max(0.1, Math.min(1, Number(((gestureState.startValue.current * 100 + deltaPercent) / 100).toFixed(2))));
    gestureState.commitBrightness.current(value);
    return;
  }
  const volume = Math.max(0, Math.min(100, Math.round(gestureState.startValue.current + deltaPercent)));
  gestureState.commitVolume.current(volume);
}

export function isUsableInlinePreviewRect(rect) {
  return Boolean(rect && rect.width > 20 && rect.height > 20 && rect.x > -1000 && rect.y > -1000);
}

export function getInlinePreviewPositionStyle(rect, isValid) {
  if (!isValid) return { opacity: 0 };
  const clippingStyle = isWeb() && rect.clipTop > 0
    ? { clipPath: `inset(${rect.clipTop}px 0 0 0)`, WebkitClipPath: `inset(${rect.clipTop}px 0 0 0)` }
    : {};
  return {
    position: isWeb() ? 'fixed' : 'absolute',
    top: rect.y,
    left: rect.x,
    right: null,
    bottom: null,
    width: rect.width,
    height: rect.height,
    ...clippingStyle,
  };
}
