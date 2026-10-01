/**
 * Convert a public playback start-time value to seconds.
 * Accepts seconds or a zero-padded HH:MM:SS string.
 */
export function parsePlaybackStartTime(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string') return null;

  const match = value.trim().match(/^(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return Number.isFinite(totalSeconds) ? totalSeconds : null;
}
