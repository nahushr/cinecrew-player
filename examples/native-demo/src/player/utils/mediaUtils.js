/** True for app-local media URIs/paths rather than network streams. */
export function isLocalMediaUri(uri) {
  const value = String(uri || '').trim();
  if (!value) return false;
  return /^(?:file|content|assets-library|ph|data):/i.test(value)
    || /^(?:\.\.?\/|\/|~\/)/.test(value);
}

export function cleanPlayerTitle(title, episodeLabel, isMobile = false) {
  const clean = String(title || '').trim();
  if (!clean) return 'Now Playing';
  const episode = String(episodeLabel || '').trim();
  if (!isMobile || !episode || clean.toLowerCase().includes(episode.toLowerCase())) return clean;
  return clean;
}
