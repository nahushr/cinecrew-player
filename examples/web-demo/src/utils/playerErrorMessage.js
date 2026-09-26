/** Prefer the decoder/network exception over a friendly player-overlay summary. */
export function getPlayerErrorMessage(error) {
  const candidates = [
    error?.actualMessage,
    error?.cause?.msg,
    error?.cause?.message,
    error?.err?.msg,
    error?.err?.message,
    error?.err?.error?.message,
    error?.err,
    error?.cause,
    error?.message,
  ];
  return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())?.trim() || '';
}
