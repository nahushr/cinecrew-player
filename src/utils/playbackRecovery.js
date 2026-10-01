export function playPlayer(player) {
  try {
    const result = player?.play?.();
    if (result && typeof result.catch === 'function') return result.catch(() => {});
    return result;
  } catch {
    return undefined;
  }
}

export function resumePlayerAfterSeek(player, seekResult, shouldResume) {
  if (!shouldResume) return seekResult;

  const resume = () => playPlayer(player);
  if (seekResult && typeof seekResult.then === 'function') {
    return Promise.resolve(seekResult).then(resume, resume);
  }
  return resume();
}
