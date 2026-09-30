/** Run the core action when present, then notify the consuming app. */
export function invokePlayerAction(coreAction, callback, payload, context) {
  const result = typeof coreAction === 'function' ? coreAction(payload) : undefined;
  if (typeof callback !== 'function') return result;

  const notify = () => {
    try {
      callback(payload, context);
    } catch (error) {
      // A consumer notification must never roll back or block the player action.
      console.error('CineCrewPlayer action callback failed:', error);
    }
  };

  if (result && typeof result.then === 'function') {
    return result.then((value) => {
      notify();
      return value;
    });
  }

  notify();
  return result;
}
