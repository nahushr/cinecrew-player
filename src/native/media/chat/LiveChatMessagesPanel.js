import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PlayerIcon } from '../../customization';
import { EmojiPickerModal } from '../EmojiPickerModal';
import { chatMessageKey, QUICK_REACTIONS } from './liveChatUtils';

export function LiveChatPanel({
  styles,
  messagesLoading,
  messages,
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
}) {
  return (
    <>
      <View style={styles.welcomeBanner}>
        <PlayerIcon name="shield-check" size={16} color="#00E5FF" style={{ marginTop: 2 }} />
        <Text style={styles.welcomeText}>
          Welcome to live chat! Remember to guard your privacy and abide by community guidelines.
        </Text>
      </View>

      {messagesLoading && messages.length === 0 ? (
        <View style={styles.chatLoadingWrap}>
          <ActivityIndicator size="small" color="#00E5FF" />
          <Text style={styles.epgStatusText}>Loading live chat…</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          nestedScrollEnabled
          data={messages}
          keyExtractor={(item, index) => chatMessageKey(item, index)}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={loadingOlderMessages ? (
            <View style={styles.loadingOlderMessages}>
              <ActivityIndicator size="small" color="#00E5FF" />
              <Text style={styles.loadingOlderMessagesText}>Loading older messages…</Text>
            </View>
          ) : null}
          onScroll={(event) => {
            if (event.nativeEvent.contentOffset.y <= 24) loadOlderMessages();
          }}
          scrollEventThrottle={16}
          ListEmptyComponent={<Text style={styles.epgStatusText}>No messages yet. Start the conversation.</Text>}
        />
      )}
      {!!chatError && <Text style={styles.chatErrorText}>{chatError}</Text>}

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
          style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
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

      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={handleSelectEmoji}
        colors={colors}
      />
    </>
  );
}
