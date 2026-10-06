import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PlayerIcon } from '../../customization';
import { VerticalSliderCard } from './VerticalSliderCard';
import {
  getVerticalSliderMetrics,
  getVerticalSliderPositionStyle,
  useVerticalSliderModel,
} from './verticalSliderUtils';

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;
const PERCENT_RANGE = 100;

function toVolumePercent(value) {
  return value;
}

function toVolumeValue(percent) {
  return percent;
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return MAX_PERCENT;
  // If passed as 0..1 ratio, convert to 0..100
  let normalized = Math.round(number);
  if (number <= 1 && number > 0) normalized = Math.round(number * 100);
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
  const metrics = getVerticalSliderMetrics({ availableHeight, compact, topInset, bottomInset });
  const { measuredHeight, responsiveCompact, safeTopInset, safeBottomInset, cardHeight, trackHeight } = metrics;
  const slider = useVerticalSliderModel({
    value,
    onChange,
    onChangeEnd,
    clampPercent,
    toPercent: toVolumePercent,
    toValue: toVolumeValue,
    percentRange: { range: PERCENT_RANGE, trackHeight },
  });
  const { displayPercent, responder, adjustByKeyboard } = slider;
  const fillRatio = (displayPercent - MIN_PERCENT) / PERCENT_RANGE;
  const thumbTop = `${(1 - fillRatio) * 100}%`;
  const fillHeight = `${fillRatio * 100}%`;
  const safeRightInset = Number.isFinite(Number(rightInset)) ? Number(rightInset) : 10;
  const positionerStyle = getVerticalSliderPositionStyle({
    measuredHeight,
    safeTopInset,
    safeBottomInset,
    alignTop,
    horizontalInset: safeRightInset,
    insetSide: 'right',
  });
  if (measuredHeight > 0 && cardHeight < 44) {
    return <View pointerEvents="box-none" style={[styles.positioner, positionerStyle]} />;
  }
  let volumeIcon = 'volume-high';
  if (displayPercent === 0) volumeIcon = 'volume-mute';
  else if (displayPercent < 50) volumeIcon = 'volume-medium';

  const leadingContent = (
    <View style={styles.iconWrap}>
      <PlayerIcon
        name={volumeIcon}
        size={getVolumeIconSize(responsiveCompact, fullscreenLandscape)}
        color={accentColor}
      />
    </View>
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
      alignItems="flex-end"
      cardHeight={cardHeight}
      responsiveCompact={responsiveCompact}
      leadingContent={leadingContent}
      responder={responder}
      accessibilityLabel="Device sound volume"
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

function getVolumeIconSize(responsiveCompact, fullscreenLandscape) {
  const baseSize = responsiveCompact ? 16 : 20;
  return baseSize * (fullscreenLandscape ? 1.1 : 1);
}

const styles = StyleSheet.create({
  positioner: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 90,
    elevation: 90,
  },
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
