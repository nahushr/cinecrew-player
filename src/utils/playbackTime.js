/**
 * Convert a public playback start-time value to seconds.
 * Accepts seconds or a zero-padded HH:MM:SS string.
 */
export function parsePlaybackStartTime(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const matchHms = /^(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)$/.exec(trimmed);
  if (matchHms) {
    const hours = Number(matchHms[1]);
    const minutes = Number(matchHms[2]);
    const seconds = Number(matchHms[3]);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return Number.isFinite(totalSeconds) ? totalSeconds : null;
  }

  const matchMs = /^([0-5]?\d):([0-5]\d(?:\.\d+)?)$/.exec(trimmed);
  if (matchMs) {
    const minutes = Number(matchMs[1]);
    const seconds = Number(matchMs[2]);
    const totalSeconds = minutes * 60 + seconds;
    return Number.isFinite(totalSeconds) ? totalSeconds : null;
  }

  return null;
}
