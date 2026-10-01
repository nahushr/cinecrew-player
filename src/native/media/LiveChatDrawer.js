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
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { isIOS, isWeb } from '../../utils/runtimePlatform';
import { PlayerIcon } from '../customization';
import {
  DEFAULT_EPG_LIMIT,
  QUICK_REACTIONS,
  USER_COLORS,
  getUserColor,
  formatMessageTime,
  normalizeChatMessage,
  normalizeChatPage,
  chatPageHasMore,
  chatMessageKey,
  mergeChatMessages,
  extractHostname,
  detectStreamProtocol,
  detectAudioCodec,
  formatEpgClock,
  formatEpgDayLabel,
  epgProgress,
  TAB_META,
  LiveChatPanel,
  DiagnosticsTab,
} from './chat';

function ChatPanelContent(props) {
  if (props.activeTab !== 'chat') return null;
  if (!props.chatAvailable) {
    return (
      <View style={props.styles.epgStatusWrap}>
        <PlayerIcon name="comment-text-outline" size={28} color="rgba(255,255,255,0.45)" />
        <Text style={props.styles.epgStatusText}>Live chat is enabled, but no chat integration was provided.</Text>
      </View>
    );
  }
  return <LiveChatPanel {...props.panelProps} />;
}

export const LiveChatDrawer = ({
  videoId,
  userId,
  username,
  visible,
  onClose,
  drawerMode = 'overlay',
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
  portraitVideoHeight: propPortraitVideoHeight,
  fullscreen = false,
  landscapeFullWidth = false,
  safeAreaInsets,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const pageSize = Math.max(1, Math.floor(Number(messagePageSize) || 50));
  const chatTabEnabled = isLiveCommentsEnabled !== false;
  const epgTabEnabled = isEpgEnabled === true;
  const chatAvailable = chatTabEnabled && typeof integrations.liveChat?.loadMessages === 'function';
  const epgAvailable = epgTabEnabled && typeof integrations.epg?.loadListings === 'function';
  const canShowDiagnostics = diagnosticsEnabled !== false;

  const pickPanel = (tab) => {
    // Keep the requested panel selected even if its data integration is absent;
    // the drawer shows a panel-specific setup message instead of silently
    // routing Chat or EPG clicks to Diagnostics.
    if (tab === 'chat' && chatTabEnabled) return 'chat';
    if (tab === 'epg' && epgTabEnabled) return 'epg';
    if (tab === 'diagnostics' && canShowDiagnostics) return 'diagnostics';
    if (chatTabEnabled) return 'chat';
    if (epgTabEnabled) return 'epg';
    return canShowDiagnostics ? 'diagnostics' : tab || 'diagnostics';
  };

  const [activeTab, setActiveTab] = useState(() => pickPanel(initialTab));
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);

  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(pickPanel(initialTab));
  }

  useEffect(() => {
    setActiveTab(pickPanel(initialTab));
  }, [initialTab, chatAvailable, epgAvailable, canShowDiagnostics]);

  // --- Live Chat State ---
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
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
    messagesRef.current = [];
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
        const msgs = normalizeChatPage(response, { limit: pageSize, offset: 0 });
        if (isMounted) {
          if (!loadedInitialPageRef.current) {
            messagesRef.current = msgs;
            setMessages(msgs);
            loadedInitialPageRef.current = true;
            messageOffsetRef.current = msgs.length;
            setHasMoreMessages(chatPageHasMore(response, { limit: pageSize, offset: 0 }));
          } else {
            const current = messagesRef.current;
            const merged = mergeChatMessages(current, msgs);
            const addedCount = merged.length - current.length;
            messagesRef.current = merged;
            setMessages(merged);
            if (addedCount > 0) messageOffsetRef.current += addedCount;
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

    void poll();
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
      const olderMessages = normalizeChatPage(response, { limit: pageSize, offset });
      let addedCount = 0;
      if (olderMessages.length) {
        const current = messagesRef.current;
        const merged = mergeChatMessages(current, olderMessages, true);
        addedCount = merged.length - current.length;
        messagesRef.current = merged;
        setMessages(merged);
        messageOffsetRef.current += olderMessages.length;
      }
      setHasMoreMessages(addedCount > 0 && chatPageHasMore(response, { limit: pageSize, offset }));
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

    void load();
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
      const timer = setTimeout(() => {
        const list = flatListRef.current;
        const scrollView = list?.getNativeScrollRef?.();

        // VirtualizedList warns when scrollToEnd is called without a native
        // scroll host (for example, while a platform-specific list is mounting).
        if (typeof scrollView?.scrollTo === 'function') {
          list.scrollToEnd({ animated: true });
        }
      }, 80);
      scrollChatToEndRef.current = false;

      return () => clearTimeout(timer);
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
        const msgs = normalizeChatPage(response, { limit: pageSize, offset: 0 });
        const current = messagesRef.current;
        const merged = mergeChatMessages(current, msgs);
        const addedCount = merged.length - current.length;
        messagesRef.current = merged;
        setMessages(merged);
        if (addedCount > 0) messageOffsetRef.current += addedCount;
      }
      // Do not rely only on the messages-length effect: some integrations return
      // the same page length after a send, even though the newest row is updated.
      setTimeout(() => {
        const list = flatListRef.current;
        const scrollView = list?.getNativeScrollRef?.();
        if (typeof scrollView?.scrollTo === 'function') {
          list.scrollToEnd({ animated: true });
        }
      }, 80);
    } catch {
      // Error handled
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, videoId, userId, username, integrations.liveChat, pageSize]);

  const handleSelectEmoji = useCallback((emoji) => {
    setInputText((prev) => prev + emoji);
  }, []);

  const handleQuickReaction = useCallback((emoji) => {
    handleSend(emoji);
  }, [handleSend]);

  if (!visible) return null;

  const renderMessageItem = ({ item }) => {
    const timeStr = formatMessageTime(item.createdAt);

    return (
      <View style={[styles.messageCard, item.isPending && styles.messagePending]}>
        <View style={styles.messageHeaderRow}>
          <Text style={styles.usernameText}>
            {item.username || 'Viewer'}
          </Text>
          {!!timeStr && <Text style={styles.timeText}>{timeStr}</Text>}
        </View>
        <Text style={styles.messageBodyText}>{item.textContent}</Text>
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
  const bottomModal = drawerMode === 'modal' && !isWeb() && !popupMode;
  const centeredModal = popupMode || (drawerMode === 'modal' && isWeb());
  const isPortrait = windowWidth < windowHeight;
  const calculatedPortraitVideoHeight = Math.min(Math.round(windowHeight * 0.42), Math.round(windowWidth * (9 / 16)));
  const portraitVideoHeight = propPortraitVideoHeight || calculatedPortraitVideoHeight;
  const resizeWidth = '30%';
  // Android's fullscreen player is already drawn edge-to-edge with system UI
  // hidden. Applying the app's normal safe-area insets here makes the drawer
  // start below (and end before) the video surface, leaving visible gaps.
  // The native demo also presents its landscape immersive stage edge-to-edge
  // without opening the player's own fullscreen Modal. Keep the right drawer
  // aligned with that video surface rather than offsetting it below system
  // safe-area insets.
  const androidFullscreen = (fullscreen || landscapeFullWidth) && Platform.OS === 'android' && !isPortrait;
  const fullscreenTopInset = Math.max(
    androidFullscreen ? 0 : Number(safeAreaInsets?.top) || 0,
    !androidFullscreen && Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );
  const fullscreenBottomInset = androidFullscreen ? 0 : Number(safeAreaInsets?.bottom) || 0;
  const fullscreenLeftInset = androidFullscreen ? 0 : Number(safeAreaInsets?.left) || 0;
  const fullscreenRightInset = androidFullscreen ? 0 : Number(safeAreaInsets?.right) || 0;
  const fullscreenLandscape = (fullscreen || landscapeFullWidth)
    && drawerMode !== 'resize'
    && windowWidth >= windowHeight;
  const overlayWidth = Math.min(380, Math.max(280, Math.round(windowWidth * 0.42)));
  const compactOverlay = drawerMode === 'overlay'
    && (isPortrait || (isWeb() && (windowWidth < 720 || windowHeight < 520)));
  const fullscreenLandscapeStyle = fullscreenLandscape
    ? {
        position: 'absolute',
        top: fullscreenTopInset,
        right: fullscreenRightInset,
        bottom: fullscreenBottomInset,
        left: undefined,
        width: Math.max(0, windowWidth - fullscreenLeftInset - fullscreenRightInset),
        maxWidth: overlayWidth,
        height: Math.max(0, windowHeight - fullscreenTopInset - fullscreenBottomInset),
        maxHeight: Math.max(0, windowHeight - fullscreenTopInset - fullscreenBottomInset),
        alignSelf: 'stretch',
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 0,
        backgroundColor: 'rgba(7, 14, 26, 0.88)',
      }
    : null;
  const fullscreenDrawerInsets = fullscreen && !centeredModal && !bottomModal && !isPortrait
    ? { top: fullscreenTopInset, bottom: fullscreenBottomInset }
    : null;

  const portraitResizeStyle = isPortrait && drawerMode === 'resize' && !popupMode
    ? {
        position: 'absolute',
        top: portraitVideoHeight,
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100%',
        height: undefined,
        maxHeight: undefined,
        borderLeftWidth: 0,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: '#07111E',
        borderRadius: 0,
        zIndex: 160,
      }
    : null;

  const fullscreenPortraitResizeStyle = fullscreen && isPortrait && drawerMode === 'resize' && !popupMode
    ? {
        position: 'absolute',
        top: undefined,
        bottom: fullscreenBottomInset,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100%',
        height: '75%',
        maxHeight: '75%',
        borderLeftWidth: 0,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        backgroundColor: 'rgba(7, 14, 26, 0.9)',
        zIndex: 160,
      }
    : null;

  const compactOverlayStyle = compactOverlay && !popupMode
    ? {
        position: 'absolute',
        top: undefined,
        bottom: fullscreen ? fullscreenBottomInset : 0,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '100%',
        height: '75%',
        maxHeight: '75%',
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.2)',
        borderLeftWidth: 0,
        backgroundColor: 'rgba(7, 14, 26, 0.9)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.55,
        shadowRadius: 18,
        elevation: 20,
    }
    : null;

  // Landscape overlay drawers stay anchored to the right edge of the player;
  // don't stretch the drawer over the full video surface. Portrait overlay
  // continues to use the compact bottom-sheet presentation above.
  const landscapeOverlayPanelStyle = drawerMode === 'overlay'
    && !popupMode
    && !compactOverlay
    && !isPortrait
    ? { backgroundColor: 'rgba(7, 14, 26, 0.88)' }
    : null;

  const drawerContent = (
    <KeyboardAvoidingView
      behavior={isIOS() ? 'padding' : undefined}
      style={[
        styles.drawerContainer,
        drawerMode === 'resize' && !popupMode ? styles.drawerResize : styles.drawerLandscape,
        drawerMode === 'resize' && !popupMode && {
          width: resizeWidth,
          maxWidth: resizeWidth,
        },
        centeredModal && styles.popupDrawer,
        centeredModal && {
          width: Math.min(Math.max(windowWidth - 32, 280), 520),
          height: Math.min(Math.max(windowHeight - 32, 280), 680),
        },
        bottomModal && styles.bottomModalDrawer,
        fullscreenDrawerInsets,
        fullscreen && bottomModal && fullscreenBottomInset > 0 && { marginBottom: fullscreenBottomInset },
        fullscreenLandscapeStyle,
        portraitResizeStyle,
        fullscreenPortraitResizeStyle,
        compactOverlayStyle,
        landscapeOverlayPanelStyle,
        drawerStyle,
      ]}
    >
      {/* Header with Close Button & Title */}
      <View style={styles.drawerHeader}>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>
            {activeTab === 'chat' ? 'Live chat' : (TAB_META[activeTab]?.title || 'Overlay')}
          </Text>
        </View>

        <TouchableOpacity style={styles.closeHeaderBtn} onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close live chat">
          <PlayerIcon name="close" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* --- Tab 1: Live Chat --- */}
      <ChatPanelContent
        activeTab={activeTab}
        chatAvailable={chatAvailable}
        styles={styles}
        panelProps={{
          styles,
          messagesLoading,
          messages,
          hasMoreMessages,
          flatListRef,
          renderMessageItem,
          loadOlderMessages,
          loadingOlderMessages,
          chatError,
          handleQuickReaction,
          inputText,
          setInputText,
          handleSend,
          isSending,
          setShowEmojiPicker,
          showEmojiPicker,
          handleSelectEmoji,
          colors,
          bottomInset: bottomModal ? fullscreenBottomInset : 0,
        }}
      />

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
                nestedScrollEnabled
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

      {activeTab === 'epg' && !epgAvailable ? (
        <View style={styles.epgStatusWrap}>
          <PlayerIcon name="television-off" size={28} color="rgba(255,255,255,0.45)" />
          <Text style={styles.epgStatusText}>Programme guide is enabled, but no EPG integration was provided.</Text>
        </View>
      ) : null}

      {/* --- Tab 2: Provider Health & Stream Diagnostics HUD --- */}
      {activeTab === 'diagnostics' && (
        <DiagnosticsTab
          styles={styles}
          health={health}
          pingLatency={pingLatency}
          pingJitter={pingJitter}
          audioCodecName={audioCodecName}
          protocolName={protocolName}
          serverHost={serverHost}
          title={title}
        />
      )}
    </KeyboardAvoidingView>
  );

  if (compactOverlay && !popupMode) {
    return (
      <View pointerEvents="box-none" style={styles.compactOverlayRoot}>
        <TouchableOpacity
          style={styles.compactOverlayBackdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close player panel"
        />
        {drawerContent}
      </View>
    );
  }

  if (!centeredModal && !bottomModal) return drawerContent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={bottomModal ? 'slide' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.popupBackdrop, bottomModal && styles.bottomModalBackdrop]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close player panel"
        />
        {drawerContent}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  compactOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 150,
    elevation: 15,
  },
  compactOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  drawerContainer: {
    position: 'absolute',
    backgroundColor: 'rgba(12, 14, 18, 0.95)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.12)',
    zIndex: 160,
    overflow: 'hidden',
    height: '100%',
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
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
    maxWidth: '92%',
    height: '100%',
  },
  drawerResize: {
    top: 0,
    bottom: 0,
    right: 0,
    width: '30%',
    maxWidth: '30%',
    height: '100%',
  },
  popupBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(4, 8, 16, 0.66)',
  },
  bottomModalBackdrop: {
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    padding: 0,
  },
  bottomModalDrawer: {
    position: 'relative',
    top: undefined,
    right: undefined,
    bottom: undefined,
    left: undefined,
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    height: '72%',
    maxHeight: '78%',
    borderLeftWidth: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    flexShrink: 0,
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
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  viewerBadgeText: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '700',
  },
  closeHeaderBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  welcomeText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    lineHeight: 15,
  },
  chatPanelWrap: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  loadMoreMessagesButton: {
    minHeight: 30,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 2,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 229, 255, 0.28)',
  },
  loadMoreMessagesText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '700',
  },
  chatFlatList: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexGrow: 1,
  },
  loadingOlderMessages: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 6,
  },
  loadingOlderMessagesText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '600',
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
  messageCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 3,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  messagePending: {
    opacity: 0.6,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  userAvatarText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  messageContentWrap: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  timeText: {
    color: '#8297ae',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  usernameText: {
    color: '#00E5FF',
    fontSize: 13,
    fontWeight: '700',
  },
  messageBodyText: {
    color: '#edf6ff',
    fontSize: 13,
    lineHeight: 18,
  },
  quickReactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(6, 12, 22, 0.6)',
  },
  quickReactionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickReactionEmoji: {
    fontSize: 18,
  },
  inputBarContainer: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(12, 14, 18, 0.98)',
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 20, 32, 0.72)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    paddingLeft: 10,
    paddingRight: 6,
    height: 44,
    gap: 8,
  },
  textInput: {
    flex: 1,
    color: '#edf6ff',
    fontSize: 13,
    paddingVertical: 0,
  },
  emojiToggleBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 36,
    height: 34,
    borderRadius: 10,
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
