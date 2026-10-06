export const DEFAULT_EPG_LIMIT = 48;

export const QUICK_REACTIONS = ['❤️', '🔥', '😂', '👏', '🙌', '😮', '💯'];

export function getUserInitial(username = '') {
  const clean = String(username || '').trim();
  return clean ? clean.charAt(0).toUpperCase() : 'V';
}

export function findUserMetadata(username = '', userId = '', users = []) {
  if (!Array.isArray(users) || users.length === 0) return {};
  const cleanUser = String(username || '').trim().toLowerCase();
  const cleanId = String(userId || '').trim().toLowerCase();
  return users.find((u) => {
    if (!u) return false;
    const uName = String(u.username || u.name || '').trim().toLowerCase();
    const uId = String(u.id || u.userId || '').trim().toLowerCase();
    return Boolean((cleanId && uId === cleanId) || (cleanUser && uName === cleanUser));
  }) || {};
}

export function resolveUserAvatar(author = {}, users = []) {
  const username = author.username || author.userName || author.name || '';
  const userId = author.userId || author.id || '';
  const userMeta = findUserMetadata(username, userId, users);

  const imageUrl = author.avatarUrl
    || author.avatar
    || author.image
    || author.imageUrl
    || userMeta?.avatarUrl
    || userMeta?.avatar
    || userMeta?.image
    || userMeta?.imageUrl
    || null;

  const color = author.color
    || author.avatarColor
    || author.backgroundColor
    || userMeta?.color
    || userMeta?.avatarColor
    || userMeta?.backgroundColor
    || '#4A5568';

  const initial = getUserInitial(username);

  return {
    imageUrl: imageUrl ? String(imageUrl).trim() : null,
    color,
    initial,
  };
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

function getChatRows(value) {
  const rows = Array.isArray(value)
    ? value
    : value?.messages || value?.items || value?.comments || value?.data || [];
  return Array.isArray(rows) ? rows : [];
}

export function normalizeChatPage(value, { limit, offset = 0 } = {}) {
  const rows = getChatRows(value).map(normalizeChatMessage);
  const pageLimit = Math.floor(Number(limit));
  if (!Number.isFinite(pageLimit) || pageLimit < 1 || rows.length <= pageLimit) return rows;

  // Some integrations return their full in-memory history even when limit and
  // offset are supplied. Keep the player paged in that case as well. Offsets
  // count backward from the newest message, matching the chat adapter API.
  const pageEnd = Math.max(0, rows.length - Math.max(0, Math.floor(Number(offset) || 0)));
  return rows.slice(Math.max(0, pageEnd - pageLimit), pageEnd);
}

export function chatPageHasMore(value, { limit, offset = 0 } = {}) {
  const explicitHasMore = value?.hasMore ?? value?.pagination?.hasMore;
  if (explicitHasMore !== undefined) return Boolean(explicitHasMore);

  const pageLimit = Math.max(1, Math.floor(Number(limit) || 1));
  const pageOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const count = getChatRows(value).length;
  if (count > pageLimit) return count > pageOffset + pageLimit;
  return count >= pageLimit;
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
