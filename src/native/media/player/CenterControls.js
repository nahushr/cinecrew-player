import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { PlayerIcon, usePlayerColors } from '../../customization';

export const CenterControls = ({
  visible = true,
  compact = false,
  isLive,
  showSeekButtons = false,
  isPlaying,
  onSeekBy,
  onTogglePlayPause,
  scale,
}) => {
  const palette = usePlayerColors();
  if (!visible) return null;

  const iconBoost = scale?.iconBoost || 1;
  const iconSize = Math.round((compact ? 24 : 28) * iconBoost);
  const btnSize = Math.round((compact ? 44 : 52) * iconBoost);

  return (
    <View style={[styles.centerContainer, compact && styles.compactCenterContainer]} pointerEvents="box-none">
      <View style={[styles.centerRow, compact && styles.compactCenterRow]} pointerEvents="box-none">
        {showSeekButtons && !isLive ? (
          <TouchableOpacity
            style={[styles.seekButton, compact && styles.compactSeekButton]}
            onPress={(event) => {
              event.stopPropagation();
              onSeekBy?.(-10);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Rewind 10 seconds"
          >
            <PlayerIcon name="rewind-10" size={iconSize} color={palette.controlColor} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.bigPlayBtn, compact && styles.compactBigPlayBtn, iconBoost > 1 && { width: btnSize, height: btnSize, borderRadius: Math.round(btnSize / 2) }]}
          onPress={(e) => {
            e.stopPropagation();
            onTogglePlayPause();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          <PlayerIcon
            name={isPlaying ? 'pause' : 'play'}
            size={iconSize}
            color={palette.controlColor}
          />
        </TouchableOpacity>
        {showSeekButtons && !isLive ? (
          <TouchableOpacity
            style={[styles.seekButton, compact && styles.compactSeekButton]}
            onPress={(event) => {
              event.stopPropagation();
              onSeekBy?.(10);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Forward 10 seconds"
          >
            <PlayerIcon name="fast-forward-10" size={iconSize} color={palette.controlColor} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactCenterContainer: {
    // Compact landscape controls are layered over the complete video area.
    // Centering them in the remaining space between the top/bottom bars puts
    // them too high and can collide with the title row on short screens.
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flex: 0,
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  compactCenterRow: {
    gap: 10,
  },
  seekButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(12, 20, 32, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 70,
    elevation: 70,
  },
  compactSeekButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 70,
    elevation: 70,
  },
  bigPlayBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(12, 20, 32, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 70,
    elevation: 70,
  },
  compactBigPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
});
