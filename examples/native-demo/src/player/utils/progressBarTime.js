/** Format a player position as an unambiguous, zero-padded HH:MM:SS value. */
export function formatProgressBarTime(seconds) {
  const totalSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
}

/**
 * Emit one progress-bar callback per whole playback second, while allowing
 * completed seeks/restarts to report immediately even within the same second.
 */
export function emitProgressBarTime(seconds, callback, lastSecondRef, { force = false } = {}) {
  if (typeof callback !== 'function') return false;
  const normalizedSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  const wholeSecond = Math.floor(normalizedSeconds);
  const report = (value) => {
    try {
      callback(formatProgressBarTime(value));
    } catch (error) {
      // Progress observers must not interrupt media playback or native updates.
      console.error('CineCrewPlayer progress-bar callback failed:', error);
    }
  };

  if (force) {
    lastSecondRef.current = wholeSecond;
    report(normalizedSeconds);
    return true;
  }

  if (lastSecondRef.current === null || lastSecondRef.current === undefined) {
    lastSecondRef.current = wholeSecond;
    if (wholeSecond === 0) return false;
    report(normalizedSeconds);
    return true;
  }
  if (wholeSecond <= lastSecondRef.current) return false;

  for (let elapsedSecond = lastSecondRef.current + 1; elapsedSecond <= wholeSecond; elapsedSecond += 1) {
    report(elapsedSecond);
  }
  lastSecondRef.current = wholeSecond;
  return true;
}
