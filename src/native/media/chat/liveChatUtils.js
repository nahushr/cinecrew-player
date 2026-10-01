export const DEFAULT_EPG_LIMIT = 48;

export const QUICK_REACTIONS = ['❤️', '🔥', '😂', '👏', '🙌', '😮', '💯'];

export const USER_COLORS = [
  '#4FC3F7', '#81D4FA', '#A7FFEB', '#FFD54F', '#FF8A80',
  '#EA80FC', '#B388FF', '#80D8FF', '#A5D6A7', '#FFE082',
];

export function getUserColor(username = '') {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.codePointAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function normalizeChatMessage(message) {
  return {
    ...message,
    username: message?.username || message?.userName || message?.name || 'Viewer',
    textContent: message?.textContent || message?.comment || message?.message || message?.text || '',
    createdAt: message?.createdAt || message?.timestamp || message?.sentAt || message?.time || null,
  };
}

export function normalizeChatPage(value) {
  const rows = Array.isArray(value)
    ? value
    : value?.messages || value?.items || value?.comments || value?.data || [];
  return Array.isArray(rows) ? rows.map(normalizeChatMessage) : [];
}

export function chatMessageKey(message, index) {
  if (message?.id !== undefined && message?.id !== null) return String(message.id);
  if (message?.messageId !== undefined && message?.messageId !== null) return String(message.messageId);
  return `${message?.username || ''}:${message?.createdAt || ''}:${message?.textContent || ''}:${index}`;
}

export function mergeChatMessages(existing, incoming, prepend = false) {
  const combined = prepend ? [...incoming, ...existing] : [...existing, ...incoming];
  const unique = new Map();
  combined.forEach((message, index) => unique.set(chatMessageKey(message, index), message));
  return [...unique.values()];
}

export function extractHostname(url) {
  if (!url) return 'Xtream Server';
  try {
    const clean = url.replace(/^[a-zA-Z]+:\/\//, '');
    return clean.split('/')[0] || url;
  } catch {
    return 'Xtream Server';
  }
}

export function detectStreamProtocol(url = '', isLive = false) {
  if (/\.m3u8(\?|$)/i.test(url)) return 'HLS Adaptive (m3u8)';
  if (/\.ts(\?|$)/i.test(url) || /\/live\//i.test(url)) return 'MPEG-TS Live (.ts)';
  if (/\.mkv(\?|$)/i.test(url)) return 'Matroska Video (.mkv)';
  if (/\.mp4(\?|$)/i.test(url)) return 'Direct Progressive (.mp4)';
  return isLive ? 'Live IPTV Stream' : 'VOD Media Stream';
}

export function detectAudioCodec(url = '') {
  if (/ac3|eac3|dolby/i.test(url)) return 'Dolby AC-3 5.1 Surround';
  if (/mp3/i.test(url)) return 'MPEG Audio Layer 3 (MP3)';
  return 'AAC-LC 2.0 Stereo (@ 192 kbps)';
}

export function formatEpgClock(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatEpgDayLabel(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function epgProgress(item, now = Date.now()) {
  if (!item?.startMs || item.endMs <= item.startMs) return 0;
  return Math.max(0, Math.min(1, (now - item.startMs) / (item.endMs - item.startMs)));
}

export const TAB_META = {
  chat: { icon: 'comment-text-multiple', title: 'Live Chat' },
  epg: { icon: 'television-guide', title: 'Programme Guide' },
  diagnostics: { icon: 'pulse', title: 'Stream Diagnostics' },
};
