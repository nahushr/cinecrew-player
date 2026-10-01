import React, { useCallback, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

const MIN_PERCENT = 10;
const MAX_PERCENT = 100;
const PERCENT_RANGE = MAX_PERCENT - MIN_PERCENT;

function clampPercent(value) {
  const number = Number(value);
  return Math.round(Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, Number.isFinite(number) ? number : MAX_PERCENT)));
}


/** Native/Electron vertical slider. Brightness is rendered by the video layer, never the device. */
export function VerticalBrightnessControl({
  value = 1,
  onChange,
  onChangeEnd,
  accentColor = '#00D4FF',
  compact = false,
  availableHeight,
  fullscreenLandscape = false,
  topInset = 0,
  bottomInset = 0,
  leftInset,
  alignTop = false,
}) {
  const measuredHeight = Number(availableHeight);
  const responsiveCompact = compact || (measuredHeight > 0 && measuredHeight < 280);
  const safeTopInset = Math.max(0, Number(topInset) || 0);
  const safeBottomInset = Math.max(0, Number(bottomInset) || 0);
  const freeHeight = measuredHeight > 0
    ? Math.max(0, measuredHeight - safeTopInset - safeBottomInset - 6)
    : 0;
  const cardHeight = measuredHeight > 0
    ? Math.min(responsiveCompact ? 144 : 188, freeHeight)
    : (responsiveCompact ? 144 : 188);
  const reservedTrackSpace = responsiveCompact ? 38 : 56;
  const trackHeight = Math.max(12, Math.min(responsiveCompact ? 84 : 120, cardHeight - reservedTrackSpace));
  const percent = clampPercent(Number(value) * 100);
  const [activePercent, setActivePercent] = React.useState(percent);
  const isDraggingRef = useRef(false);
  const percentRef = useRef(percent);
  const dragStartPercentRef = useRef(percent);
  const changeRef = useRef(onChange);
  const changeEndRef = useRef(onChangeEnd);

  React.useEffect(() => {
    if (!isDraggingRef.current) {
      setActivePercent(percent);
      percentRef.current = percent;
    }
  }, [percent]);

  changeRef.current = onChange;
  changeEndRef.current = onChangeEnd;

  const publishPercent = useCallback((nextPercent) => {
    const next = clampPercent(Math.round(nextPercent));
    percentRef.current = next;
    changeRef.current?.(Number((next / 100).toFixed(2)));
    return next;
  }, []);

  const finishInteraction = useCallback((finalPercent = percentRef.current) => {
    const next = publishPercent(Math.round(finalPercent));
    changeEndRef.current?.(Math.round(next));
  }, [publishPercent]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      isDraggingRef.current = true;
      dragStartPercentRef.current = percentRef.current;
    },
    onPanResponderMove: (_event, gesture) => {
      const next = clampPercent(Math.round(dragStartPercentRef.current - (gesture.dy / trackHeight) * PERCENT_RANGE));
      setActivePercent(next);
      publishPercent(next);
    },
    onPanResponderRelease: (_event, gesture) => {
      isDraggingRef.current = false;
      const next = clampPercent(Math.round(dragStartPercentRef.current - (gesture.dy / trackHeight) * PERCENT_RANGE));
      setActivePercent(next);
      finishInteraction(next);
    },
    onPanResponderTerminate: (_event, gesture) => {
      isDraggingRef.current = false;
      const next = clampPercent(Math.round(dragStartPercentRef.current - (gesture.dy / trackHeight) * PERCENT_RANGE));
      setActivePercent(next);
      finishInteraction(next);
    },
  }), [finishInteraction, publishPercent, trackHeight]);

  const displayPercent = isDraggingRef.current ? activePercent : percent;
  const fillRatio = (displayPercent - MIN_PERCENT) / PERCENT_RANGE;
  const thumbTop = `${(1 - fillRatio) * 100}%`;
  const fillHeight = `${fillRatio * 100}%`;
  const safeLeftInset = Number.isFinite(Number(leftInset)) ? Number(leftInset) : 10;
  const positionerStyle = [
    measuredHeight > 0
      ? {
          top: safeTopInset + (alignTop ? 0 : 3),
          bottom: safeBottomInset + 3,
          justifyContent: alignTop ? 'flex-start' : 'center',
        }
      : null,
    { paddingLeft: safeLeftInset },
  ];
  const adjustByKeyboard = (event) => {
    const change = event?.nativeEvent?.actionName === 'increment' ? 5 : -5;
    const next = clampPercent(percentRef.current + change);
    setActivePercent(next);
    finishInteraction(next);
  };

  return (
    <View pointerEvents="box-none" style={[styles.positioner, positionerStyle]}>
      {measuredHeight > 0 && cardHeight < 44 ? null : (
        <View pointerEvents="auto" style={[styles.card, { height: cardHeight }, responsiveCompact && styles.compactCard]}>
          <Text
            style={[
              styles.sunIcon,
              responsiveCompact && styles.compactSunIcon,
              fullscreenLandscape && {
                fontSize: (responsiveCompact ? 14 : 20) * 1.1,
                lineHeight: (responsiveCompact ? 16 : 22) * 1.1,
              },
              { color: accentColor },
            ]}
            accessible={false}
          >☼</Text>
          <View
            {...responder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Video brightness"
            accessibilityValue={{ min: MIN_PERCENT, max: MAX_PERCENT, now: displayPercent, text: `${displayPercent}%` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={adjustByKeyboard}
            style={[styles.trackHitTarget, responsiveCompact && styles.compactTrackHitTarget, { height: trackHeight }]}
          >
            <View style={styles.track}>
              <View style={[styles.trackFill, { height: fillHeight, backgroundColor: accentColor }]} />
              <View style={[styles.thumb, { top: thumbTop, borderColor: accentColor }]} />
            </View>
          </View>
          <Text
            style={[
              styles.valueLabel,
              responsiveCompact && styles.compactValueLabel,
              fullscreenLandscape && {
                fontSize: (responsiveCompact ? 10 : 11) * 1.1,
                lineHeight: (responsiveCompact ? 12 : 13) * 1.1,
              },
            ]}
          >{displayPercent}</Text>
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
  sunIcon: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  compactSunIcon: { fontSize: 14, lineHeight: 16 },
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
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  compactValueLabel: { fontSize: 10, lineHeight: 12 },
});
