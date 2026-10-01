import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder } from 'react-native';
import { isElectron, isWeb } from '../../../utils/runtimePlatform';
import { getWebPoint, isSafariOrIOS } from './playerConstants';
import { handlePinchMove, handleVerticalGestureMove } from './playerUtils';

/** Owns pointer, touch, keyboard, trackpad, and native swipe interactions. */
export function useMediaPlayerGestures({
  windowWidth,
  windowHeight,
  visible,
  showControls,
  drawerOpen = false,
  isPlaying,
  isInlinePreview,
  onInlinePreviewWheel,
  playerRef,
  isLockedRef,
  mutedRef,
  volumeRef,
  brightnessRef,
  zoomScaleRef,
  zoomBadgeTimer,
  setZoomScale,
  setZoomBadgeText,
  setShowControls,
  commitBrightness,
  commitVolume,
  commitBrightnessRef,
  commitVolumeRef,
  handleSeekByAction,
  triggerSeekRipple,
  togglePlayPause,
  toggleControls,
  scheduleHide
}) {
  const gestureStartXRef = useRef(0);
  const gestureStartYRef = useRef(0);
  const gestureSideRef = useRef(null);
  const gestureStartValRef = useRef(0);
  const isSwipingRef = useRef(false);
  const webTouchStartRef = useRef(null);
  const initialDistanceRef = useRef(0);
  const initialScaleRef = useRef(1);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0, side: null });
  const singleTapTimerRef = useRef(null);
  const touchHandledRef = useRef(false);

  const windowWidthRef = useRef(windowWidth);
  windowWidthRef.current = windowWidth;
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;
  const showControlsRef = useRef(false);
  showControlsRef.current = showControls;
  const drawerOpenRef = useRef(false);
  drawerOpenRef.current = drawerOpen;
  const handleSeekByRef = useRef(handleSeekByAction);
  handleSeekByRef.current = handleSeekByAction;
  const triggerSeekRippleRef = useRef(triggerSeekRipple);
  triggerSeekRippleRef.current = triggerSeekRipple;
  const togglePlayPauseRef = useRef(togglePlayPause);
  togglePlayPauseRef.current = togglePlayPause;
  const toggleControlsRef = useRef(toggleControls);
  toggleControlsRef.current = toggleControls;
  const scheduleHideRef = useRef(scheduleHide);
  scheduleHideRef.current = scheduleHide;

  const handleTap = useCallback(
    (pageX, pageY) => {
      if (isLockedRef.current) {
        setShowControls((previous) => {
          const next = !previous;
          if (next && isPlaying) scheduleHideRef.current();
          return next;
        });
        return;
      }

      const now = Date.now();
      const previousTap = lastTapRef.current;
      const elapsed = now - previousTap.time;
      const width = windowWidthRef.current || 400;
      let side = 'center';
      if (pageX < width * 0.4) side = 'left';
      else if (pageX > width * 0.6) side = 'right';

      const isDoubleTap = elapsed > 50 && elapsed < 320 && previousTap.side === side;
      if (isDoubleTap) {
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        lastTapRef.current = { time: 0, x: 0, y: 0, side: null };
        if (side === 'left') {
          handleSeekByRef.current(-10);
          triggerSeekRippleRef.current('left', '-10s');
        } else if (side === 'right') {
          handleSeekByRef.current(10);
          triggerSeekRippleRef.current('right', '+10s');
        } else {
          togglePlayPauseRef.current();
        }
        return;
      }

      lastTapRef.current = { time: now, x: pageX, y: pageY, side };
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        toggleControlsRef.current();
        singleTapTimerRef.current = null;
        lastTapRef.current = { time: 0, x: 0, y: 0, side: null };
      }, 260);
    },
    [isPlaying, isLockedRef, setShowControls]
  );

  const panResponder = useMemo(() => {
    if (isWeb() || isElectron()) return null;

    const isSeekScrubGesture = (event) => {
      if (!showControlsRef.current) return false;
      const height = windowHeightRef.current || 0;
      const y = Number(event?.nativeEvent?.locationY);
      if (height <= 0 || !Number.isFinite(y)) return false;
      return y >= height - Math.max(180, height * 0.14);
    };

    return PanResponder.create({
      // The player-level responder handles taps/swipes on the video surface.
      // When a drawer is open, let its FlatList/ScrollView own the gesture;
      // otherwise the parent can claim the touch before a list starts scrolling.
      onStartShouldSetPanResponder: (event) => !drawerOpenRef.current && !(showControlsRef.current && !isLockedRef.current) && !isSeekScrubGesture(event),
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (event, gestureState) => {
        if (drawerOpenRef.current) return false;
        if (showControlsRef.current && !isLockedRef.current) return false;
        if (isSeekScrubGesture(event)) return false;
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches;
        if (touches?.length === 2) {
          const [first, second] = touches;
          initialDistanceRef.current = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
          initialScaleRef.current = zoomScaleRef.current;
          isSwipingRef.current = false;
        } else if (touches?.length === 1) {
          initialDistanceRef.current = 0;
          const touch = touches[0];
          gestureStartXRef.current = touch.pageX;
          gestureStartYRef.current = touch.pageY;
          const isLeft = touch.pageX < windowWidthRef.current * 0.5;
          const currentVolume = mutedRef.current ? 0 : volumeRef.current;
          gestureSideRef.current = isLeft ? 'brightness' : 'volume';
          gestureStartValRef.current = isLeft ? brightnessRef.current : currentVolume;
          isSwipingRef.current = false;
        } else {
          initialDistanceRef.current = 0;
          isSwipingRef.current = false;
        }
      },
      onPanResponderMove: (event) => {
        const touches = event.nativeEvent.touches;
        if (
          handlePinchMove(touches, {
            initialDistance: initialDistanceRef,
            initialScale: initialScaleRef,
            scale: zoomScaleRef,
            setScale: setZoomScale,
            setBadge: setZoomBadgeText,
            badgeTimer: zoomBadgeTimer
          })
        )
          return;

        handleVerticalGestureMove(touches, {
          isLocked: isLockedRef,
          startY: gestureStartYRef,
          startX: gestureStartXRef,
          isSwiping: isSwipingRef,
          windowHeight: windowHeightRef,
          side: gestureSideRef,
          startValue: gestureStartValRef,
          commitBrightness: commitBrightnessRef,
          commitVolume: commitVolumeRef
        });
      },
      onPanResponderTerminate: () => {
        initialDistanceRef.current = 0;
        isSwipingRef.current = false;
      },
      onPanResponderRelease: (event, gestureState) => {
        const touches = event.nativeEvent?.touches;
        if (initialDistanceRef.current > 0) {
          initialDistanceRef.current = 0;
          return;
        }
        if (touches?.length > 0) return;
        if (isSwipingRef.current) {
          isSwipingRef.current = false;
          return;
        }
        if (Math.abs(gestureState.dx) > 15 || Math.abs(gestureState.dy) > 15) return;
        const pageX = event.nativeEvent?.pageX ?? gestureStartXRef.current ?? gestureState.x0 ?? 0;
        const pageY = event.nativeEvent?.pageY ?? gestureStartYRef.current ?? gestureState.y0 ?? 0;
        handleTap(pageX, pageY);
      }
    });
  }, []);

  const handleWebTouchStart = useCallback(
    (event) => {
      const point = getWebPoint(event);
      if (!point) return;
      touchHandledRef.current = true;
      if (isLockedRef.current) {
        webTouchStartRef.current = {
          x: point.x,
          y: point.y,
          side: 'center',
          startVal: 0,
          dragged: false
        };
        return;
      }
      const isLeft = point.x < windowWidthRef.current * 0.5;
      if (!isLeft && isSafariOrIOS()) {
        webTouchStartRef.current = {
          x: point.x,
          y: point.y,
          side: 'none',
          startVal: 0,
          dragged: false
        };
        return;
      }
      const currentVolume = mutedRef.current ? 0 : volumeRef.current;
      webTouchStartRef.current = {
        x: point.x,
        y: point.y,
        side: isLeft ? 'brightness' : 'volume',
        startVal: isLeft ? brightnessRef.current : currentVolume,
        dragged: false
      };
    },
    [isLockedRef, mutedRef, volumeRef, brightnessRef]
  );

  const handleWebTouchMove = useCallback(
    (event) => {
      if (isLockedRef.current) return;
      const point = getWebPoint(event);
      const state = webTouchStartRef.current;
      if (!point || !state) return;
      const dy = state.y - point.y;
      const dx = Math.abs(point.x - state.x);
      if (!state.dragged && (Math.abs(dy) > 8 || dx > 8)) state.dragged = true;
      if (!state.dragged) return;
      if (typeof event.preventDefault === 'function') event.preventDefault();
      const dragHeight = Math.max(180, (windowHeightRef.current || 400) * 0.55);
      const deltaPercent = (dy / dragHeight) * 100;
      if (state.side === 'brightness') {
        const next = Math.max(0.1, Math.min(1, Number(((state.startVal * 100 + deltaPercent) / 100).toFixed(2))));
        commitBrightness(next);
      } else {
        commitVolume(Math.max(0, Math.min(100, Math.round(state.startVal + deltaPercent))));
      }
    },
    [commitBrightness, commitVolume, isLockedRef]
  );

  const handleWebTouchEnd = useCallback(() => {
    const state = webTouchStartRef.current;
    webTouchStartRef.current = null;
    if (state && !state.dragged) handleTap(state.x, state.y);
    setTimeout(() => {
      touchHandledRef.current = false;
    }, 400);
  }, [handleTap]);

  const handleWebPointerDown = useCallback(
    (event) => {
      if (event.button !== null && event.button !== 0) return;
      handleWebTouchStart(event);
    },
    [handleWebTouchStart]
  );
  const handleWebPointerMove = useCallback(
    (event) => {
      if (webTouchStartRef.current) handleWebTouchMove(event);
    },
    [handleWebTouchMove]
  );
  const handleWebPointerUp = useCallback(() => handleWebTouchEnd(), [handleWebTouchEnd]);

  const handleWebMouseDown = useCallback(
    (event) => {
      if (touchHandledRef.current) return;
      const point = getWebPoint(event);
      if (!point) return;
      if (isLockedRef.current) {
        const onLockedMouseUp = () => {
          window.removeEventListener('mouseup', onLockedMouseUp);
          handleTap(point.x, point.y);
        };
        window.addEventListener('mouseup', onLockedMouseUp);
        return;
      }
      const startX = point.x;
      const startY = point.y;
      const isLeft = startX < windowWidthRef.current * 0.5;
      if (!isLeft && isSafariOrIOS()) {
        const onMouseUp = () => {
          window.removeEventListener('mouseup', onMouseUp);
          if (!touchHandledRef.current) handleTap(startX, startY);
        };
        window.addEventListener('mouseup', onMouseUp);
        return;
      }
      const side = isLeft ? 'brightness' : 'volume';
      const currentVolume = mutedRef.current ? 0 : volumeRef.current;
      const startVal = isLeft ? brightnessRef.current : currentVolume;
      let hasDragged = false;
      const onMouseMove = (moveEvent) => {
        const dy = startY - moveEvent.clientY;
        const dx = Math.abs(moveEvent.clientX - startX);
        if (!hasDragged && (Math.abs(dy) > 6 || dx > 6)) hasDragged = true;
        if (!hasDragged) return;
        const dragHeight = Math.max(180, (windowHeightRef.current || 400) * 0.55);
        const deltaPercent = (dy / dragHeight) * 100;
        if (side === 'brightness') {
          commitBrightness(Math.max(0.1, Math.min(1, Number(((startVal * 100 + deltaPercent) / 100).toFixed(2)))));
        } else {
          commitVolume(Math.max(0, Math.min(100, Math.round(startVal + deltaPercent))));
        }
      };
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (touchHandledRef.current) return;
        if (!hasDragged) handleTap(startX, startY);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [handleTap, commitBrightness, commitVolume, isLockedRef, mutedRef, volumeRef, brightnessRef]
  );

  useEffect(() => {
    if (!isWeb() || !visible) return undefined;
    const handleKeyDown = (event) => {
      if (['INPUT', 'TEXTAREA'].includes(event.target.tagName) || isLockedRef.current) return;
      if (event.key === 'ArrowRight') {
        handleSeekByRef.current(10);
        triggerSeekRippleRef.current('right', '+10s');
        event.preventDefault();
      } else if (event.key === 'ArrowLeft') {
        handleSeekByRef.current(-10);
        triggerSeekRippleRef.current('left', '-10s');
        event.preventDefault();
      } else if (event.key === 'ArrowUp') {
        commitVolume(volumeRef.current + 5);
        event.preventDefault();
      } else if (event.key === 'ArrowDown') {
        commitVolume(volumeRef.current - 5);
        event.preventDefault();
      } else if (event.key === ' ') {
        togglePlayPauseRef.current();
        event.preventDefault();
      }
    };
    const handleWheel = (event) => {
      if (isInlinePreview) {
        if (typeof onInlinePreviewWheel === 'function') {
          event.preventDefault();
          onInlinePreviewWheel(event.deltaY);
        }
        return;
      }
      if (event.ctrlKey) {
        event.preventDefault();
        setZoomScale((previous) => {
          const next = Math.max(0.25, Math.min(4, previous - event.deltaY * 0.01));
          zoomScaleRef.current = next;
          setZoomBadgeText(`${Math.round(next * 100)}% Zoom`);
          if (zoomBadgeTimer.current) clearTimeout(zoomBadgeTimer.current);
          zoomBadgeTimer.current = setTimeout(() => setZoomBadgeText(''), 1500);
          return next;
        });
        return;
      }
      if (isLockedRef.current) return;
      const isLeft = event.clientX < windowWidthRef.current * 0.5;
      const step = -event.deltaY > 0 ? 5 : -5;
      if (isLeft) commitBrightness(brightnessRef.current + step / 100);
      else commitVolume(volumeRef.current + step);
    };

    if (typeof document !== 'undefined') document.addEventListener('keydown', handleKeyDown);
    const node = playerRef.current;
    node?.addEventListener?.('wheel', handleWheel, { passive: false });
    return () => {
      if (typeof document !== 'undefined') document.removeEventListener('keydown', handleKeyDown);
      node?.removeEventListener?.('wheel', handleWheel);
    };
  }, [visible, commitBrightness, commitVolume, isInlinePreview, onInlinePreviewWheel]);

  return {
    panResponder,
    handleWebPointerDown,
    handleWebPointerMove,
    handleWebPointerUp,
    handleWebMouseDown,
    handleWebTouchStart,
    handleWebTouchMove,
    handleWebTouchEnd
  };
}
