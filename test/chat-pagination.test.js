import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chatPageHasMore,
  normalizeChatPage,
  getUserInitial,
  resolveUserAvatar,
} from '../src/native/media/chat/liveChatUtils.js';

const messages = Array.from({ length: 15 }, (_, index) => ({
  id: `message-${index + 1}`,
  comment: `Message ${index + 1}`,
}));

test('chat paging caps an integration that returns its entire history', () => {
  const response = { messages };
  const latest = normalizeChatPage(response, { limit: 5, offset: 0 });
  const older = normalizeChatPage(response, { limit: 5, offset: 5 });
  const oldest = normalizeChatPage(response, { limit: 5, offset: 10 });

  assert.deepEqual(latest.map(({ id }) => id), ['message-11', 'message-12', 'message-13', 'message-14', 'message-15']);
  assert.deepEqual(older.map(({ id }) => id), ['message-6', 'message-7', 'message-8', 'message-9', 'message-10']);
  assert.deepEqual(oldest.map(({ id }) => id), ['message-1', 'message-2', 'message-3', 'message-4', 'message-5']);
  assert.equal(chatPageHasMore(response, { limit: 5, offset: 0 }), true);
  assert.equal(chatPageHasMore(response, { limit: 5, offset: 10 }), false);
});

test('chat paging respects explicit pagination metadata and adapter-sized pages', () => {
  const page = { messages: messages.slice(-5), hasMore: false };

  assert.equal(normalizeChatPage(page, { limit: 5, offset: 0 }).length, 5);
  assert.equal(chatPageHasMore(page, { limit: 5, offset: 0 }), false);
  assert.equal(chatPageHasMore({ messages: [], hasMore: true }, { limit: 5, offset: 0 }), true);
});

test('chat avatar initial, image url, and custom user color resolution', () => {
  assert.equal(getUserInitial('Maya'), 'M');
  assert.equal(getUserInitial(' aarav '), 'A');
  assert.equal(getUserInitial(''), 'V');
  assert.equal(getUserInitial(null), 'V');

  // Custom users array with explicit colors or image URLs
  const customUsers = [
    { username: 'Maya', color: '#FF1493' },
    { id: 'user-42', username: 'Aarav', avatarUrl: 'https://example.com/aarav.png' },
    { username: 'Jordan', imageUrl: 'https://example.com/jordan.jpg', color: '#FFAB00' },
  ];

  // User with custom color
  const mayaAvatar = resolveUserAvatar({ username: 'Maya', userId: '1' }, customUsers);
  assert.equal(mayaAvatar.initial, 'M');
  assert.equal(mayaAvatar.color, '#FF1493');
  assert.equal(mayaAvatar.imageUrl, null);

  // User with avatar image URL
  const aaravAvatar = resolveUserAvatar({ username: 'Aarav', userId: 'user-42' }, customUsers);
  assert.equal(aaravAvatar.initial, 'A');
  assert.equal(aaravAvatar.imageUrl, 'https://example.com/aarav.png');

  // User with both image URL and color
  const jordanAvatar = resolveUserAvatar({ username: 'Jordan' }, customUsers);
  assert.equal(jordanAvatar.initial, 'J');
  assert.equal(jordanAvatar.imageUrl, 'https://example.com/jordan.jpg');
  assert.equal(jordanAvatar.color, '#FFAB00');

  // Direct author image URL on message item
  const inlineAvatar = resolveUserAvatar({ username: 'Sam', imageUrl: 'https://example.com/sam.png' }, customUsers);
  assert.equal(inlineAvatar.imageUrl, 'https://example.com/sam.png');

  // User without custom color or image receives neutral fallback, never random color
  const unknownAvatar = resolveUserAvatar({ username: 'Guest' }, customUsers);
  assert.equal(unknownAvatar.initial, 'G');
  assert.equal(unknownAvatar.imageUrl, null);
  assert.equal(unknownAvatar.color, '#4A5568');
});
