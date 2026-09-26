function messageFrom(value) {
  if (typeof value === 'string') return value.trim();
  if (value instanceof Error) return value.message?.trim() || '';
  if (!value || typeof value !== 'object') return '';

  // Prefer messages from the underlying media engine over a wrapper's
  // user-facing summary so callers can log or display the real diagnostic.
  const candidates = [
    value.actualMessage,
    value.err?.msg,
    value.err?.message,
    value.err?.error?.msg,
    value.err?.error?.message,
    value.err,
    value.cause?.msg,
    value.cause?.message,
    value.cause,
    value.error?.msg,
    value.error?.message,
    value.error,
    value.msg,
    value.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

/** Return the most specific available diagnostic from a browser/native player error. */
export function getPlayerErrorMessage(error) {
  return messageFrom(error);
}
