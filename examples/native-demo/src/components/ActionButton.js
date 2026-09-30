import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export function ActionButton({ children, onPress, active = false, disabled = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        active && styles.activeButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressedButton,
        style,
      ]}
    >
      <Text style={[styles.buttonText, disabled && styles.disabledText]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 42, borderWidth: 1, borderColor: '#29415d', borderRadius: 999, backgroundColor: '#12243a', paddingHorizontal: 15, paddingVertical: 9 },
  activeButton: { backgroundColor: '#087f91', borderColor: '#16c7d9' },
  pressedButton: { opacity: 0.78 },
  disabledButton: { opacity: 0.48 },
  buttonText: { color: '#edf6ff', fontSize: 14, fontWeight: '600' },
  disabledText: { color: '#a9bbcf' },
});
