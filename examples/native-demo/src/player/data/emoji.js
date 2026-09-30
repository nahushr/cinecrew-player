import dataset from './emoji-data.json';

export const EMOJI_GROUPS = [
  { name: 'Smileys & Emotion', icon: '😀' },
  { name: 'People & Body', icon: '👋' },
  { name: 'Animals & Nature', icon: '🐻' },
  { name: 'Food & Drink', icon: '🍔' },
  { name: 'Travel & Places', icon: '🚗' },
  { name: 'Activities', icon: '⚽' },
  { name: 'Objects', icon: '💡' },
  { name: 'Symbols', icon: '❤️' },
  { name: 'Flags', icon: '🏳️' },
].map((group) => ({
  ...group,
  items: dataset.filter((item) => item.status === 'fully-qualified' && item.group === group.name),
}));

export const EMOJI_ITEMS = EMOJI_GROUPS.flatMap((group) => group.items);

export function searchEmojis(query) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
  if (!normalizedQuery) return EMOJI_ITEMS;

  return EMOJI_ITEMS.filter((item) => [
    item.short_name,
    item.description,
    ...(item.aliases || []),
    ...(item.keywords || []),
  ].some((value) => String(value || '').toLocaleLowerCase().includes(normalizedQuery)));
}
