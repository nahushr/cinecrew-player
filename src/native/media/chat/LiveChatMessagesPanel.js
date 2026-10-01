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
  bottomInset = 0,
}) {
  return (
    <View style={styles.chatPanelWrap}>
      {messagesLoading && messages.length === 0 ? (
        <View style={styles.chatLoadingWrap}>
          <ActivityIndicator size="small" color="#00E5FF" />
          <Text style={styles.epgStatusText}>Loading live chat…</Text>
        </View>
      ) : (
        <>
          {hasMoreMessages ? (
            <TouchableOpacity
              style={styles.loadMoreMessagesButton}
              onPress={loadOlderMessages}
              disabled={loadingOlderMessages}
              accessibilityRole="button"
              accessibilityLabel="Load more messages"
            >
              {loadingOlderMessages ? (
                <ActivityIndicator size="small" color="#00E5FF" />
              ) : (
                <Text style={styles.loadMoreMessagesText}>Load more</Text>
              )}
            </TouchableOpacity>
          ) : null}
          <FlatList
            ref={flatListRef}
            style={styles.chatFlatList}
            nestedScrollEnabled
            data={messages}
            keyExtractor={(item, index) => chatMessageKey(item, index)}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListEmptyComponent={<Text style={styles.epgStatusText}>No messages yet. Start the conversation.</Text>}
          />
        </>
      )}
      {!!chatError && <Text style={styles.chatErrorText}>{chatError}</Text>}

      <View style={[styles.inputBarContainer, bottomInset > 0 && { paddingBottom: 10 + bottomInset }]}>
        <View style={styles.inputPill}>
          <TouchableOpacity
            style={styles.emojiToggleBtn}
            onPress={() => setShowEmojiPicker(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Pick emoji"
          >
            <PlayerIcon name="emoticon-happy-outline" size={20} color="#8297ae" />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Add a message..."
            placeholderTextColor="#8297ae"
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            maxLength={400}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isSending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <PlayerIcon
              name="send"
              size={18}
              color={inputText.trim() && !isSending ? '#07111e' : 'rgba(255, 255, 255, 0.3)'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <EmojiPickerModal
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelectEmoji={handleSelectEmoji}
        colors={colors}
      />
    </View>
  );
}
