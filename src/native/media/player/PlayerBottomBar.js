import { Platform, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { ASPECT_OPTIONS, PLAYBACK_SPEEDS, formatTime } from './playerConstants';
import { PlayerIcon, usePlayerColors } from '../../customization';
import { isElectronOverlay } from '../../../utils/runtimePlatform';

function fullscreenButtonSize(compact, scale, rectangular = false) {
  const boost = scale?.buttonBoost || 1;
  if (boost <= 1) return null;
  const size = Math.round((compact ? 30 : 38) * boost);
  return rectangular
    ? {
        minWidth: size,
        minHeight: size,
        paddingHorizontal: Math.round((compact ? 7 : 11) * boost),
        paddingVertical: Math.round((compact ? 4 : 8) * boost),
        borderRadius: size / 2,
      }
    : { width: size, height: size, borderRadius: size / 2 };
}

function SeekControls({ isLive, controls, insets, scale, compact, edgePadding, isSeeking, sliderPos, currentTime, duration, onValueChange, onSlidingStart, onSlidingComplete }) {
  const palette = usePlayerColors();
  if (isLive || controls.seek === false) return null;
  const seeking = Boolean(isSeeking?.current);
  const displayTime = seeking ? sliderPos : currentTime;
  const remaining = duration > 0 ? `-${formatTime(Math.max(0, duration - displayTime))}` : '--:--';
  return (
    <View style={[styles.seekRow, compact && styles.compactSeekRow, { paddingHorizontal: compact ? 4 : edgePadding ?? Math.max(insets?.left || 0, insets?.right || 0, 20) }]} pointerEvents="box-none">
      <Text style={[styles.timeText, seeking && styles.timeTextSeeking, { color: seeking ? palette.accentColor : palette.controlColor, fontSize: compact ? 11 : scale?.timeFont, fontWeight: seeking ? scale?.timeSeekingWeight : scale?.timeWeight, minWidth: 38 }]}>{formatTime(displayTime)}</Text>
      <Slider testID="cinecrew-player-seek-slider" accessibilityLabel="Seek video" style={[styles.slider, compact && styles.compactSlider]} minimumValue={0} maximumValue={duration > 0 ? duration : 1} value={sliderPos} minimumTrackTintColor={palette.accentColor} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor={palette.accentColor} onValueChange={onValueChange} onSlidingStart={onSlidingStart} onSlidingComplete={onSlidingComplete} />
      <Text style={[styles.timeText, { color: palette.controlColor, fontSize: compact ? 11 : scale?.timeFont, fontWeight: scale?.timeWeight, minWidth: 46, textAlign: 'right' }]}>{remaining}</Text>
    </View>
  );
}

function AspectRatioControl({ controls, open, aspectRatio, aspectRatios = ASPECT_OPTIONS, onToggle, onSelect, compact, scale }) {
  const palette = usePlayerColors();
  if (controls.aspectRatio === false) return null;
  const iconBoost = scale?.iconBoost || 1;
  const selectedStyle = { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor };
  return (
    <View style={[styles.speedButtonContainer, open && styles.openPickerContainer, open && Platform.OS === 'android' && { elevation: 20 }]}>
      {open ? <View style={[styles.speedPickerPopup, compact && styles.compactPickerPopup, { right: 'auto', left: 0, backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
        <Text style={[styles.speedPickerTitle, compact && styles.compactPickerTitle, { color: palette.mutedColor }]}>Aspect Ratio</Text>
        {aspectRatios.map((option) => {
          const selected = aspectRatio === option.value;
          return <TouchableOpacity key={option.label} style={[styles.speedOption, compact && styles.compactSpeedOption]} onPress={(event) => { event.stopPropagation(); onSelect(option.value); }} activeOpacity={0.7}>
            <PlayerIcon name="check" size={Math.round((compact ? 12 : 15) * iconBoost)} color={selected ? palette.accentColor : 'transparent'} />
            <Text style={[styles.speedOptionText, compact && styles.compactSpeedOptionText, { color: selected ? palette.accentColor : palette.controlColor }, selected && styles.speedOptionTextActive]}>{option.label}</Text>
          </TouchableOpacity>;
        })}
      </View> : null}
      <TouchableOpacity style={[styles.speedButton, compact && styles.compactSpeedButton, fullscreenButtonSize(compact, scale, true), { backgroundColor: palette.controlBackground }, open && selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }}>
        <PlayerIcon pack="material" name="aspect-ratio" size={Math.round((compact ? 16 : 18) * iconBoost)} color={palette.controlColor} />
      </TouchableOpacity>
    </View>
  );
}

function AudioOnlyModeControl({ isAudioOnly, onToggle, compact, scale }) {
  const palette = usePlayerColors();
  const iconBoost = scale?.iconBoost || 1;
  const selectedStyle = isAudioOnly ? { backgroundColor: palette.surfaceColor, borderWidth: 1, borderColor: palette.accentColor } : null;
  return <TouchableOpacity style={[styles.speedButton, compact && styles.compactSpeedButton, fullscreenButtonSize(compact, scale, true), { backgroundColor: palette.controlBackground }, selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }} accessibilityLabel="Audio-Only Mode"><PlayerIcon name="headphones" size={Math.round((compact ? 16 : 18) * iconBoost)} color={isAudioOnly ? palette.accentColor : palette.controlColor} /></TouchableOpacity>;
}

function SpeedControl({ enabled, open, playbackRate, onToggle, onSelect, compact, scale }) {
  const palette = usePlayerColors();
  if (!enabled) return null;
  const iconBoost = scale?.iconBoost || 1;
  const selectedStyle = { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor };
  return (
    <View style={[styles.speedButtonContainer, open && styles.openPickerContainer, open && Platform.OS === 'android' && { elevation: 20 }]}>
      {open ? <View style={[styles.speedPickerPopup, compact && styles.compactPickerPopup, { backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
        <Text style={[styles.speedPickerTitle, compact && styles.compactPickerTitle, { color: palette.mutedColor }]}>Playback speed</Text>
        {[...PLAYBACK_SPEEDS].reverse().map((speed) => {
          const selected = playbackRate === speed;
          return <TouchableOpacity key={speed} style={[styles.speedOption, compact && styles.compactSpeedOption]} onPress={(event) => { event.stopPropagation(); onSelect(speed); }} activeOpacity={0.7}>
            <PlayerIcon name="check" size={Math.round((compact ? 12 : 15) * iconBoost)} color={selected ? palette.accentColor : 'transparent'} />
            <Text style={[styles.speedOptionText, compact && styles.compactSpeedOptionText, { color: selected ? palette.accentColor : palette.controlColor }, selected && styles.speedOptionTextActive]}>{speed === 1 ? 'Normal' : `${speed}x`}</Text>
          </TouchableOpacity>;
        })}
      </View> : null}
      <TouchableOpacity style={[styles.speedButton, compact && styles.compactSpeedButton, fullscreenButtonSize(compact, scale, true), { backgroundColor: palette.controlBackground }, open && selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }}>
        <View style={styles.speedButtonInner}>
          <Text style={[styles.speedButtonText, { color: palette.controlColor, fontSize: compact ? Math.round(12 * iconBoost) : undefined }]}>{playbackRate}x</Text>
          <PlayerIcon name="chevron-down" size={Math.round((compact ? 12 : 14) * iconBoost)} color={palette.controlColor} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

function AudioTrackMenu({ open, audioTracks, selectedAudioTrack, onSelect, palette, compact, scale }) {
  if (!open) return null;
  const iconBoost = scale?.iconBoost || 1;
  if (audioTracks.length === 0) return <View style={[styles.speedPickerPopup, compact && styles.compactPickerPopup, { backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}><Text style={[styles.speedOptionText, compact && styles.compactSpeedOptionText, { color: palette.controlColor }]}>No audio tracks available</Text></View>;
  return (
    <View style={[styles.speedPickerPopup, compact && styles.compactPickerPopup, { backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
      <Text style={[styles.speedPickerTitle, compact && styles.compactPickerTitle, { color: palette.mutedColor }]}>Audio</Text>
      {audioTracks.map((track) => {
        const selected = String(track.id) === String(selectedAudioTrack);
        return <TouchableOpacity key={`audio-${track.id}`} style={[styles.speedOption, compact && styles.compactSpeedOption]} onPress={(event) => { event.stopPropagation(); onSelect(track.id); }} activeOpacity={0.7}>
          <PlayerIcon name="check" size={Math.round((compact ? 12 : 15) * iconBoost)} color={selected ? palette.accentColor : 'transparent'} />
          <Text style={[styles.speedOptionText, compact && styles.compactSpeedOptionText, { color: selected ? palette.accentColor : palette.controlColor }, selected && styles.speedOptionTextActive]} numberOfLines={1}>{track.name || track.language || `Track ${track.id}`}</Text>
        </TouchableOpacity>;
      })}
    </View>
  );
}

function AudioTracksControl({ enabled, open, audioTracks, selectedAudioTrack, onToggle, onSelect, compact, scale }) {
  const palette = usePlayerColors();
  if (!enabled) return null;
  const iconBoost = scale?.iconBoost || 1;
  const selectedStyle = { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor };
  return (
    <View style={[styles.speedButtonContainer, open && styles.openPickerContainer, open && Platform.OS === 'android' && { elevation: 20 }]}>
      <AudioTrackMenu open={open} audioTracks={audioTracks} selectedAudioTrack={selectedAudioTrack} onSelect={onSelect} palette={palette} compact={compact} scale={scale} />
      <TouchableOpacity style={[styles.speedButton, compact && styles.compactSpeedButton, fullscreenButtonSize(compact, scale, true), { backgroundColor: palette.controlBackground }, open && selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }}>
        <PlayerIcon pack="material" name="audiotrack" size={Math.round((compact ? 16 : 18) * iconBoost)} color={palette.controlColor} />
      </TouchableOpacity>
    </View>
  );
}

function FullscreenControl({ enabled, isFullscreen, onToggle, compact, scale }) {
  const palette = usePlayerColors();
  if (!enabled) return null;
  const iconBoost = scale?.iconBoost || 1;
  const selectedStyle = { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor };
  return <TouchableOpacity style={[styles.fullscreenButton, compact && styles.compactFullscreenButton, fullscreenButtonSize(compact, scale), { backgroundColor: palette.controlBackground }, isFullscreen && selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }} hitSlop={10}><PlayerIcon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={Math.round((compact ? 17 : 20) * iconBoost)} color={palette.controlColor} /></TouchableOpacity>;
}

export const PlayerBottomBar = ({
  compact = false,
  isLive,
  insets,
  scale,
  isSeeking,
  sliderPos,
  currentTime,
  duration,
  isAudioOnlyFeatureEnabled,
  isAudioOnly,
  showAspectPicker,
  aspectRatio,
  aspectRatios = ASPECT_OPTIONS,
  showSpeedPicker,
  playbackRate,
  showAudioPicker,
  audioTracks = [],
  selectedAudioTrack,
  isFullscreen,
  onSliderValueChange,
  onSliderSlidingStart,
  onSliderSlidingComplete,
  onToggleAudioOnly,
  onToggleAspectPicker,
  onSelectAspectRatio,
  onToggleSpeedPicker,
  onSelectSpeed,
  onToggleAudioPicker,
  onSelectAudioTrack,
  onToggleFullscreen,
  controls = {},
  onPlayerLayout,
}) => {
  const electronFullscreen = isFullscreen && isElectronOverlay();
  const edgePadding = electronFullscreen ? 8 : (isFullscreen || (insets?.left || 0) > 0) ? Math.max(insets?.left || 0, insets?.right || 0, 20) : (compact ? 4 : 10);
  const leftPickerOpen = Boolean(showAspectPicker);
  const rightPickerOpen = Boolean(showSpeedPicker || showAudioPicker);
  const anyPickerOpen = leftPickerOpen || rightPickerOpen;
  const android = Platform.OS === 'android';
  const buttonBoost = scale?.buttonBoost || 1;

  return (
    <View
      style={[
        styles.bottomContainer,
        compact && styles.compactBottomContainer,
        {
          paddingBottom: electronFullscreen ? 8 : isFullscreen ? Math.max(insets?.bottom || 0, 16) : 6,
          paddingHorizontal: edgePadding,
        },
      ]}
      pointerEvents="box-none"
      onLayout={onPlayerLayout}
    >
      <SeekControls isLive={isLive} controls={controls} insets={insets} scale={scale} compact={compact} edgePadding={edgePadding} isSeeking={isSeeking} sliderPos={sliderPos} currentTime={currentTime} duration={duration} onValueChange={onSliderValueChange} onSlidingStart={onSliderSlidingStart} onSlidingComplete={onSliderSlidingComplete} />

      {/* ASPECT RATIO PICKER & RIGHT ACTIONS (PLAYBACK SPEED & FULLSCREEN) */}
      <View style={[styles.bottomControlsRow, compact && styles.compactBottomControlsRow, buttonBoost > 1 && { minHeight: Math.round((compact ? 32 : 44) * buttonBoost) }, electronFullscreen && { paddingHorizontal: 0 }, anyPickerOpen && styles.openPickerRow, anyPickerOpen && android && { elevation: 12 }]} pointerEvents="box-none">
        <View style={[styles.leftActionsContainer, leftPickerOpen && styles.openPickerActions, leftPickerOpen && android && { elevation: 16 }]}>
          {isAudioOnlyFeatureEnabled && controls.audioOnly !== false ? <AudioOnlyModeControl compact={compact} isAudioOnly={isAudioOnly} onToggle={onToggleAudioOnly} scale={scale} /> : null}
          <AspectRatioControl compact={compact} controls={controls} open={showAspectPicker} aspectRatio={aspectRatio} aspectRatios={aspectRatios} onToggle={onToggleAspectPicker} onSelect={onSelectAspectRatio} scale={scale} />
        </View>

        {/* RIGHT ACTIONS: Audio, Playback Speed, Fullscreen */}
        <View style={[styles.rightActionsContainer, rightPickerOpen && styles.openPickerActions, rightPickerOpen && android && { elevation: 16 }]}>
          {/* Audio Tracks Picker */}
          <AudioTracksControl compact={compact} enabled={controls.audioTracks !== false && !isLive} open={showAudioPicker} audioTracks={audioTracks} selectedAudioTrack={selectedAudioTrack} onToggle={onToggleAudioPicker} onSelect={onSelectAudioTrack} scale={scale} />

          {/* Playback Speed */}
          <SpeedControl compact={compact} enabled={!isLive && controls.playbackRate !== false} open={showSpeedPicker} playbackRate={playbackRate} onToggle={onToggleSpeedPicker} onSelect={onSelectSpeed} scale={scale} />

          {/* Fullscreen Button - available across platforms */}
          <FullscreenControl compact={compact} enabled={controls.fullscreen !== false} isFullscreen={isFullscreen} onToggle={onToggleFullscreen} scale={scale} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomContainer: {
    paddingVertical: 8,
    gap: 8,
    zIndex: 70,
    elevation: 70,
  },
  compactBottomContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingVertical: 2,
    gap: 2,
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  compactSeekRow: {
    gap: 4,
  },
  timeText: {
    color: '#FFF',
    fontVariant: ['tabular-nums'],
    fontSize: 12,
  },
  timeTextSeeking: {
    color: '#00E5FF',
  },
  slider: {
    flex: 1,
    height: 40,
    zIndex: 75,
    elevation: 75,
  },
  compactSlider: {
    flex: 1,
    height: 28,
  },
  bottomControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
    minHeight: 44,
  },
  openPickerRow: {
    zIndex: 180,
  },
  compactBottomControlsRow: {
    minHeight: 32,
    paddingHorizontal: 2,
  },
  speedButtonContainer: {
    position: 'relative',
    zIndex: 100,
  },
  openPickerContainer: {
    zIndex: 240,
  },
  leftActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  openPickerActions: {
    zIndex: 210,
  },
  rightActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  speedButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactSpeedButton: {
    minWidth: 30,
    minHeight: 30,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 15,
  },
  compactFullscreenButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  fullscreenButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButton: {
    minWidth: 38,
    minHeight: 38,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButtonText: {
    color: '#FFF',
    fontWeight: '700',
  },
  speedPickerPopup: {
    position: 'absolute',
    right: 0,
    bottom: 44,
    backgroundColor: 'rgba(15, 15, 15, 0.96)',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 168,
    zIndex: 240,
    ...(Platform.OS === 'android' ? { elevation: 24 } : null),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  compactPickerPopup: {
    bottom: 34,
    minWidth: 132,
    paddingVertical: 2,
    borderRadius: 10,
  },
  speedPickerTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  compactPickerTitle: {
    fontSize: 8,
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 2,
  },
  speedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  compactSpeedOption: {
    gap: 6,
    minHeight: 22,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  speedOptionText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  compactSpeedOptionText: {
    fontSize: 11,
    lineHeight: 14,
  },
  speedOptionTextActive: {
    fontWeight: '700',
  },
});
