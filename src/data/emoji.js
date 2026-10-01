import dataset from './emoji-data.json';

const EMOJI_GROUPS_WITHOUT_ITEMS = [
  { name: 'Smileys & Emotion', icon: '😀' },
  { name: 'People & Body', icon: '👋' },
  { name: 'Animals & Nature', icon: '🐻' },
  { name: 'Food & Drink', icon: '🍔' },
  { name: 'Travel & Places', icon: '🚗' },
  { name: 'Activities', icon: '⚽' },
  { name: 'Objects', icon: '💡' },
  { name: 'Symbols', icon: '❤️' },
  { name: 'Flags', icon: '🏳️' },
];

const emojiGroupsByName = new Map(EMOJI_GROUPS_WITHOUT_ITEMS.map((group) => [
  group.name,
  { ...group, items: [] },
]));

dataset.forEach((item) => {
  if (item.status !== 'fully-qualified') return;
  emojiGroupsByName.get(item.group)?.items.push(item);
});

export const EMOJI_GROUPS = EMOJI_GROUPS_WITHOUT_ITEMS.map((group) => emojiGroupsByName.get(group.name));

export const EMOJI_ITEMS = EMOJI_GROUPS.flatMap((group) => group.items);
const SEARCHABLE_EMOJIS = EMOJI_ITEMS.map((item) => ({
  item,
  searchText: [
    item.short_name,
    item.description,
    ...(item.aliases || []),
    ...(item.keywords || []),
  ].join(' ').toLocaleLowerCase(),
}));

export function searchEmojis(query) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase();
  if (!normalizedQuery) return EMOJI_ITEMS;

  return SEARCHABLE_EMOJIS
    .filter(({ searchText }) => searchText.includes(normalizedQuery))
    .map(({ item }) => item);
}
