import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { isWeb } from '../../../utils/runtimePlatform';
import { getBrightnessIcon, getVolumeIcon } from './playerConstants';
import { PlayerIcon } from '../../customization';

export const BrightnessIndicator = ({
  visible,
  brightness,
  leftInset = 28,
  onPointerDown,
  onNativeGrant,
  onNativeMove,
}) => {
  if (!visible) return null;

  return (
    <View
      style={[
        styles.verticalIndicatorContainer,
        styles.verticalIndicatorLeft,
        { left: leftInset },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={styles.verticalIndicatorPill}
        {...(isWeb()
          ? {
              onPointerDown,
              onMouseDown: onPointerDown,
              onTouchStart: onPointerDown,
            }
          : {
              onStartShouldSetResponder: () => true,
              onResponderGrant: onNativeGrant,
              onResponderMove: onNativeMove,
            })}
      >
        <View style={styles.verticalIndicatorIconWrap} pointerEvents="none">
          <PlayerIcon
            name={getBrightnessIcon(brightness)}
            size={20}
            color="#FFD60A"
          />
        </View>
        <View style={styles.verticalIndicatorTrack} pointerEvents="none">
          <View
            style={[
              styles.verticalIndicatorFill,
              {
                height: `${Math.round(brightness * 100)}%`,
                backgroundColor: '#FFD60A',
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

export const VolumeIndicator = ({
  visible,
  volume,
  muted,
  rightInset = 28,
  onPointerDown,
  onNativeGrant,
  onNativeMove,
  onToggleMute,
}) => {
  if (!visible) return null;

  return (
    <View
      style={[
        styles.verticalIndicatorContainer,
        styles.verticalIndicatorRight,
        { right: rightInset },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={styles.verticalIndicatorPill}
        {...(isWeb()
          ? {
              onPointerDown,
              onMouseDown: onPointerDown,
              onTouchStart: onPointerDown,
            }
          : {
              onStartShouldSetResponder: () => true,
              onResponderGrant: onNativeGrant,
              onResponderMove: onNativeMove,
            })}
      >
        <TouchableOpacity
          style={styles.verticalIndicatorIconWrap}
          onPress={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          activeOpacity={0.7}
        >
          <PlayerIcon
            name={getVolumeIcon(muted ? 0 : volume)}
            size={20}
            color={muted ? '#FF5252' : '#00E5FF'}
          />
        </TouchableOpacity>
        <View style={styles.verticalIndicatorTrack} pointerEvents="none">
          <View
            style={[
              styles.verticalIndicatorFill,
              {
                height: `${muted ? 0 : volume}%`,
                backgroundColor: muted ? '#FF5252' : '#00E5FF',
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  verticalIndicatorContainer: {
    position: 'absolute',
    top: 0,
    bottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 150,
  },
  verticalIndicatorLeft: {
    left: 20,
  },
  verticalIndicatorRight: {
    right: 20,
  },
  verticalIndicatorPill: {
    width: 48,
    height: 184,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    ...(isWeb() ? {
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.35)',
      cursor: 'pointer',
      userSelect: 'none',
      touchAction: 'none',
    } : null),
  },
  verticalIndicatorIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
    width: 26,
  },
  verticalIndicatorTrack: {
    width: 8,
    flex: 1,
    marginVertical: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  verticalIndicatorFill: {
    width: '100%',
    borderRadius: 4,
  },
});
