export function cleanPlayerTitle(title, episodeLabel, isMobile = false) {
  const clean = String(title || '').trim();
  if (!clean) return 'Now Playing';
  const episode = String(episodeLabel || '').trim();
  if (!isMobile || !episode || clean.toLowerCase().includes(episode.toLowerCase())) return clean;
  return clean;
}
