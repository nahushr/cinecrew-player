import React from 'react';
import { StyleSheet, View } from 'react-native';

export function VerticalSliderCard({
  positionerStyle,
  alignItems = 'center',
  cardHeight,
  responsiveCompact,
  leadingContent,
  responder,
  accessibilityLabel,
  minimumValue,
  maximumValue,
  displayPercent,
  onAccessibilityAction,
  trackHeight,
  fillHeight,
  accentColor,
  thumbTop,
  trailingContent,
}) {
  return (
    <View pointerEvents="box-none" style={[styles.positioner, { alignItems }, positionerStyle]}>
      <View pointerEvents="auto" style={[styles.card, { height: cardHeight }, responsiveCompact && styles.compactCard]}>
        {leadingContent}
        <View
          {...responder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{
            min: minimumValue,
            max: maximumValue,
            now: displayPercent,
            text: `${displayPercent}%`,
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAccessibilityAction}
          style={[styles.trackHitTarget, responsiveCompact && styles.compactTrackHitTarget, { height: trackHeight }]}
        >
          <View style={styles.track}>
            <View style={[styles.trackFill, { height: fillHeight, backgroundColor: accentColor }]} />
            <View style={[styles.thumb, { top: thumbTop, borderColor: accentColor }]} />
          </View>
        </View>
        {trailingContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 90,
    elevation: 90,
  },
  card: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  compactCard: { width: 30, paddingVertical: 2 },
  trackHitTarget: { width: 36, alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
  compactTrackHitTarget: { width: 32, marginVertical: 6 },
  track: {
    width: 4,
    height: '100%',
    overflow: 'visible',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.40)',
    justifyContent: 'flex-end',
  },
  trackFill: { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 4, opacity: 0.88 },
  thumb: {
    position: 'absolute',
    left: -7,
    width: 18,
    height: 18,
    borderRadius: 9,
    marginTop: -9,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  valueLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
