import React, { useCallback, useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { PlayerIcon } from '../../customization';

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const PERCENT_RANGE = 100;

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return MAX_PERCENT;
  // If passed as 0..1 ratio, convert to 0..100
  const normalized = number <= 1 && number > 0 ? Math.round(number * 100) : Math.round(number);
  return Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, normalized));
}

/** Native/Electron vertical sound slider. Controls volume without interrupting the video stream. */
export function VerticalVolumeControl({
  value = 100,
  onChange,
  onChangeEnd,
  accentColor = '#FFE066',
  compact = false,
  availableHeight,
  fullscreenLandscape = false,
  topInset = 0,
  bottomInset = 0,
  rightInset,
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
  const percent = clampPercent(value);
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
    changeRef.current?.(next);
    return next;
  }, []);

  const finishInteraction = useCallback((finalPercent = percentRef.current) => {
    const next = publishPercent(Math.round(finalPercent));
    changeEndRef.current?.(next);
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
  const safeRightInset = Number.isFinite(Number(rightInset)) ? Number(rightInset) : 10;
  const positionerStyle = [
    measuredHeight > 0
      ? {
          top: safeTopInset + (alignTop ? 0 : 3),
          bottom: safeBottomInset + 3,
          justifyContent: alignTop ? 'flex-start' : 'center',
        }
      : null,
    { paddingRight: safeRightInset },
  ];
  const adjustByKeyboard = (event) => {
    const change = event?.nativeEvent?.actionName === 'increment' ? 5 : -5;
    const next = clampPercent(percentRef.current + change);
    setActivePercent(next);
    finishInteraction(next);
  };

  const volumeIcon = displayPercent === 0
    ? 'volume-mute'
    : displayPercent < 50
      ? 'volume-medium'
      : 'volume-high';

  return (
    <View pointerEvents="box-none" style={[styles.positioner, positionerStyle]}>
      {measuredHeight > 0 && cardHeight < 44 ? null : (
        <View pointerEvents="auto" style={[styles.card, { height: cardHeight }, responsiveCompact && styles.compactCard]}>
          <View style={styles.iconWrap}>
            <PlayerIcon
              name={volumeIcon}
              size={(responsiveCompact ? 16 : 20) * (fullscreenLandscape ? 1.1 : 1)}
              color={accentColor}
            />
          </View>
          <View
            {...responder.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="Device sound volume"
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
          {!responsiveCompact ? (
            <Text
              style={[
                styles.valueLabel,
                fullscreenLandscape && { fontSize: 12, lineHeight: 14 },
              ]}
            >{displayPercent}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
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
  iconWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
