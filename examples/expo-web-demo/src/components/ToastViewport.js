import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ToastViewport({ toast, onDismiss, viewportWidth }) {
  if (!toast) return null;
  const isError = toast.variant === 'error';
  const toastWidth = Math.min(420, Math.max(240, viewportWidth - 32));

  return (
    <View
      accessibilityLiveRegion={isError ? 'assertive' : 'polite'}
      style={styles.viewport}
    >
      <View style={[styles.toast, isError && styles.errorToast, { width: toastWidth }]}>
        <View style={[styles.icon, isError && styles.errorIcon]}>
          <Text style={styles.iconText}>{isError ? '!' : '✓'}</Text>
        </View>
        <View style={styles.copy}>
          <Text style={[styles.toastTitle, isError && styles.errorTitle]}>{toast.title}</Text>
          <Text style={styles.toastMessage}>{toast.message}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismiss}>×</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'flex-end', paddingHorizontal: 16, zIndex: 10000, pointerEvents: 'box-none' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(22, 199, 217, .52)', borderRadius: 16, backgroundColor: 'rgba(13, 26, 42, .97)', boxShadow: '0px 8px 18px rgba(0, 0, 0, 0.42)', elevation: 12 },
  errorToast: { borderColor: 'rgba(255, 100, 124, .7)' },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16c7d9' },
  errorIcon: { backgroundColor: '#ff647c' },
  iconText: { color: '#07111e', fontWeight: '800', fontSize: 16 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  toastTitle: { color: '#16c7d9', fontSize: 13, fontWeight: '800' },
  errorTitle: { color: '#ff8295' },
  toastMessage: { color: '#f3f7fc', fontSize: 14, lineHeight: 19 },
  dismiss: { color: '#a9bbcf', fontSize: 22, lineHeight: 24, paddingLeft: 4 },
});
