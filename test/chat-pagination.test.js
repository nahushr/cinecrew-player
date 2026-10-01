import assert from 'node:assert/strict';
import test from 'node:test';
import { chatPageHasMore, normalizeChatPage } from '../src/native/media/chat/liveChatUtils.js';

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
