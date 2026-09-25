import React from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  useWindowDimensions,
} from 'react-native';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃',
  '😉', '😍', '🥰', '😘', '😋', '😎', '🤩', '🥳', '😭', '😮', '😢', '😡',
  '🤔', '🫡', '🙏', '👏', '🙌', '👍', '👎', '💪', '❤️', '🧡', '💛', '💚',
  '💙', '💜', '🖤', '🤍', '💯', '🔥', '✨', '🎉', '🎊', '⚽', '🏀', '🏏',
  '🎬', '🍿', '🎵', '💬', '👀', '🤝', '🫶', '💔', '✅', '❌', '⭐', '🌟',
];

export const EmojiPickerModal = ({ visible, onClose, onSelectEmoji, colors }) => {
  const systemScheme = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();
  const isDark = colors?.mode ? colors.mode === 'dark' : systemScheme !== 'light';
  const palette = {
    surface: colors?.surfaceColor || (isDark ? '#17212B' : '#FFFFFF'),
    text: colors?.controlColor || (isDark ? '#F5F7FA' : '#202124'),
    muted: colors?.mutedColor || (isDark ? '#AAB4C0' : '#5F6368'),
    accent: colors?.accentColor || '#00B8D4',
    outline: colors?.borderColor || (isDark ? 'rgba(255,255,255,0.16)' : 'rgba(32,33,36,0.18)'),
    backdrop: 'rgba(0,0,0,0.58)',
  };
  const close = () => {
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={[styles.backdrop, { backgroundColor: palette.backdrop }]} onPress={close}>
        <Pressable
          style={[styles.sheet, { width: Math.min(windowWidth - 32, 420), backgroundColor: palette.surface, borderColor: palette.outline }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]}>Choose an emoji</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close emoji picker"
              hitSlop={10}
              onPress={close}
              style={[styles.closeButton, { borderColor: palette.outline }]}
            >
              <Text style={[styles.closeLabel, { color: palette.muted }]}>×</Text>
            </Pressable>
          </View>
          <FlatList
            data={EMOJIS}
            keyExtractor={(emoji, index) => `${emoji}-${index}`}
            numColumns={8}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Insert ${item}`}
                onPress={() => {
                  onSelectEmoji?.(item);
                  close();
                }}
                style={({ pressed }) => [styles.emojiButton, pressed && { backgroundColor: `${palette.accent}24` }]}
              >
                <Text style={styles.emoji}>{item}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    maxHeight: '72%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 17,
  },
  closeLabel: {
    fontSize: 25,
    lineHeight: 29,
  },
  grid: {
    alignItems: 'center',
  },
  emojiButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  emoji: {
    fontSize: 24,
  },
});
