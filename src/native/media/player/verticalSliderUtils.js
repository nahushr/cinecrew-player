import { PanResponder } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function getVerticalSliderMetrics({ availableHeight, compact, topInset, bottomInset }) {
  const measuredHeight = Number(availableHeight);
  const responsiveCompact = Boolean(compact || (measuredHeight > 0 && measuredHeight < 280));
  const safeTopInset = Math.max(0, Number(topInset) || 0);
  const safeBottomInset = Math.max(0, Number(bottomInset) || 0);
  let freeHeight = 0;
  if (measuredHeight > 0) {
    freeHeight = Math.max(0, measuredHeight - safeTopInset - safeBottomInset - 6);
  }
  const preferredCardHeight = responsiveCompact ? 144 : 188;
  const cardHeight = measuredHeight > 0 ? Math.min(preferredCardHeight, freeHeight) : preferredCardHeight;
  const compactTrack = responsiveCompact ? 84 : 120;
  const reservedTrackSpace = responsiveCompact ? 38 : 56;
  const trackHeight = Math.max(12, Math.min(compactTrack, cardHeight - reservedTrackSpace));
  return {
    measuredHeight,
    responsiveCompact,
    safeTopInset,
    safeBottomInset,
    cardHeight,
    trackHeight,
  };
}

export function createVerticalSliderResponder({
  trackHeight,
  percentRange,
  isDraggingRef,
  dragStartPercentRef,
  percentRef,
  setActivePercent,
  clampPercent,
  publishPercent,
  finishInteraction,
}) {
  const getGesturePercent = (gesture) => clampPercent(Math.round(
    dragStartPercentRef.current - (gesture.dy / trackHeight) * percentRange,
  ));

  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      isDraggingRef.current = true;
      dragStartPercentRef.current = percentRef.current;
    },
    onPanResponderMove: (_event, gesture) => {
      const next = getGesturePercent(gesture);
      setActivePercent(next);
      publishPercent(next);
    },
    onPanResponderRelease: (_event, gesture) => {
      isDraggingRef.current = false;
      const next = getGesturePercent(gesture);
      setActivePercent(next);
      finishInteraction(next);
    },
    onPanResponderTerminate: (_event, gesture) => {
      isDraggingRef.current = false;
      const next = getGesturePercent(gesture);
      setActivePercent(next);
      finishInteraction(next);
    },
  });
}

export function useVerticalSliderModel({ value, onChange, onChangeEnd, clampPercent, toPercent, toValue, percentRange }) {
  const percent = clampPercent(toPercent(value));
  const [activePercent, setActivePercent] = useState(percent);
  const isDraggingRef = useRef(false);
  const percentRef = useRef(percent);
  const dragStartPercentRef = useRef(percent);
  const changeRef = useRef(onChange);
  const changeEndRef = useRef(onChangeEnd);

  useEffect(() => {
    if (isDraggingRef.current) return;
    setActivePercent(percent);
    percentRef.current = percent;
  }, [percent]);

  changeRef.current = onChange;
  changeEndRef.current = onChangeEnd;

  const publishPercent = useCallback((nextPercent) => {
    const next = clampPercent(Math.round(nextPercent));
    percentRef.current = next;
    changeRef.current?.(toValue(next));
    return next;
  }, [clampPercent, toValue]);

  const finishInteraction = useCallback((finalPercent = percentRef.current) => {
    const next = publishPercent(Math.round(finalPercent));
    changeEndRef.current?.(Math.round(next));
  }, [publishPercent]);

  const responder = useMemo(() => createVerticalSliderResponder({
    trackHeight: percentRange.trackHeight,
    percentRange: percentRange.range,
    isDraggingRef,
    dragStartPercentRef,
    percentRef,
    setActivePercent,
    clampPercent,
    publishPercent,
    finishInteraction,
  }), [clampPercent, finishInteraction, percentRange.range, percentRange.trackHeight, publishPercent]);

  const adjustByKeyboard = useCallback((event) => {
    const direction = event?.nativeEvent?.actionName === 'increment' ? 1 : -1;
    const next = clampPercent(percentRef.current + (direction * 5));
    setActivePercent(next);
    finishInteraction(next);
  }, [clampPercent, finishInteraction]);

  return {
    activePercent,
    adjustByKeyboard,
    displayPercent: isDraggingRef.current ? activePercent : percent,
    percent,
    responder,
  };
}

export function getVerticalSliderPositionStyle({
  measuredHeight,
  safeTopInset,
  safeBottomInset,
  alignTop,
  horizontalInset,
  insetSide,
}) {
  let measuredPositionStyle = null;
  if (measuredHeight > 0) {
    const topAdjustment = alignTop ? 0 : 3;
    const verticalAlignment = alignTop ? 'flex-start' : 'center';
    measuredPositionStyle = {
      top: safeTopInset + topAdjustment,
      bottom: safeBottomInset + 3,
      justifyContent: verticalAlignment,
    };
  }

  const insetProperty = insetSide === 'left' ? 'paddingLeft' : 'paddingRight';
  return [measuredPositionStyle, { [insetProperty]: horizontalInset }];
}
