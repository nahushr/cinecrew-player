import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { PlayerIcon, usePlayerColors } from '../../customization';

export const CenterControls = ({
  visible = true,
  isLive,
  isPlaying,
  onSeekBy,
  onTogglePlayPause,
}) => {
  const palette = usePlayerColors();
  if (!visible) return null;

  return (
    <View style={styles.centerContainer} pointerEvents="box-none">
      <View style={styles.centerRow} pointerEvents="box-none">
        {!isLive && (
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: palette.controlBackground }]}
            onPress={(e) => {
              e.stopPropagation();
              onSeekBy(-10);
            }}
            hitSlop={12}
          >
            <PlayerIcon pack="material" name="replay-10" size={32} color={palette.controlColor} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.bigPlayBtn, { backgroundColor: palette.controlColor }]}
          onPress={(e) => {
            e.stopPropagation();
            onTogglePlayPause();
          }}
        >
          <PlayerIcon
            name={isPlaying ? 'pause' : 'play'}
            size={40}
            color={palette.backgroundColor}
          />
        </TouchableOpacity>

        {!isLive && (
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: palette.controlBackground }]}
            onPress={(e) => {
              e.stopPropagation();
              onSeekBy(10);
            }}
            hitSlop={12}
          >
            <PlayerIcon pack="material" name="forward-10" size={32} color={palette.controlColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
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
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 70,
    elevation: 70,
  },
});
