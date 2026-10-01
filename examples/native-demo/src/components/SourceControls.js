import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { sampleSources } from '../samples.js';
import { ActionButton } from './ActionButton.js';

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
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.fileRow}>
        <Text style={styles.fileHint}>Local video playback is supported via custom URL input or web mode.</Text>
      </View>
    );
  }
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

function DrawerLayoutPicker({ value, onChange, onOpenChange }) {
  const [open, setOpen] = useState(false);
  const options = [
    { value: 'overlay', label: 'Overlay video' },
    { value: 'resize', label: 'Resize video' },
    { value: 'modal', label: 'Modal' },
  ];
  const selectedLabel = options.find((option) => option.value === value)?.label || options[0].label;

  return (
    <View style={styles.pickerRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Drawer layout: ${selectedLabel}`}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          onOpenChange(nextOpen);
        }}
        style={styles.pickerButton}
      >
        <Text style={styles.pickerText}>{selectedLabel}</Text>
        <Text style={styles.pickerChevron}>⌄</Text>
      </Pressable>
      {open ? (
        <View style={styles.pickerMenu}>
          {options.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
                onOpenChange(false);
              }}
              style={[styles.pickerOption, option.value === value && styles.pickerOptionSelected]}
            >
              <Text style={styles.pickerText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SourceControls({
  active,
  draftUrl,
  fileInputRef,
  inline,
  brightnessControl,
  drawerMode,
  onSelectSample,
  onDraftUrlChange,
  onLoadUrl,
  onChooseFile,
  onClearFile,
  onInlineChange,
  onBrightnessControlChange,
  onDrawerModeChange,
  progressTime,
  status,
  viewportWidth,
}) {
  const [drawerLayoutOpen, setDrawerLayoutOpen] = useState(false);

  return (
    <View style={[styles.card, viewportWidth < 600 && styles.narrowCard, drawerLayoutOpen && styles.cardDropdownOpen]}>
      <View style={styles.sampleList}>
        {sampleSources.map((sample) => (
          <ActionButton
            key={sample.id}
            active={active.id === sample.id}
            onPress={() => onSelectSample(sample)}
          >
            {sample.label}
          </ActionButton>
        ))}
      </View>

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
        <ToggleRow label="Brightness control" value={brightnessControl} onChange={onBrightnessControlChange} />
        <View style={styles.drawerRow}>
          <Text style={styles.toggleLabel}>Drawer layout</Text>
          <DrawerLayoutPicker value={drawerMode} onChange={onDrawerModeChange} onOpenChange={setDrawerLayoutOpen} />
        </View>
      </View>

      <Text style={styles.status}>{status} · {Platform.OS === 'web' && window.cinecrewRuntime?.isElectron
        ? 'Native LibVLC playback.'
        : 'Browser format and CORS support depend on the source host.'}</Text>
      <Text accessibilityLiveRegion="polite" style={styles.progress}>onProgressBarChange · {progressTime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#203650', borderRadius: 18, backgroundColor: '#0d1a2a', padding: 18, gap: 8, marginBottom: 16 },
  cardDropdownOpen: { position: 'relative', zIndex: 100, elevation: 24 },
  narrowCard: { padding: 12 },
  sampleList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 2, marginBottom: 4 },
  urlRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  narrowRow: { alignItems: 'stretch' },
  fullWidth: { width: '100%' },
  input: { flexGrow: 1, flexBasis: 240, minWidth: 200, minHeight: 44, borderWidth: 1, borderColor: '#29415d', borderRadius: 10, backgroundColor: '#07111e', color: '#f3f7fc', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  fileRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 12 },
  selectedFile: { color: '#f3f7fc', maxWidth: 300, flexShrink: 1 },
  fileHint: { color: '#a9bbcf', fontSize: 13, flexShrink: 1 },
  clearButton: { borderColor: '#754b5e', backgroundColor: '#321e2b' },
  options: { gap: 2, zIndex: 10, elevation: 10 },
  toggle: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4, marginTop: 14 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#68809b', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#16c7d9', borderColor: '#16c7d9' },
  checkmark: { color: '#07111e', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  toggleLabel: { color: '#f3f7fc', fontSize: 15 },
  drawerRow: { position: 'relative', zIndex: 20, elevation: 20, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 44 },
  pickerRoot: { position: 'relative', zIndex: 30, elevation: 30 },
  pickerButton: { minHeight: 36, minWidth: 124, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderColor: '#29415d', borderRadius: 8, backgroundColor: '#07111e', paddingHorizontal: 10, paddingVertical: 7 },
  pickerText: { color: '#edf6ff', fontSize: 14 },
  pickerChevron: { color: '#a9bbcf', fontSize: 16, lineHeight: 18 },
  pickerMenu: { position: 'absolute', top: 40, left: 0, minWidth: 160, borderWidth: 1, borderColor: '#29415d', borderRadius: 8, backgroundColor: '#07111e', padding: 4, zIndex: 40, elevation: 40 },
  pickerOption: { minHeight: 36, justifyContent: 'center', borderRadius: 5, paddingHorizontal: 9 },
  pickerOptionSelected: { backgroundColor: '#12243a' },
  status: { color: '#a9bbcf', fontSize: 13, lineHeight: 19, marginTop: 1 },
  progress: { color: '#16c7d9', fontSize: 12, fontVariant: ['tabular-nums'], marginTop: -8 },
});
