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
  const sheetWidth = Math.min(windowWidth - 32, 420);
  const numColumns = Math.max(5, Math.min(9, Math.floor((sheetWidth - 32) / 42)));
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
            height: Math.min(Math.max(300, windowHeight * 0.72), 560),
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
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.grid}
            initialNumToRender={numColumns * 6}
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
    padding: 16,
  },
  sheet: {
    maxHeight: '82%',
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
    marginBottom: 10,
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
  search: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontSize: 15,
  },
  categoryList: {
    alignItems: 'center',
    gap: 4,
    paddingBottom: 8,
  },
  categoryButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderRadius: 8,
  },
  categoryIcon: {
    fontSize: 20,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  grid: {
    alignItems: 'center',
    paddingBottom: 8,
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
  empty: {
    paddingVertical: 20,
    textAlign: 'center',
  },
});
