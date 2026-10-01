import { parsePlaybackStartTime } from './playbackTime.js';
import { formatProgressBarTime } from './progressBarTime.js';

/** Carry the playback position when a host remounts its player for fullscreen. */
export function createFullscreenPlaybackState(isFullscreen, position) {
  const currentTime = parsePlaybackStartTime(position) ?? 0;
  return {
    isFullscreen: Boolean(isFullscreen),
    currentTime,
    startTime: currentTime,
    position: currentTime,
    progressTime: formatProgressBarTime(currentTime),
  };
}
