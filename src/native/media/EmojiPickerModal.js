import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  useWindowDimensions,
} from 'react-native';
import { EMOJI_GROUPS, searchEmojis } from '../../data/emoji';

export const EmojiPickerModal = ({ visible, onClose, onSelectEmoji, colors }) => {
  const systemScheme = useColorScheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [activeGroup, setActiveGroup] = useState(EMOJI_GROUPS[0].name);
  const [query, setQuery] = useState('');
  const isDark = colors?.mode ? colors.mode === 'dark' : systemScheme !== 'light';

  // Generous modal sizing for mobile and electron: expands horizontally and vertically
  // with safe margins, avoiding cramped layouts and eliminating excessive empty whitespace.
  const sheetWidth = Math.max(280, Math.min(windowWidth - 20, 640));
  const sheetHeight = Math.max(300, Math.min(Math.round(windowHeight * 0.88), 740));
  const availableContentWidth = Math.max(200, sheetWidth - 24);
  const itemSize = 44;
  const numColumns = Math.max(5, Math.floor(availableContentWidth / itemSize));

  const activeGroupData = EMOJI_GROUPS.find((group) => group.name === activeGroup) || EMOJI_GROUPS[0];
  const emojis = useMemo(
    () => query.trim() ? searchEmojis(query) : activeGroupData.items,
    [activeGroupData, query],
  );
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
          style={[styles.sheet, {
            width: sheetWidth,
            height: sheetHeight,
            backgroundColor: palette.surface,
            borderColor: palette.outline,
          }]}
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
          <TextInput
            accessibilityLabel="Search emojis"
            value={query}
            onChangeText={setQuery}
            placeholder="Search all emojis"
            placeholderTextColor={palette.muted}
            returnKeyType="search"
            style={[styles.search, { color: palette.text, borderColor: palette.outline }]}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.categoryScrollView}
            contentContainerStyle={styles.categoryList}
            accessibilityLabel="Emoji categories"
          >
            {EMOJI_GROUPS.map((group) => {
              const selected = !query.trim() && group.name === activeGroup;
              return (
                <Pressable
                  key={group.name}
                  accessibilityRole="button"
                  accessibilityLabel={`${group.name} emojis`}
                  accessibilityState={{ selected }}
                  onPress={() => setActiveGroup(group.name)}
                  style={[styles.categoryButton, { borderColor: selected ? palette.accent : 'transparent' }]}
                >
                  <Text style={styles.categoryIcon}>{group.icon}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[styles.groupTitle, { color: palette.muted }]}>
            {query.trim() ? `Search results · ${emojis.length}` : activeGroupData.name}
          </Text>
          <FlatList
            key={`${numColumns}-${query.trim() ? 'search' : activeGroup}`}
            data={emojis}
            keyExtractor={(item) => item.codepoints}
            numColumns={numColumns}
            style={styles.emojiList}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grid}
            initialNumToRender={numColumns * 7}
            maxToRenderPerBatch={numColumns * 8}
            windowSize={7}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Insert ${item.short_name}`}
                onPress={() => {
                  onSelectEmoji?.(item.emoji);
                  close();
                }}
                style={({ pressed }) => [styles.emojiButton, pressed && { backgroundColor: `${palette.accent}24` }]}
              >
                <Text style={styles.emoji}>{item.emoji}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={[styles.empty, { color: palette.muted }]}>No emojis found.</Text>}
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
    padding: 10,
  },
  sheet: {
    minHeight: 0,
    flexShrink: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  header: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  closeLabel: {
    fontSize: 22,
    lineHeight: 24,
  },
  search: {
    height: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
    fontSize: 14,
  },
  categoryScrollView: {
    flexGrow: 0,
    height: 38,
    marginBottom: 4,
  },
  categoryList: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  categoryButton: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderRadius: 6,
  },
  categoryIcon: {
    fontSize: 19,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  grid: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 12,
    paddingHorizontal: 2,
    alignItems: 'flex-start',
  },
  emojiList: {
    flex: 1,
    minHeight: 0,
  },
  emojiButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  emoji: {
    fontSize: 26,
    lineHeight: 30,
    textAlign: 'center',
    includeFontPadding: false,
  },
  empty: {
    paddingVertical: 20,
    textAlign: 'center',
  },
});
