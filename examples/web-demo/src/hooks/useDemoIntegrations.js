import { useMemo, useRef, useState } from 'react';
import { createSampleChatMessages } from '../chatSamples.js';

export function useDemoIntegrations(notify) {
  const [sampleMessages, setSampleMessages] = useState(createSampleChatMessages);
  const sampleMessagesRef = useRef(sampleMessages);
  sampleMessagesRef.current = sampleMessages;

  return useMemo(() => ({
    user: { id: 'demo-viewer', username: 'You' },
    liveChat: {
      pollIntervalMs: 10000,
      loadMessages: async ({ limit, offset = 0 }) => {
        const messages = sampleMessagesRef.current;
        const end = Math.max(0, messages.length - offset);
        const start = Math.max(0, end - limit);
        return { messages: messages.slice(start, end), hasMore: start > 0 };
      },
      sendMessage: async ({ username, comment }) => {
        const sentMessage = {
          id: `demo-message-${Date.now()}`,
          username,
          comment: String(comment || ''),
          timestamp: new Date().toISOString(),
        };
        sampleMessagesRef.current = [...sampleMessagesRef.current, sentMessage];
        setSampleMessages(sampleMessagesRef.current);
        notify('Message sent', `${username || 'You'}: ${sentMessage.comment}`);
      },
    },
    epg: {
      loadListings: async () => {
        const now = Date.now();
        return [
          { id: 'demo-epg-1', title: 'Live coverage', startMs: now - 20 * 60_000, endMs: now + 40 * 60_000, description: 'The event is underway.' },
          { id: 'demo-epg-2', title: 'Post-match analysis', startMs: now + 40 * 60_000, endMs: now + 90 * 60_000 },
          { id: 'demo-epg-3', title: 'Highlights', startMs: now + 90 * 60_000, endMs: now + 120 * 60_000 },
        ];
      },
    },
  }), [notify]);
}
