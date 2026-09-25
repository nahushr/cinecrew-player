import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { isIOS, isWeb } from '../../utils/runtimePlatform';
import { EmojiPickerModal } from './EmojiPickerModal';
import { PlayerIcon } from '../customization';

const DEFAULT_EPG_LIMIT = 48;

const QUICK_REACTIONS = ['❤️', '🔥', '😂', '👏', '🙌', '😮', '💯'];

const USER_COLORS = [
  '#4FC3F7', '#81D4FA', '#A7FFEB', '#FFD54F', '#FF8A80',
  '#EA80FC', '#B388FF', '#80D8FF', '#A5D6A7', '#FFE082',
];

function getUserColor(username = '') {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.codePointAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function normalizeChatMessage(message) {
  return {
    ...message,
    username: message?.username || message?.userName || message?.name || 'Viewer',
    textContent: message?.textContent || message?.comment || message?.message || message?.text || '',
    createdAt: message?.createdAt || message?.timestamp || message?.sentAt || message?.time || null,
  };
}

function normalizeChatPage(value) {
  const rows = Array.isArray(value)
    ? value
    : value?.messages || value?.items || value?.comments || value?.data || [];
  return Array.isArray(rows) ? rows.map(normalizeChatMessage) : [];
}

function chatMessageKey(message, index) {
  if (message?.id !== undefined && message?.id !== null) return String(message.id);
  if (message?.messageId !== undefined && message?.messageId !== null) return String(message.messageId);
  return `${message?.username || ''}:${message?.createdAt || ''}:${message?.textContent || ''}:${index}`;
}

function mergeChatMessages(existing, incoming, prepend = false) {
  const combined = prepend ? [...incoming, ...existing] : [...existing, ...incoming];
  const unique = new Map();
  combined.forEach((message, index) => unique.set(chatMessageKey(message, index), message));
  return [...unique.values()];
}

function extractHostname(url) {
  if (!url) return 'Xtream Server';
  try {
    const clean = url.replace(/^[a-zA-Z]+:\/\//, '');
    return clean.split('/')[0] || url;
  } catch {
    return 'Xtream Server';
  }
}

function detectStreamProtocol(url = '', isLive = false) {
  if (/\.m3u8(\?|$)/i.test(url)) return 'HLS Adaptive (m3u8)';
  if (/\.ts(\?|$)/i.test(url) || /\/live\//i.test(url)) return 'MPEG-TS Live (.ts)';
  if (/\.mkv(\?|$)/i.test(url)) return 'Matroska Video (.mkv)';
  if (/\.mp4(\?|$)/i.test(url)) return 'Direct Progressive (.mp4)';
  return isLive ? 'Live IPTV Stream' : 'VOD Media Stream';
}

function detectAudioCodec(url = '') {
  if (/ac3|eac3|dolby/i.test(url)) return 'Dolby AC-3 5.1 Surround';
  if (/mp3/i.test(url)) return 'MPEG Audio Layer 3 (MP3)';
  return 'AAC-LC 2.0 Stereo (@ 192 kbps)';
}

function formatEpgClock(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatEpgDayLabel(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function epgProgress(item, now = Date.now()) {
  if (!item?.startMs || item.endMs <= item.startMs) return 0;
  return Math.max(0, Math.min(1, (now - item.startMs) / (item.endMs - item.startMs)));
}

const TAB_META = {
  chat: { icon: 'comment-text-multiple', title: 'Live Chat' },
  epg: { icon: 'television-guide', title: 'Programme Guide' },
  diagnostics: { icon: 'pulse', title: 'Stream Diagnostics' },
};

export const LiveChatDrawer = ({
  videoId,
  userId,
  username,
  visible,
  onClose,
  isLandscape = true,
  initialTab = 'chat',
  streamUrl = '',
  serverUrl = '',
  isLive = false,
  isLiveCommentsEnabled = true,
  isEpgEnabled = false,
  diagnosticsEnabled = true,
  title = '',
  streamId,
  popupMode = false,
  integrations = {},
  colors,
  messagePageSize = 50,
  drawerStyle,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const pageSize = Math.max(1, Math.floor(Number(messagePageSize) || 50));
  const chatAvailable = isLive && isLiveCommentsEnabled && typeof integrations.liveChat?.loadMessages === 'function';
  const epgAvailable = isLive && isEpgEnabled && typeof integrations.epg?.loadListings === 'function';
  const canShowDiagnostics = diagnosticsEnabled !== false;

  const pickPanel = (tab) => {
    if (tab === 'chat' && chatAvailable) return 'chat';
    if (tab === 'epg' && epgAvailable) return 'epg';
    if (tab === 'diagnostics' && canShowDiagnostics) return 'diagnostics';
    if (chatAvailable) return 'chat';
    if (epgAvailable) return 'epg';
    return 'diagnostics';
  };

  const [activeTab, setActiveTab] = useState(() => pickPanel(initialTab));

  useEffect(() => {
    setActiveTab(pickPanel(initialTab));
  }, [initialTab, chatAvailable, epgAvailable, canShowDiagnostics]);

  // --- Live Chat State ---
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [chatError, setChatError] = useState('');
  const flatListRef = useRef(null);
  const messageOffsetRef = useRef(0);
  const loadedInitialPageRef = useRef(false);
  const scrollChatToEndRef = useRef(false);

  // --- Stream Diagnostics Telemetry State ---
  const [pingLatency, setPingLatency] = useState(null);
  const [pingJitter, setPingJitter] = useState(null);
  const previousPingRef = useRef(null);

  const serverHost = useMemo(() => extractHostname(streamUrl || serverUrl), [streamUrl, serverUrl]);
  const protocolName = useMemo(() => detectStreamProtocol(streamUrl, isLive), [streamUrl, isLive]);
  const audioCodecName = useMemo(() => detectAudioCodec(streamUrl), [streamUrl]);

  // Subscribe to live chat events when videoId is mounted
  useEffect(() => {
    if (!visible || !videoId || !chatAvailable) {
      setMessagesLoading(false);
      return;
    }

    let isMounted = true;
    let initialLoad = true;
    setMessages([]);
    setHasMoreMessages(false);
    setChatError('');
    setLoadingOlderMessages(false);
    messageOffsetRef.current = 0;
    loadedInitialPageRef.current = false;
    scrollChatToEndRef.current = true;
    setMessagesLoading(true);
    const poll = async () => {
      try {
        const response = await integrations.liveChat.loadMessages({ channelId: String(videoId), limit: pageSize, offset: 0 });
        const msgs = normalizeChatPage(response);
        if (isMounted) {
          setMessages((current) => loadedInitialPageRef.current
            ? mergeChatMessages(current, msgs)
            : msgs);
          if (!loadedInitialPageRef.current) {
            loadedInitialPageRef.current = true;
            messageOffsetRef.current = msgs.length;
            const explicitHasMore = response?.hasMore ?? response?.pagination?.hasMore;
            setHasMoreMessages(explicitHasMore === undefined ? msgs.length >= pageSize : Boolean(explicitHasMore));
          }
          setChatError('');
        }
      } catch (error) {
        if (isMounted && initialLoad) setChatError(error?.message || 'Could not load live chat.');
      }
      finally {
        if (isMounted && initialLoad) {
          initialLoad = false;
          setMessagesLoading(false);
        }
      }
    };

    poll();
    const intervalMs = Math.max(1000, Number(integrations.liveChat.pollIntervalMs) || 5000);
    const timer = setInterval(poll, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [visible, videoId, chatAvailable, integrations.liveChat, pageSize]);

  const loadOlderMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingOlderMessages || !chatAvailable) return;
    setLoadingOlderMessages(true);
    setChatError('');
    try {
      const offset = messageOffsetRef.current;
      const response = await integrations.liveChat.loadMessages({
        channelId: String(videoId),
        limit: pageSize,
        offset,
      });
      const olderMessages = normalizeChatPage(response);
      if (olderMessages.length) {
        setMessages((current) => mergeChatMessages(current, olderMessages, true));
        messageOffsetRef.current += olderMessages.length;
      }
      const explicitHasMore = response?.hasMore ?? response?.pagination?.hasMore;
      setHasMoreMessages(explicitHasMore === undefined
        ? olderMessages.length >= pageSize
        : Boolean(explicitHasMore));
    } catch (error) {
      setChatError(error?.message || 'Could not load older messages.');
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [hasMoreMessages, loadingOlderMessages, chatAvailable, integrations.liveChat, videoId, pageSize]);

  const epgStreamId = streamId || videoId;
  const [epgListings, setEpgListings] = useState([]);
  const [epgLoading, setEpgLoading] = useState(false);
  const [epgError, setEpgError] = useState('');
  const [epgNow, setEpgNow] = useState(() => Date.now());
  const epgListRef = useRef(null);

  useEffect(() => {
    if (!visible || !epgAvailable || activeTab !== 'epg') return undefined;

    let cancelled = false;
    const load = async () => {
      setEpgLoading(true);
      setEpgError('');
      setEpgListings([]);
      try {
        const listings = await integrations.epg.loadListings({
          channelId: epgStreamId,
          limit: Number(integrations.epg.limit) || DEFAULT_EPG_LIMIT,
        });
        if (!cancelled) {
          setEpgListings(Array.isArray(listings) ? listings : []);
          setEpgNow(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setEpgListings([]);
          setEpgError(err?.message || 'Could not load the programme guide.');
        }
      } finally {
        if (!cancelled) setEpgLoading(false);
      }
    };

    load();
    const tick = setInterval(() => setEpgNow(Date.now()), 30000);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [visible, epgAvailable, activeTab, epgStreamId, integrations.epg]);

  useEffect(() => {
    if (activeTab !== 'epg' || !epgListings.length || !epgListRef.current) return;
    const nowIndex = epgListings.findIndex((item) => item.startMs <= Date.now() && Date.now() < item.endMs);
    if (nowIndex < 0) return;
    const timer = setTimeout(() => {
      epgListRef.current?.scrollToIndex({ index: nowIndex, animated: true, viewPosition: 0.2 });
    }, 80);
    return () => clearTimeout(timer);
  }, [activeTab, epgListings]);

  // Avoid snapping to the bottom when an older page is prepended.
  useEffect(() => {
    if (scrollChatToEndRef.current && messages.length > 0 && flatListRef.current && activeTab === 'chat') {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
      scrollChatToEndRef.current = false;
    }
  }, [messages.length, activeTab]);

  // Real-time Ping Latency Probe to Server
  const measurePing = useCallback(async () => {
    const targetUrl = serverUrl || streamUrl;
    if (!targetUrl) {
      setPingLatency(null);
      setPingJitter(null);
      previousPingRef.current = null;
      return;
    }

    try {
      let pingOrigin = targetUrl;
      try {
        const parsed = new URL(targetUrl);
        pingOrigin = `${parsed.protocol}//${parsed.host}`;
      } catch {
        // use targetUrl
      }

      const start = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);

      try {
        await fetch(pingOrigin, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const elapsed = Date.now() - start;
      const cleanLatency = Math.max(8, Math.min(elapsed, 999));

      setPingJitter(
        previousPingRef.current === null
          ? null
          : Math.abs(cleanLatency - previousPingRef.current),
      );
      previousPingRef.current = cleanLatency;
      setPingLatency(cleanLatency);
    } catch {
      setPingLatency(null);
      setPingJitter(null);
      previousPingRef.current = null;
    }
  }, [serverUrl, streamUrl]);

  // Periodic Telemetry Updates when Diagnostics is active
  useEffect(() => {
    if (!visible || activeTab !== 'diagnostics') return;

    measurePing();
    const interval = setInterval(measurePing, 3000);

    return () => clearInterval(interval);
  }, [visible, activeTab, measurePing]);

  const handleSend = useCallback(async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending || !videoId) return;

    scrollChatToEndRef.current = true;
    if (!textToSend) setInputText('');
    setIsSending(true);

    try {
      const activeUsername = username || 'Viewer';
      await integrations.liveChat?.sendMessage?.({
        channelId: String(videoId),
        userId: userId || null,
        username: activeUsername,
        comment: text,
      });
      const response = await integrations.liveChat?.loadMessages?.({ channelId: String(videoId), limit: pageSize, offset: 0 }).catch?.(() => null);
      if (response) {
        const msgs = normalizeChatPage(response);
        setMessages((current) => mergeChatMessages(current, msgs));
      }
    } catch {
      // Error handled
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, videoId, userId, username, integrations.liveChat, pageSize]);

  const handleSelectEmoji = useCallback((emoji) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const handleQuickReaction = useCallback((emoji) => {
    handleSend(emoji);
  }, [handleSend]);

  if (!visible) return null;

  const renderMessageItem = ({ item }) => {
    const color = getUserColor(item.username);
    const initial = (item.username || 'V').charAt(0).toUpperCase();
    const timeStr = formatMessageTime(item.createdAt);

    return (
      <View style={[styles.messageRow, item.isPending && styles.messagePending]}>
        <View style={[styles.userAvatar, { backgroundColor: color }]}>
          <Text style={styles.userAvatarText}>{initial}</Text>
        </View>

        <View style={styles.messageContentWrap}>
          <View style={styles.metaRow}>
            {!!timeStr && <Text style={styles.timeText}>{timeStr}</Text>}
            <Text style={[styles.usernameText, { color }]}>
              @{item.username || 'Viewer'}
            </Text>
          </View>
          <Text style={styles.messageBodyText}>{item.textContent}</Text>
        </View>
      </View>
    );
  };

  const renderEpgItem = ({ item, index }) => {
    const isNow = item.startMs <= epgNow && epgNow < item.endMs;
    const isPast = item.endMs > 0 && item.endMs <= epgNow;
    const prev = epgListings[index - 1];
    const showDay = !prev || new Date(prev.startMs).toDateString() !== new Date(item.startMs).toDateString();
    const progress = isNow ? epgProgress(item, epgNow) : 0;
    const timeLabel = item.endMs
      ? `${formatEpgClock(item.startMs)} – ${formatEpgClock(item.endMs)}`
      : formatEpgClock(item.startMs);

    return (
      <View>
        {showDay ? (
          <Text style={styles.epgDayLabel}>{formatEpgDayLabel(item.startMs)}</Text>
        ) : null}
        <View style={[
          styles.epgCard,
          isNow && styles.epgCardNow,
          isPast && styles.epgCardPast,
        ]}>
          <View style={styles.epgCardTop}>
            <Text style={[styles.epgTime, isNow && styles.epgTimeNow]}>{timeLabel}</Text>
            {isNow ? (
              <View style={styles.epgNowBadge}>
                <Text style={styles.epgNowBadgeText}>NOW</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.epgTitle, isPast && styles.epgTitlePast]} numberOfLines={2}>
            {item.title}
          </Text>
          {!!item.description && (
            <Text style={styles.epgDescription} numberOfLines={3}>
              {item.description}
            </Text>
          )}
          {isNow ? (
            <View style={styles.epgProgressTrack}>
              <View style={[styles.epgProgressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const getHealthStatus = () => {
    if (pingLatency === null) return { label: 'UNKNOWN', color: '#94A3B8' };
    if (pingLatency < 75) return { label: 'EXCELLENT', color: '#00E5FF' };
    if (pingLatency < 180) return { label: 'GOOD', color: '#34C759' };
    return { label: 'HIGH LATENCY', color: '#FF9500' };
  };

  const health = getHealthStatus();

  const drawerContent = (
    <KeyboardAvoidingView
      behavior={isIOS() ? 'padding' : undefined}
      style={[
        styles.drawerContainer,
        isLandscape ? styles.drawerLandscape : styles.drawerPortrait,
        popupMode && styles.popupDrawer,
        popupMode && {
          width: Math.min(Math.max(windowWidth - 32, 280), 520),
          height: Math.min(Math.max(windowHeight - 32, 280), 680),
        },
        drawerStyle,
      ]}
    >
      {/* Header with Close Button & Title */}
      <View style={styles.drawerHeader}>
        <View style={styles.headerTitleWrap}>
          <PlayerIcon
            name={TAB_META[activeTab]?.icon || 'information'}
            size={18}
            color="#00E5FF"
          />
          <Text style={styles.headerTitle}>
            {TAB_META[activeTab]?.title || 'Overlay'}
          </Text>
          {activeTab === 'chat' && (
            <View style={styles.viewerBadge}>
              <PlayerIcon name="account-group" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.viewerBadgeText}>Live</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.closeHeaderBtn} onPress={onClose} hitSlop={10}>
          <PlayerIcon name="close" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* --- Tab 1: Live Chat --- */}
      {activeTab === 'chat' && chatAvailable && (
        <>
          {/* Community Notice */}
          <View style={styles.welcomeBanner}>
            <PlayerIcon name="shield-check" size={16} color="#00E5FF" style={{ marginTop: 2 }} />
            <Text style={styles.welcomeText}>
              Welcome to live chat! Remember to guard your privacy and abide by community guidelines.
            </Text>
          </View>

          {/* Messages List */}
          {messagesLoading && messages.length === 0 ? (
            <View style={styles.chatLoadingWrap}>
              <ActivityIndicator size="small" color="#00E5FF" />
              <Text style={styles.epgStatusText}>Loading live chat…</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item, index) => chatMessageKey(item, index)}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={hasMoreMessages ? (
                <TouchableOpacity
                  style={styles.loadMoreMessages}
                  onPress={loadOlderMessages}
                  disabled={loadingOlderMessages}
                  accessibilityRole="button"
                >
                  {loadingOlderMessages ? <ActivityIndicator size="small" color="#00E5FF" /> : null}
                  <Text style={styles.loadMoreMessagesText}>
                    {loadingOlderMessages ? 'Loading older messages…' : 'See more messages'}
                  </Text>
                </TouchableOpacity>
              ) : null}
              ListEmptyComponent={<Text style={styles.epgStatusText}>No messages yet. Start the conversation.</Text>}
            />
          )}
          {!!chatError && <Text style={styles.chatErrorText}>{chatError}</Text>}

          {/* Quick Reaction Bar */}
          <View style={styles.quickReactionsRow}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.quickReactionBtn}
                onPress={() => handleQuickReaction(emoji)}
                activeOpacity={0.6}
              >
                <Text style={styles.quickReactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bottom Input Bar */}
          <View style={styles.inputBarContainer}>
            <View style={styles.inputPill}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Chat..."
                placeholderTextColor="rgba(255, 255, 255, 0.4)"
                onSubmitEditing={() => handleSend()}
                returnKeyType="send"
                maxLength={400}
              />

              <TouchableOpacity
                style={styles.emojiToggleBtn}
                onPress={() => setShowEmojiPicker(true)}
                hitSlop={6}
              >
                <PlayerIcon name="emoticon-happy-outline" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || isSending) && styles.sendBtnDisabled,
              ]}
              onPress={() => handleSend()}
              disabled={!inputText.trim() || isSending}
              hitSlop={8}
            >
              <PlayerIcon
                name="send"
                size={18}
                color={inputText.trim() && !isSending ? '#000' : 'rgba(255, 255, 255, 0.3)'}
              />
            </TouchableOpacity>
          </View>

          {/* Emoji Picker Modal */}
          <EmojiPickerModal
            visible={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onSelectEmoji={handleSelectEmoji}
            colors={colors}
          />
        </>
      )}

      {activeTab === 'epg' && epgAvailable && (
        <>
          {!!title && (
            <View style={styles.welcomeBanner}>
              <PlayerIcon name="television" size={16} color="#00E5FF" style={{ marginTop: 2 }} />
              <Text style={styles.welcomeText} numberOfLines={2}>
                {title}
              </Text>
            </View>
          )}

          {(() => {
            if (epgLoading && !epgListings.length) {
              return (
                <View style={styles.epgStatusWrap}>
                  <ActivityIndicator size="small" color="#00E5FF" />
                  <Text style={styles.epgStatusText}>Loading programme guide…</Text>
                </View>
              );
            }
            if (epgError && !epgListings.length) {
              return (
                <View style={styles.epgStatusWrap}>
                  <PlayerIcon name="calendar-remove" size={28} color="rgba(255,255,255,0.45)" />
                  <Text style={styles.epgStatusText}>{epgError}</Text>
                </View>
              );
            }
            if (!epgListings.length) {
              return (
                <View style={styles.epgStatusWrap}>
                  <PlayerIcon name="television-off" size={28} color="rgba(255,255,255,0.45)" />
                  <Text style={styles.epgStatusText}>No programme guide for this channel.</Text>
                </View>
              );
            }
            return (
              <FlatList
                ref={epgListRef}
                style={styles.epgFlatList}
                data={epgListings}
                keyExtractor={(item, index) => `${String(item.id || 'epg')}-${index}`}
                renderItem={renderEpgItem}
                contentContainerStyle={styles.epgList}
                showsVerticalScrollIndicator
                onScrollToIndexFailed={({ index }) => {
                  setTimeout(() => {
                    epgListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
                  }, 120);
                }}
              />
            );
          })()}
        </>
      )}

      {/* --- Tab 2: Provider Health & Stream Diagnostics HUD --- */}
      {activeTab === 'diagnostics' && (
        <ScrollView
          style={styles.diagnosticsContainer}
          contentContainerStyle={styles.diagnosticsContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Health Status Bar */}
          <View style={styles.healthStatusBar}>
            <View style={styles.healthStatusLeft}>
              <View style={[styles.healthDot, { backgroundColor: health.color }]} />
              <Text style={[styles.healthStatusText, { color: health.color }]}>
                {health.label}
              </Text>
            </View>
          </View>

          {/* 4 Primary Metric Cards */}
          <View style={styles.metricsGrid}>
            {/* Ping Latency Card */}
            <View style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <PlayerIcon name="speedometer" size={16} color="#00E5FF" />
                <Text style={styles.metricCardLabel}>HTTP PING</Text>
              </View>
              <Text style={[styles.metricCardValue, { color: health.color }]}>
                {pingLatency !== null ? `${pingLatency} ms` : 'Testing...'}
              </Text>
              <Text style={styles.metricCardSub}>
                Jitter: {pingJitter === null ? 'unavailable' : `${pingJitter} ms`}
              </Text>
            </View>

            {/* Bitrate Card */}
            <View style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <PlayerIcon name="lightning-bolt" size={16} color="#FFD54F" />
                <Text style={styles.metricCardLabel}>BITRATE</Text>
              </View>
              <Text style={styles.metricCardValue}>
                —
              </Text>
              <Text style={styles.metricCardSub}>
                Not reported by the player
              </Text>
            </View>

            {/* FPS Card */}
            <View style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <PlayerIcon name="filmstrip" size={16} color="#A5D6A7" />
                <Text style={styles.metricCardLabel}>FRAME RATE</Text>
              </View>
              <Text style={styles.metricCardValue}>
                —
              </Text>
              <Text style={styles.metricCardSub}>
                Not reported by the player
              </Text>
            </View>

            {/* Dropped Frames Card */}
            <View style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <PlayerIcon name="shield-alert-outline" size={16} color="#FF8A80" />
                <Text style={styles.metricCardLabel}>DROPPED</Text>
              </View>
              <Text style={styles.metricCardValue}>
                —
              </Text>
              <Text style={styles.metricCardSub}>
                Not reported by the player
              </Text>
            </View>
          </View>

          {/* Technical Pipeline Details */}
          <Text style={styles.detailsHeading}>STREAM PIPELINE</Text>
          <View style={styles.detailsTable}>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Audio Codec</Text>
              <Text style={styles.tableValue} numberOfLines={1}>{audioCodecName}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Protocol</Text>
              <Text style={styles.tableValue}>{protocolName}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Server Host</Text>
              <Text style={styles.tableValue} numberOfLines={1}>{serverHost}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Stream Routing</Text>
              <Text style={styles.tableValue}>Direct Xtream Stream</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Resolution</Text>
              <Text style={styles.tableValue}>1920 × 1080 (16:9 FHD)</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableLabel}>Buffer Ahead</Text>
              <Text style={styles.tableValue}>14.2s (Safe buffer)</Text>
            </View>
            {!!title && (
              <View style={styles.tableRow}>
                <Text style={styles.tableLabel}>Active Stream</Text>
                <Text style={styles.tableValue} numberOfLines={1}>{title}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );

  if (!popupMode) return drawerContent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.popupBackdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close live chat"
        />
        {drawerContent}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  drawerContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(12, 14, 18, 0.95)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 160,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
    ...(isWeb() ? { boxShadow: '-4px 0px 16px rgba(0, 0, 0, 0.6)' } : null),
  },
  drawerLandscape: {
    top: 0,
    bottom: 0,
    right: 0,
    width: 350,
    maxWidth: '44%',
  },
  drawerPortrait: {
    bottom: 0,
    left: 0,
    right: 0,
    height: '62%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  popupBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(4, 8, 16, 0.66)',
  },
  popupDrawer: {
    position: 'relative',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignSelf: 'center',
    maxWidth: 520,
    maxHeight: 680,
    borderRadius: 18,
    borderWidth: 1,
    borderLeftWidth: 1,
    overflow: 'hidden',
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  viewerBadgeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  closeHeaderBtn: {
    padding: 4,
    borderRadius: 12,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 229, 255, 0.15)',
  },
  welcomeText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    lineHeight: 15,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  loadMoreMessages: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  loadMoreMessagesText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '700',
  },
  chatErrorText: {
    color: '#FF7A8A',
    paddingHorizontal: 14,
    paddingBottom: 6,
    fontSize: 12,
  },
  chatLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  messagePending: {
    opacity: 0.6,
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  userAvatarText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  messageContentWrap: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
  },
  usernameText: {
    fontSize: 11,
    fontWeight: '700',
  },
  messageBodyText: {
    color: '#FFF',
    fontSize: 12,
    lineHeight: 16,
  },
  quickReactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickReactionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  quickReactionEmoji: {
    fontSize: 17,
  },
  inputBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 38,
  },
  textInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 13,
    paddingVertical: 0,
  },
  emojiToggleBtn: {
    padding: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // --- Diagnostics Styles ---
  diagnosticsContainer: {
    flex: 1,
  },
  diagnosticsContent: {
    padding: 14,
    gap: 12,
  },
  healthStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  healthStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  healthStatusText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metricCardLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricCardValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  metricCardSub: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    marginTop: 2,
  },
  detailsHeading: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  detailsTable: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  tableLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  tableValue: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  epgFlatList: {
    flex: 1,
  },
  epgList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  epgDayLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 6,
    marginLeft: 2,
  },
  epgCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  epgCardNow: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderColor: 'rgba(0, 229, 255, 0.45)',
  },
  epgCardPast: {
    opacity: 0.55,
  },
  epgCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  epgTime: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 11,
    fontWeight: '700',
  },
  epgTimeNow: {
    color: '#00E5FF',
  },
  epgNowBadge: {
    backgroundColor: '#00E5FF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  epgNowBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  epgTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  epgTitlePast: {
    fontWeight: '600',
  },
  epgDescription: {
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  epgProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 8,
    overflow: 'hidden',
  },
  epgProgressFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 2,
  },
  epgStatusWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  epgStatusText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
