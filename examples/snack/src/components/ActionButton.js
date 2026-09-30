import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export default function ActionButton({ title, onPress, primary = false }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, primary && styles.actionPrimary]}>
      <Text style={styles.actionText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#29415d', backgroundColor: '#12243a' },
  actionPrimary: { borderColor: '#16c7d9', backgroundColor: '#087f91' },
  actionText: { color: '#f8fbff', fontSize: 13, fontWeight: '800' },
});
