import React from 'react';
import { useColorScheme } from 'react-native';
import {
  EmojiPickerModal as HirakuEmojiPickerModal,
  emojiData,
} from '@hiraku-ai/react-native-emoji-picker';

export const EmojiPickerModal = ({ visible, onClose, onSelectEmoji, colors }) => {
  const systemScheme = useColorScheme();
  const darkMode = colors?.mode ? colors.mode === 'dark' : systemScheme !== 'light';

  return (
    <HirakuEmojiPickerModal
      visible={visible}
      onClose={onClose}
      onEmojiSelect={(emoji) => {
        onSelectEmoji(emoji);
      }}
      emojis={emojiData}
      darkMode={darkMode}
      modalTitle="Emojis"
      showSearchBar={true}
      showTabs={true}
      showHistoryTab={true}
      showSkinToneSelector={true}
      modalMaxWidth={420}
      modalMaxHeight={380}
    />
  );
};
