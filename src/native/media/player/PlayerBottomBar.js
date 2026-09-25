import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { isWeb, isElectron } from '../../../utils/runtimePlatform';
import { ASPECT_OPTIONS, PLAYBACK_SPEEDS, formatTime } from './playerConstants';
import { PlayerIcon, usePlayerColors } from '../../customization';

function SeekControls({ isLive, controls, insets, scale, isSeeking, sliderPos, currentTime, duration, onValueChange, onSlidingStart, onSlidingComplete }) {
  const palette = usePlayerColors();
  if (isLive || controls.seek === false) return null;
  const seeking = Boolean(isSeeking?.current);
  const displayTime = seeking ? sliderPos : currentTime;
  const remaining = duration > 0 ? formatTime(Math.max(0, duration - displayTime)) : '--:--';
  return (
    <View style={[styles.bottomBar, { paddingHorizontal: Math.max(insets?.left || 0, insets?.right || 0, 20) }]} pointerEvents="box-none">
      <View style={styles.timeRow}>
        <Text style={[styles.timeText, seeking && styles.timeTextSeeking, { color: seeking ? palette.accentColor : palette.controlColor, fontSize: scale?.timeFont, fontWeight: seeking ? scale?.timeSeekingWeight : scale?.timeWeight }]}>{formatTime(displayTime)}</Text>
        <Text style={[styles.timeText, { color: palette.controlColor, fontSize: scale?.timeFont, fontWeight: scale?.timeWeight }]}>{remaining}</Text>
      </View>
      <Slider testID="cinecrew-player-seek-slider" accessibilityLabel="Seek video" style={styles.slider} minimumValue={0} maximumValue={duration > 0 ? duration : 1} value={sliderPos} minimumTrackTintColor={palette.accentColor} maximumTrackTintColor="rgba(255,255,255,0.3)" thumbTintColor={palette.accentColor} onValueChange={onValueChange} onSlidingStart={onSlidingStart} onSlidingComplete={onSlidingComplete} />
    </View>
  );
}

function AspectRatioControl({ controls, open, aspectRatio, onToggle, onSelect }) {
  const palette = usePlayerColors();
  if (controls.aspectRatio === false) return null;
  const selectedStyle = { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor };
  return (
    <View style={styles.speedButtonContainer}>
      {open ? <View style={[styles.speedPickerPopup, { right: 'auto', left: 0, backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
        <Text style={[styles.speedPickerTitle, { color: palette.mutedColor }]}>Aspect Ratio</Text>
        {ASPECT_OPTIONS.map((option) => {
          const selected = aspectRatio === option.value;
          return <TouchableOpacity key={option.label} style={styles.speedOption} onPress={(event) => { event.stopPropagation(); onSelect(option.value); }} activeOpacity={0.7}>
            <PlayerIcon name="check" size={15} color={selected ? palette.accentColor : 'transparent'} />
            <Text style={[styles.speedOptionText, { color: selected ? palette.accentColor : palette.controlColor }, selected && styles.speedOptionTextActive]}>{option.label}</Text>
          </TouchableOpacity>;
        })}
      </View> : null}
      <TouchableOpacity style={[styles.speedButton, { backgroundColor: palette.controlBackground }, open && selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }}>
        <PlayerIcon pack="material" name="aspect-ratio" size={18} color={palette.controlColor} />
      </TouchableOpacity>
    </View>
  );
}

function AudioOnlyModeControl({ isAudioOnly, onToggle }) {
  const palette = usePlayerColors();
  const selectedStyle = isAudioOnly ? { backgroundColor: palette.surfaceColor, borderWidth: 1, borderColor: palette.accentColor } : null;
  return <TouchableOpacity style={[styles.speedButton, { backgroundColor: palette.controlBackground }, selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }} accessibilityLabel="Audio-Only Mode"><PlayerIcon name="headphones" size={18} color={isAudioOnly ? palette.accentColor : palette.controlColor} /></TouchableOpacity>;
}

function VideoOnlyControl({ isVideoOnly, onToggle }) {
  const palette = usePlayerColors();
  const selectedStyle = isVideoOnly ? { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor } : null;
  return <TouchableOpacity style={[styles.speedButton, { backgroundColor: palette.controlBackground }, selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle?.(); }} accessibilityLabel={isVideoOnly ? 'Disable video-only mode' : 'Video only'}><PlayerIcon name="video" size={18} color={isVideoOnly ? palette.accentColor : palette.controlColor} /></TouchableOpacity>;
}

function SpeedControl({ enabled, open, playbackRate, onToggle, onSelect }) {
  const palette = usePlayerColors();
  if (!enabled) return null;
  const selectedStyle = { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor };
  return (
    <View style={styles.speedButtonContainer}>
      {open ? <View style={[styles.speedPickerPopup, { backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
        <Text style={[styles.speedPickerTitle, { color: palette.mutedColor }]}>Playback speed</Text>
        {[...PLAYBACK_SPEEDS].reverse().map((speed) => {
          const selected = playbackRate === speed;
          return <TouchableOpacity key={speed} style={styles.speedOption} onPress={(event) => { event.stopPropagation(); onSelect(speed); }} activeOpacity={0.7}>
            <PlayerIcon name="check" size={15} color={selected ? palette.accentColor : 'transparent'} />
            <Text style={[styles.speedOptionText, { color: selected ? palette.accentColor : palette.controlColor }, selected && styles.speedOptionTextActive]}>{speed === 1 ? 'Normal' : `${speed}x`}</Text>
          </TouchableOpacity>;
        })}
      </View> : null}
      <TouchableOpacity style={[styles.speedButton, { backgroundColor: palette.controlBackground }, open && selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }}>
        <Text style={[styles.speedButtonText, { color: palette.controlColor }]}>{playbackRate}x</Text>
      </TouchableOpacity>
    </View>
  );
}

function AudioTrackMenu({ open, audioTracks, selectedAudioTrack, onSelect, palette }) {
  if (!open) return null;
  if (audioTracks.length === 0) return <View style={[styles.speedPickerPopup, { backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}><Text style={[styles.speedOptionText, { color: palette.controlColor }]}>No audio tracks available</Text></View>;
  return (
    <View style={[styles.speedPickerPopup, { backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
      <Text style={[styles.speedPickerTitle, { color: palette.mutedColor }]}>Audio</Text>
      {audioTracks.map((track) => {
        const selected = String(track.id) === String(selectedAudioTrack);
        return <TouchableOpacity key={`audio-${track.id}`} style={styles.speedOption} onPress={(event) => { event.stopPropagation(); onSelect(track.id); }} activeOpacity={0.7}>
          <PlayerIcon name="check" size={15} color={selected ? palette.accentColor : 'transparent'} />
          <Text style={[styles.speedOptionText, { color: selected ? palette.accentColor : palette.controlColor }, selected && styles.speedOptionTextActive]} numberOfLines={1}>{track.name || track.language || `Track ${track.id}`}</Text>
        </TouchableOpacity>;
      })}
    </View>
  );
}

function AudioTracksControl({ enabled, open, audioTracks, selectedAudioTrack, onToggle, onSelect }) {
  const palette = usePlayerColors();
  if (!enabled) return null;
  const selectedStyle = { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor };
  return (
    <View style={styles.speedButtonContainer}>
      <AudioTrackMenu open={open} audioTracks={audioTracks} selectedAudioTrack={selectedAudioTrack} onSelect={onSelect} palette={palette} />
      <TouchableOpacity style={[styles.speedButton, { backgroundColor: palette.controlBackground }, open && selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }}>
        <PlayerIcon pack="material" name="audiotrack" size={18} color={palette.controlColor} />
      </TouchableOpacity>
    </View>
  );
}

function FullscreenControl({ enabled, isFullscreen, onToggle }) {
  const palette = usePlayerColors();
  if (!enabled) return null;
  const selectedStyle = { backgroundColor: palette.surfaceColor, borderWidth: 1.5, borderColor: palette.accentColor };
  return <TouchableOpacity style={[styles.fullscreenButton, { backgroundColor: palette.controlBackground }, isFullscreen && selectedStyle]} onPress={(event) => { event.stopPropagation(); onToggle(); }} hitSlop={10}><PlayerIcon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={20} color={palette.controlColor} /></TouchableOpacity>;
}

export const PlayerBottomBar = ({
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
  isVideoOnly = false,
  onToggleVideoOnly,
}) => {
  return (
    <View
      style={[
        styles.bottomContainer,
        {
          paddingBottom: Math.max(insets?.bottom || 0, 16),
          paddingHorizontal: Math.max(insets?.left || 0, insets?.right || 0, 20),
        },
      ]}
      pointerEvents="box-none"
    >
      <SeekControls isLive={isLive} controls={controls} insets={insets} scale={scale} isSeeking={isSeeking} sliderPos={sliderPos} currentTime={currentTime} duration={duration} onValueChange={onSliderValueChange} onSlidingStart={onSliderSlidingStart} onSlidingComplete={onSliderSlidingComplete} />

      {/* ASPECT RATIO PICKER & RIGHT ACTIONS (PLAYBACK SPEED & FULLSCREEN) */}
      <View style={styles.bottomControlsRow} pointerEvents="box-none">
        <View style={styles.leftActionsContainer}>
          {isAudioOnlyFeatureEnabled && controls.audioOnly !== false ? <AudioOnlyModeControl isAudioOnly={isAudioOnly} onToggle={onToggleAudioOnly} /> : null}
          <AspectRatioControl controls={controls} open={showAspectPicker} aspectRatio={aspectRatio} onToggle={onToggleAspectPicker} onSelect={onSelectAspectRatio} />
          {controls.videoOnly ? <VideoOnlyControl isVideoOnly={isVideoOnly} onToggle={onToggleVideoOnly} /> : null}
        </View>

        {/* RIGHT ACTIONS: Playback Speed, Audio, Fullscreen */}
        <View style={styles.rightActionsContainer}>
          <SpeedControl enabled={!isLive && controls.playbackRate !== false} open={showSpeedPicker} playbackRate={playbackRate} onToggle={onToggleSpeedPicker} onSelect={onSelectSpeed} />

          {/* Audio Tracks Picker */}
          <AudioTracksControl enabled={controls.audioTracks !== false && !isLive && (!isWeb() || isElectron())} open={showAudioPicker} audioTracks={audioTracks} selectedAudioTrack={selectedAudioTrack} onToggle={onToggleAudioPicker} onSelect={onSelectAudioTrack} />

          {/* Fullscreen Button - comes after playback speed (web only) */}
          <FullscreenControl enabled={isWeb() && controls.fullscreen !== false} isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
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
  bottomBar: {
    gap: 6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeText: {
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  timeTextSeeking: {
    color: '#FFD60A',
  },
  slider: {
    width: '100%',
    height: 48,
    zIndex: 75,
    elevation: 75,
  },
  bottomControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
    minHeight: 44,
  },
  speedButtonContainer: {
    position: 'relative',
    zIndex: 100,
  },
  leftActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  rightActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
  },
  fullscreenButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    zIndex: 200,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
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
  speedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  speedOptionText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '500',
  },
  speedOptionTextActive: {
    fontWeight: '700',
  },
});
