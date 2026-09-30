import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

export default function OptionRow({ label, value, onChange }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: '#087f91' }} thumbColor={value ? '#16c7d9' : '#edf6ff'} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  label: { color: '#edf6ff', fontSize: 13, fontWeight: '700' },
});
