import React, { useCallback, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

const MIN_PERCENT = 10;
const MAX_PERCENT = 100;
const PERCENT_RANGE = MAX_PERCENT - MIN_PERCENT;

function clampPercent(value) {
  const number = Number(value);
  return Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, Number.isFinite(number) ? number : MAX_PERCENT));
}

function percentFromTrackY(y, height) {
  const position = Math.max(0, Math.min(height, Number(y) || 0));
  return clampPercent(MAX_PERCENT - (position / height) * PERCENT_RANGE);
}

/** Native/Electron vertical slider. Brightness is rendered by the video layer, never the device. */
export function VerticalBrightnessControl({
  value = 1,
  onChange,
  onChangeEnd,
  accentColor = '#00D4FF',
  compact = false,
  availableHeight,
  topInset = 0,
  bottomInset = 0,
  alignTop = false,
}) {
  const measuredHeight = Number(availableHeight);
  const responsiveCompact = compact || (measuredHeight > 0 && measuredHeight < 260);
  const safeTopInset = Math.max(0, Number(topInset) || 0);
  const safeBottomInset = Math.max(0, Number(bottomInset) || 0);
  const freeHeight = measuredHeight > 0
    ? Math.max(0, measuredHeight - safeTopInset - safeBottomInset - 8)
    : 0;
  const cardHeight = measuredHeight > 0
    ? Math.min(188, freeHeight)
    : (responsiveCompact ? 154 : 188);
  const reservedTrackSpace = responsiveCompact ? 52 : 66;
  const trackHeight = Math.max(1, Math.min(responsiveCompact ? 92 : 120, cardHeight - reservedTrackSpace));
  const percent = clampPercent(Number(value) * 100);
  const percentRef = useRef(percent);
  const dragStartPercentRef = useRef(percent);
  const changeRef = useRef(onChange);
  const changeEndRef = useRef(onChangeEnd);
  percentRef.current = percent;
  changeRef.current = onChange;
  changeEndRef.current = onChangeEnd;

  const publishPercent = useCallback((nextPercent) => {
    const next = clampPercent(nextPercent);
    percentRef.current = next;
    changeRef.current?.(next / 100);
    return next;
  }, []);

  const finishInteraction = useCallback((finalPercent = percentRef.current) => {
    const next = publishPercent(finalPercent);
    changeEndRef.current?.(next);
  }, [publishPercent]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (event) => {
      const y = event?.nativeEvent?.locationY;
      const start = percentFromTrackY(y ?? ((MAX_PERCENT - percentRef.current) / PERCENT_RANGE) * trackHeight, trackHeight);
      dragStartPercentRef.current = start;
      publishPercent(start);
    },
    onPanResponderMove: (_event, gesture) => {
      publishPercent(dragStartPercentRef.current - (gesture.dy / trackHeight) * PERCENT_RANGE);
    },
    onPanResponderRelease: (_event, gesture) => {
      finishInteraction(dragStartPercentRef.current - (gesture.dy / trackHeight) * PERCENT_RANGE);
    },
    onPanResponderTerminate: (_event, gesture) => {
      finishInteraction(dragStartPercentRef.current - (gesture.dy / trackHeight) * PERCENT_RANGE);
    },
  }), [finishInteraction, publishPercent, trackHeight]);

  const fillRatio = (percent - MIN_PERCENT) / PERCENT_RANGE;
  const thumbTop = `${(1 - fillRatio) * 100}%`;
  const fillHeight = `${fillRatio * 100}%`;
  const positionerStyle = measuredHeight > 0
    ? {
        top: safeTopInset + (alignTop ? 0 : 4),
        bottom: safeBottomInset + 4,
        justifyContent: alignTop ? 'flex-start' : 'center',
      }
    : null;
  const adjustByKeyboard = (event) => {
    const change = event?.nativeEvent?.actionName === 'increment' ? 5 : -5;
    finishInteraction(percentRef.current + change);
  };

  return (
    <View pointerEvents="box-none" style={[styles.positioner, positionerStyle]}>
      {measuredHeight > 0 && cardHeight < 64 ? null : (
        <View pointerEvents="auto" style={[styles.card, { height: cardHeight }, responsiveCompact && styles.compactCard]}>
          <Text style={[styles.sunIcon, responsiveCompact && styles.compactSunIcon, { color: accentColor }]} accessible={false}>☼</Text>
          <View
            {...responder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Video brightness"
            accessibilityValue={{ min: MIN_PERCENT, max: MAX_PERCENT, now: percent, text: `${percent}%` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={adjustByKeyboard}
            style={[styles.trackHitTarget, responsiveCompact && styles.compactTrackHitTarget, { height: trackHeight }]}
          >
            <View style={styles.track}>
              <View style={[styles.trackFill, { height: fillHeight, backgroundColor: accentColor }]} />
              <View style={[styles.thumb, { top: thumbTop, borderColor: accentColor }]} />
            </View>
          </View>
          <Text style={[styles.valueLabel, responsiveCompact && styles.compactValueLabel]}>{percent}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 10,
    zIndex: 90,
    elevation: 90,
  },
  card: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(5,11,20,0.82)',
  },
  compactCard: { width: 42, paddingVertical: 6, borderRadius: 21 },
  sunIcon: { fontSize: 21, lineHeight: 25, fontWeight: '700' },
  compactSunIcon: { fontSize: 17, lineHeight: 20 },
  trackHitTarget: { width: 38, alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  compactTrackHitTarget: { width: 34, marginVertical: 2 },
  track: {
    width: 5,
    height: '100%',
    overflow: 'visible',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.30)',
    justifyContent: 'flex-end',
  },
  trackFill: { position: 'absolute', bottom: 0, left: 0, right: 0, borderRadius: 4, opacity: 0.88 },
  thumb: {
    position: 'absolute',
    left: -7,
    width: 19,
    height: 19,
    borderRadius: 10,
    marginTop: -9,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.32,
    shadowRadius: 4,
    elevation: 3,
  },
  valueLabel: { color: '#FFFFFF', fontSize: 11, lineHeight: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  compactValueLabel: { fontSize: 10, lineHeight: 13 },
});
