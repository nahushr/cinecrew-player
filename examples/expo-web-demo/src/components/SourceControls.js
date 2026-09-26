import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { sampleSources } from '../../../web-demo/src/samples.js';
import { ActionButton } from './ActionButton';

function ToggleRow({ label, value, onChange }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={styles.toggle}
    >
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

function LocalFileControls({ active, fileInputRef, onChooseFile, onClearFile }) {
  return (
    <View style={styles.fileRow}>
      <ActionButton onPress={() => fileInputRef.current?.click()}>Choose video file</ActionButton>
      {React.createElement('input', {
        ref: fileInputRef,
        type: 'file',
        accept: '.ts,.mp4,.mkv,video/mp4,video/x-matroska,video/mp2t,video/webm,video/ogg,video/quicktime,video/x-m4v,video/3gpp',
        onChange: onChooseFile,
        style: { display: 'none' },
        'aria-label': 'Choose local video file',
      })}
      {active.id === 'file' ? (
        <>
          <Text numberOfLines={1} style={styles.selectedFile}>{active.title}</Text>
          <ActionButton onPress={onClearFile} style={styles.clearButton}>Clear video file</ActionButton>
        </>
      ) : <Text style={styles.fileHint}>Local video playback is independent from URL loading.</Text>}
    </View>
  );
}

export function SourceControls({
  active,
  draftUrl,
  fileInputRef,
  inline,
  drawerMode,
  onSelectSample,
  onDraftUrlChange,
  onLoadUrl,
  onChooseFile,
  onClearFile,
  onInlineChange,
  onDrawerModeChange,
  progressTime,
  status,
  viewportWidth,
}) {
  return (
    <View style={styles.card}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sampleList}>
        {sampleSources.map((sample) => (
          <ActionButton
            key={sample.id}
            active={active.id === sample.id}
            onPress={() => onSelectSample(sample)}
          >
            {sample.label}
          </ActionButton>
        ))}
      </ScrollView>

      <View style={[styles.urlRow, viewportWidth < 600 && styles.narrowRow]}>
        <TextInput
          accessibilityLabel="Media URL"
          placeholder="Enter a media URL…"
          placeholderTextColor="#8297ae"
          value={draftUrl}
          onChangeText={onDraftUrlChange}
          onSubmitEditing={onLoadUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          style={[styles.input, viewportWidth < 600 && styles.fullWidth]}
        />
        <ActionButton active onPress={onLoadUrl} style={viewportWidth < 600 && styles.fullWidth}>Load URL</ActionButton>
      </View>

      <LocalFileControls
        active={active}
        fileInputRef={fileInputRef}
        onChooseFile={onChooseFile}
        onClearFile={onClearFile}
      />

      <View style={styles.options}>
        <ToggleRow label="Use compact inline player" value={inline} onChange={onInlineChange} />
        <View style={styles.drawerRow}>
          <Text style={styles.toggleLabel}>Drawer layout</Text>
          <ActionButton active={drawerMode === 'overlay'} onPress={() => onDrawerModeChange('overlay')}>
            Overlay video
          </ActionButton>
          <ActionButton active={drawerMode === 'resize'} onPress={() => onDrawerModeChange('resize')}>
            Resize video
          </ActionButton>
        </View>
      </View>

      <Text style={styles.status}>{status} · Browser format and CORS support depend on the source host.</Text>
      <Text accessibilityLiveRegion="polite" style={styles.progress}>onProgressBarChange · {progressTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#203650', borderRadius: 18, backgroundColor: '#0d1a2a', padding: 18, gap: 10 },
  sampleList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 2 },
  urlRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  narrowRow: { alignItems: 'stretch' },
  fullWidth: { width: '100%' },
  input: { flexGrow: 1, flexBasis: 240, minWidth: 200, minHeight: 44, borderWidth: 1, borderColor: '#29415d', borderRadius: 10, backgroundColor: '#07111e', color: '#f3f7fc', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  fileRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 4 },
  selectedFile: { color: '#f3f7fc', maxWidth: 300, flexShrink: 1 },
  fileHint: { color: '#a9bbcf', fontSize: 13, flexShrink: 1 },
  clearButton: { borderColor: '#754b5e', backgroundColor: '#321e2b' },
  options: { gap: 2 },
  toggle: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#68809b', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#16c7d9', borderColor: '#16c7d9' },
  checkmark: { color: '#07111e', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  toggleLabel: { color: '#f3f7fc', fontSize: 15 },
  drawerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 44 },
  status: { color: '#a9bbcf', fontSize: 13, lineHeight: 19, marginTop: 1 },
  progress: { color: '#16c7d9', fontSize: 12, fontVariant: ['tabular-nums'], marginTop: -8 },
});
