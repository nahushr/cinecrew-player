import React from 'react';
import { StyleSheet } from 'react-native';

export default function Slider({
  minimumValue = 0,
  maximumValue = 1,
  step = 0,
  value,
  disabled,
  style,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
  testID,
  accessibilityLabel,
  accessibilityValue,
  onSlidingStart,
  onAccessibilityAction,
  onValueChange,
  onSlidingComplete,
  ...props
}) {
  const reportValue = (event) => onValueChange?.(Number(event.currentTarget.value));
  return (
    <input
      {...props}
      type="range"
      aria-label={accessibilityLabel}
      aria-valuetext={accessibilityValue?.text}
      data-testid={testID}
      min={minimumValue}
      max={maximumValue}
      step={step || 'any'}
      value={Number.isFinite(Number(value)) ? Number(value) : minimumValue}
      disabled={disabled}
      onChange={reportValue}
      onPointerDown={(event) => onSlidingStart?.(Number(event.currentTarget.value))}
      onPointerUp={(event) => onSlidingComplete?.(Number(event.currentTarget.value))}
      onTouchEnd={(event) => onSlidingComplete?.(Number(event.currentTarget.value))}
      style={{
        ...StyleSheet.flatten(style),
        width: '100%',
        accentColor: thumbTintColor || minimumTrackTintColor || maximumTrackTintColor || '#00e5ff',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    />
  );
}
