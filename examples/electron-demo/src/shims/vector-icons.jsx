import React from 'react';
import { Text } from 'react-native';

const glyphs = {
  'arrow-left': '←',
  'chevron-left': '‹',
  'play': '▶',
  'pause': 'Ⅱ',
  'record-rec': '●',
  'stop': '■',
  'restart': '↻',
  'lock': '▣',
  'lock-open': '▢',
  'lock-open-variant': '🔓',
  'volume-high': '◖',
  'volume-medium': '◖))',
  'volume-off': '◖̸',
  'volume-mute': '◖̸',
  'aspect-ratio': '▭',
  'audiotrack': '♫',
  'headphones': '♬',
  'audio-video': '♫',
  'speedometer': '⏩',
  'fullscreen': '⛶',
  'fullscreen-exit': '⛶',
  'record': '●',
  'message-text': '▤',
  'comment-text-multiple-outline': '▤',
  'comment-text-multiple': '▤',
  'comment-text-outline': '▤',
  'television-classic': '▣',
  'television': '▣',
  'television-play': '▣▶',
  'television-off': '▣̸',
  'pulse': '⌁',
  'replay-10': '↶¹⁰',
  'forward-10': '↪¹⁰',
  'rewind-10': '↶¹⁰',
  'fast-forward-10': '↪¹⁰',
  'television-guide': '▦',
  'filmstrip': '▥',
  'calendar-remove': '▦',
  'emoticon-happy-outline': '☺',
  'send': '➤',
  'shield-check': '✓',
  'shield-alert-outline': '⚠',
  'check-circle-outline': '✓',
  'alert-circle-outline': '⚠',
  'information-outline': 'ⓘ',
  'information': 'ⓘ',
  'account-group': '♟♟',
  'white-balance-sunny': '☼',
  'brightness-6': '◐',
  'brightness-4': '◑',
  'video-outline': '▭',
  'lightning-bolt': 'ϟ',
  'close': '×',
  'check': '✓',
  'download': '↓',
  'cast': '◉',
  'fit-to-screen': '⛶',
  'music-note': '♫',
};

function Icon({ name, size = 20, color = '#fff', style }) {
  return (
    <Text aria-hidden="true" style={[{ color, fontSize: size, lineHeight: size + 2, textAlign: 'center' }, style]}>
      {glyphs[name] || '•'}
    </Text>
  );
}

Icon.loadFont = () => Promise.resolve();

export const MaterialCommunityIcons = Icon;
export const MaterialIcons = Icon;
