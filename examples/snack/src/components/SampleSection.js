import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SAMPLES } from '../constants';

function SampleChip({ sample, selected, onPress }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.selected]}>
      <Text style={[styles.chipText, selected && styles.selectedText]}>{sample.label}</Text>
    </Pressable>
  );
}

export default function SampleSection({ selected, onSelect }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Video formats</Text>
      <View style={styles.chips}>
        {SAMPLES.map((sample) => (
          <SampleChip key={sample.id} sample={sample} selected={selected.id === sample.id} onPress={() => onSelect(sample)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  title: { color: '#f4f7fb', fontSize: 16, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: '#29415d', backgroundColor: '#12243a' },
  selected: { borderColor: '#16c7d9', backgroundColor: '#087f91' },
  chipText: { color: '#d3deeb', fontSize: 12, fontWeight: '800' },
  selectedText: { color: '#fff' },
});
