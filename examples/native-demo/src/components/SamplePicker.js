import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function SamplePicker({ samples, selectedId, onSelect }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Playback samples</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {samples.map((sample) => (
          <Pressable
            key={sample.id}
            accessibilityRole="button"
            accessibilityState={{ selected: sample.id === selectedId }}
            onPress={() => onSelect(sample)}
            style={[styles.chip, sample.id === selectedId && styles.chipSelected]}
          >
            <Text style={[styles.chipText, sample.id === selectedId && styles.chipTextSelected]}>{sample.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  sectionTitle: { color: '#f4f7fb', fontSize: 18, fontWeight: '800' },
  row: { gap: 8, paddingRight: 16 },
  chip: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: '#29415d', backgroundColor: '#12243a' },
  chipSelected: { borderColor: '#16c7d9', backgroundColor: '#087f91' },
  chipText: { color: '#d3deeb', fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: '#fff' },
});
