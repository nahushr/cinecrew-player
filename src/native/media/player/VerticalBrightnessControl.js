import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VerticalSliderCard } from './VerticalSliderCard';
import {
  getVerticalSliderMetrics,
  getVerticalSliderPositionStyle,
  useVerticalSliderModel,
} from './verticalSliderUtils';

const MIN_PERCENT = 10;
const MAX_PERCENT = 100;
const PERCENT_RANGE = MAX_PERCENT - MIN_PERCENT;

function toBrightnessPercent(value) {
  return Number(value) * 100;
}

function toBrightnessValue(percent) {
  return Number((percent / 100).toFixed(2));
}

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
  const metrics = getVerticalSliderMetrics({ availableHeight, compact, topInset, bottomInset });
  const { measuredHeight, responsiveCompact, safeTopInset, safeBottomInset, cardHeight, trackHeight } = metrics;
  const slider = useVerticalSliderModel({
    value,
    onChange,
    onChangeEnd,
    clampPercent,
    toPercent: toBrightnessPercent,
    toValue: toBrightnessValue,
    percentRange: { range: PERCENT_RANGE, trackHeight },
  });
  const { displayPercent, responder, adjustByKeyboard } = slider;
  const fillRatio = (displayPercent - MIN_PERCENT) / PERCENT_RANGE;
  const thumbTop = `${(1 - fillRatio) * 100}%`;
  const fillHeight = `${fillRatio * 100}%`;
  const safeLeftInset = Number.isFinite(Number(leftInset)) ? Number(leftInset) : 10;
  const landscapeSunStyle = getLandscapeSunStyle(responsiveCompact, fullscreenLandscape);
  const positionerStyle = getVerticalSliderPositionStyle({
    measuredHeight,
    safeTopInset,
    safeBottomInset,
    alignTop,
    horizontalInset: safeLeftInset,
    insetSide: 'left',
  });
  if (measuredHeight > 0 && cardHeight < 44) {
    return <View pointerEvents="box-none" style={[styles.positioner, positionerStyle]} />;
  }
  const leadingContent = (
    <Text
      style={[styles.sunIcon, responsiveCompact && styles.compactSunIcon, landscapeSunStyle, { color: accentColor }]}
      accessible={false}
    >☼</Text>
  );
  let trailingContent = null;
  if (!responsiveCompact) {
    trailingContent = (
      <Text style={[styles.valueLabel, fullscreenLandscape && { fontSize: 12, lineHeight: 14 }]}>
        {displayPercent}
      </Text>
    );
  }

  return (
    <VerticalSliderCard
      positionerStyle={positionerStyle}
      alignItems="flex-start"
      cardHeight={cardHeight}
      responsiveCompact={responsiveCompact}
      leadingContent={leadingContent}
      responder={responder}
      accessibilityLabel="Video brightness"
      minimumValue={MIN_PERCENT}
      maximumValue={MAX_PERCENT}
      displayPercent={displayPercent}
      onAccessibilityAction={adjustByKeyboard}
      trackHeight={trackHeight}
      fillHeight={fillHeight}
      accentColor={accentColor}
      thumbTop={thumbTop}
      trailingContent={trailingContent}
    />
  );
}

function getLandscapeSunStyle(responsiveCompact, fullscreenLandscape) {
  if (!fullscreenLandscape) return null;
  const fontSize = responsiveCompact ? 14 : 20;
  const lineHeight = responsiveCompact ? 16 : 22;
  return { fontSize: fontSize * 1.1, lineHeight: lineHeight * 1.1 };
}

const styles = StyleSheet.create({
  positioner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 90,
    elevation: 90,
  },
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
