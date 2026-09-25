import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { isWeb, isElectron } from '../../../utils/runtimePlatform';
import { ASPECT_OPTIONS, PLAYBACK_SPEEDS, formatTime } from './playerConstants';
import { PlayerIcon, usePlayerColors } from '../../customization';

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
  const palette = usePlayerColors();
  const activeButtonStyle = {
    backgroundColor: palette.surfaceColor,
    borderWidth: 1.5,
    borderColor: palette.accentColor,
  };
  const displayTime = isSeeking?.current ? sliderPos : currentTime;
  const remainingTimeStr = duration > 0 ? formatTime(Math.max(0, duration - displayTime)) : '--:--';

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
      {/* BOTTOM BAR (Movies & Series seek slider) */}
      {!isLive && controls.seek !== false && (
        <View style={styles.bottomBar} pointerEvents="box-none">
          <View style={styles.timeRow}>
            <Text
              style={[
                styles.timeText,
                isSeeking?.current && styles.timeTextSeeking,
                {
                  color: isSeeking?.current ? palette.accentColor : palette.controlColor,
                  fontSize: scale?.timeFont,
                  fontWeight: isSeeking?.current ? scale?.timeSeekingWeight : scale?.timeWeight,
                },
              ]}
            >
              {formatTime(displayTime)}
            </Text>
            <Text style={[styles.timeText, { color: palette.controlColor, fontSize: scale?.timeFont, fontWeight: scale?.timeWeight }]}>
              {remainingTimeStr}
            </Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={duration > 0 ? duration : 1}
            value={sliderPos}
            minimumTrackTintColor={palette.accentColor}
            maximumTrackTintColor="rgba(255,255,255,0.3)"
            thumbTintColor={palette.accentColor}
            onValueChange={onSliderValueChange}
            onSlidingStart={onSliderSlidingStart}
            onSlidingComplete={onSliderSlidingComplete}
          />
        </View>
      )}

      {/* ASPECT RATIO PICKER & RIGHT ACTIONS (PLAYBACK SPEED & FULLSCREEN) */}
      <View style={styles.bottomControlsRow} pointerEvents="box-none">
        <View style={styles.leftActionsContainer}>
          {isAudioOnlyFeatureEnabled && controls.audioOnly !== false ? (
            <TouchableOpacity
              style={[
                styles.speedButton,
                { backgroundColor: palette.controlBackground },
                isAudioOnly && {
                  backgroundColor: palette.surfaceColor,
                  borderWidth: 1,
                  borderColor: palette.accentColor,
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleAudioOnly();
              }}
              accessibilityLabel="Audio-Only Mode"
            >
              <PlayerIcon
                name="headphones"
                size={18}
                color={isAudioOnly ? palette.accentColor : palette.controlColor}
              />
            </TouchableOpacity>
          ) : null}

          {controls.aspectRatio !== false ? <View style={styles.speedButtonContainer}>
            {showAspectPicker && (
              <View style={[styles.speedPickerPopup, { right: 'auto', left: 0, backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
                <Text style={[styles.speedPickerTitle, { color: palette.mutedColor }]}>Aspect Ratio</Text>
                {ASPECT_OPTIONS.map((opt) => {
                  const isSelected = aspectRatio === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={styles.speedOption}
                      onPress={(e) => {
                        e.stopPropagation();
                        onSelectAspectRatio(opt.value);
                      }}
                      activeOpacity={0.7}
                    >
                      <PlayerIcon
                        name="check"
                        size={15}
                        color={isSelected ? palette.accentColor : 'transparent'}
                      />
                      <Text style={[styles.speedOptionText, { color: isSelected ? palette.accentColor : palette.controlColor }, isSelected && styles.speedOptionTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              style={[styles.speedButton, { backgroundColor: palette.controlBackground }, showAspectPicker && activeButtonStyle]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleAspectPicker();
              }}
            >
              <PlayerIcon pack="material" name="aspect-ratio" size={18} color={palette.controlColor} />
            </TouchableOpacity>
          </View> : null}

          {controls.videoOnly ? (
            <TouchableOpacity
              style={[styles.speedButton, { backgroundColor: palette.controlBackground }, isVideoOnly && activeButtonStyle]}
              onPress={(e) => { e.stopPropagation(); onToggleVideoOnly?.(); }}
              accessibilityLabel={isVideoOnly ? 'Enable audio' : 'Video only'}
            >
              <PlayerIcon name="video" size={18} color={isVideoOnly ? palette.accentColor : palette.controlColor} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* RIGHT ACTIONS: Playback Speed, Audio, Fullscreen */}
        <View style={styles.rightActionsContainer}>
          {!isLive && controls.playbackRate !== false && (
            <View style={styles.speedButtonContainer}>
              {showSpeedPicker && (
                <View style={[styles.speedPickerPopup, { backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
                  <Text style={[styles.speedPickerTitle, { color: palette.mutedColor }]}>Playback speed</Text>
                  {[...PLAYBACK_SPEEDS].reverse().map((speed) => (
                    <TouchableOpacity
                      key={speed}
                      style={styles.speedOption}
                      onPress={(e) => {
                        e.stopPropagation();
                        onSelectSpeed(speed);
                      }}
                      activeOpacity={0.7}
                    >
                      <PlayerIcon
                        name="check"
                        size={15}
                        color={playbackRate === speed ? palette.accentColor : 'transparent'}
                      />
                      <Text
                        style={[
                          styles.speedOptionText,
                          { color: playbackRate === speed ? palette.accentColor : palette.controlColor },
                          playbackRate === speed && styles.speedOptionTextActive,
                        ]}
                      >
                        {speed === 1 ? 'Normal' : `${speed}x`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.speedButton, { backgroundColor: palette.controlBackground }, showSpeedPicker && activeButtonStyle]}
                onPress={(e) => {
                  e.stopPropagation();
                  onToggleSpeedPicker();
                }}
              >
                <Text style={[styles.speedButtonText, { color: palette.controlColor }]}>{playbackRate}x</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Audio Tracks Picker */}
          {controls.audioTracks !== false && !isLive && (!isWeb() || isElectron()) && (
            <View style={styles.speedButtonContainer}>
              {showAudioPicker && (
                <View style={[styles.speedPickerPopup, { backgroundColor: palette.surfaceColor, borderColor: palette.borderColor }]}>
                  <Text style={[styles.speedPickerTitle, { color: palette.mutedColor }]}>Audio</Text>
                  {audioTracks.length <= 1 ? (
                    <View style={styles.speedOption}>
                              <Text style={[styles.speedOptionText, { color: palette.controlColor }]}>No other audio available</Text>
                    </View>
                  ) : (
                    <>
                      {audioTracks.map((track) => {
                        const isSel = String(track.id) === String(selectedAudioTrack);
                        return (
                          <TouchableOpacity
                            key={`audio-${track.id}`}
                            style={styles.speedOption}
                            onPress={(e) => {
                              e.stopPropagation();
                              onSelectAudioTrack(track.id);
                            }}
                            activeOpacity={0.7}
                          >
                            <PlayerIcon
                              name="check"
                              size={15}
                              color={isSel ? palette.accentColor : 'transparent'}
                            />
                            <Text
                              style={[styles.speedOptionText, { color: isSel ? palette.accentColor : palette.controlColor }, isSel && styles.speedOptionTextActive]}
                              numberOfLines={1}
                            >
                              {track.name || track.language || `Track ${track.id}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </View>
              )}
              <TouchableOpacity
                style={[styles.speedButton, { backgroundColor: palette.controlBackground }, showAudioPicker && activeButtonStyle]}
                onPress={(e) => {
                  e.stopPropagation();
                  onToggleAudioPicker();
                }}
              >
              <PlayerIcon pack="material" name="audiotrack" size={18} color={palette.controlColor} />
              </TouchableOpacity>
            </View>
          )}

          {/* Fullscreen Button - comes after playback speed (web only) */}
          {isWeb() && controls.fullscreen !== false ? (
            <TouchableOpacity
              style={[styles.fullscreenButton, { backgroundColor: palette.controlBackground }, isFullscreen && activeButtonStyle]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleFullscreen();
              }}
              hitSlop={10}
            >
              <PlayerIcon
                name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
                size={20}
                color={palette.controlColor}
              />
            </TouchableOpacity>
          ) : null}
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
    height: 36,
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
