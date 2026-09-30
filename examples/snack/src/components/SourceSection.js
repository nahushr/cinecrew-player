import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import ActionButton from './ActionButton';

export default function SourceSection({ url, onChangeUrl, onLoadUrl, onPickFile }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Stream URL</Text>
      <TextInput
        accessibilityLabel="Media URL"
        value={url}
        onChangeText={onChangeUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="Paste a direct media URL"
        placeholderTextColor="#8396ad"
        style={styles.input}
      />
      <View style={styles.buttonRow}>
        <ActionButton title="Load URL" onPress={onLoadUrl} primary />
        <ActionButton title="Choose local file" onPress={onPickFile} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0d1a2a', borderColor: '#203650', borderWidth: 1, padding: 14, borderRadius: 16, gap: 12 },
  title: { color: '#f4f7fb', fontSize: 16, fontWeight: '800' },
  input: { color: '#f3f7fc', backgroundColor: '#07111e', borderColor: '#29415d', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
