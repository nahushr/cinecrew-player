import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { isElectron, isWeb } from '../../utils/runtimePlatform';
import { PlayerIcon } from '../customization';

const REC_RED = '#FF5252';
const DEFAULT_DARK_PALETTE = {
  mode: 'dark', primary: '#00E5FF', outline: 'rgba(255,255,255,0.14)',
  surface: '#12161C', surfaceHighlight: '#262B33',
  onSurfacePrimary: '#FFFFFF', onSurfaceSecondary: 'rgba(255,255,255,0.68)',
};

function formatRecElapsed(elapsedMs = 0) {
  const totalSeconds = Math.max(0, Math.floor(Number(elapsedMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function resolveTheme(colors) {
  const palette = colors?.onSurfacePrimary ? colors : DEFAULT_DARK_PALETTE;
  const isLight = palette.mode === 'light';
  return {
    isLight,
    barBg: isLight ? 'rgba(255,255,255,0.94)' : 'rgba(18,22,28,0.92)',
    border: isLight ? palette.outline : 'rgba(255,82,82,0.45)',
    text: palette.onSurfacePrimary,
    muted: palette.onSurfaceSecondary,
    btnBg: isLight ? palette.surfaceHighlight : 'rgba(255,255,255,0.08)',
    stopBg: isLight ? 'rgba(255,82,82,0.12)' : 'rgba(255,82,82,0.22)',
    noticeBg: isLight ? palette.surface : 'rgba(18,22,28,0.94)',
    noticeBorder: palette.outline,
    primary: palette.primary,
  };
}

function RecDot({ paused }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (paused) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.25,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [paused, pulse]);

  return (
    <Animated.View
      style={[
        styles.dot,
        { opacity: pulse, transform: [{ scale: pulse.interpolate({ inputRange: [0.25, 1], outputRange: [0.75, 1] }) }] },
      ]}
    />
  );
}

export function LiveRecordingOverlay({
  status,
  elapsedMs,
  colors,
  topInset = 12,
  showTransport = true,
  onPause,
  onResume,
  onStop,
}) {
  if (status !== 'recording' && status !== 'paused') return null;

  const theme = resolveTheme(colors);
  const paused = status === 'paused';

  return (
    <View
      pointerEvents="auto"
      style={[styles.wrap, { top: Math.max(topInset, 10) }]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.barBg,
            borderColor: paused ? theme.border : REC_RED,
          },
        ]}
      >
        <View style={styles.recLabel}>
          <RecDot paused={paused} />
          <Text style={[styles.recText, { color: REC_RED }]}>
            {paused ? 'PAUSED' : 'REC'}
          </Text>
          <Text style={[styles.timeText, { color: theme.text }]}>
            {formatRecElapsed(elapsedMs)}
          </Text>
        </View>

        {showTransport ? (
          <View style={styles.transport}>
            <TouchableOpacity
              style={[styles.roundBtn, { backgroundColor: theme.btnBg }]}
              onPress={(e) => {
                e?.stopPropagation?.();
                if (paused) onResume?.();
                else onPause?.();
              }}
              hitSlop={10}
              accessibilityLabel={paused ? 'Resume recording' : 'Pause recording'}
            >
              <PlayerIcon
                name={paused ? 'play' : 'pause'}
                size={16}
                color={theme.text}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roundBtn, { backgroundColor: theme.stopBg }]}
              onPress={(e) => {
                e?.stopPropagation?.();
                onStop?.();
              }}
              hitSlop={10}
              accessibilityLabel="Stop recording"
            >
              <PlayerIcon name="stop" size={16} color={REC_RED} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function LiveRecordingNotice({ notice, colors, onDismiss }) {
  if (!notice) return null;
  const theme = resolveTheme(colors);
  const isError = notice.type === 'error';
  let iconName = 'check-circle-outline';
  if (isError) iconName = 'alert-circle-outline';
  else if (notice.type === 'info') iconName = 'information-outline';
  const accent = isError ? REC_RED : theme.primary;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onDismiss}
      style={[
        styles.notice,
        {
          backgroundColor: theme.noticeBg,
          borderColor: isError ? REC_RED : theme.primary,
        },
      ]}
    >
      <PlayerIcon
        name={iconName}
        size={18}
        color={accent}
      />
      <Text style={[styles.noticeText, { color: theme.text }]} numberOfLines={2}>
        {notice.message}
      </Text>
      <PlayerIcon name="close" size={16} color={theme.muted} />
    </TouchableOpacity>
  );
}

export function PipRecordingBadge({ status, elapsedMs }) {
  if (status !== 'recording' && status !== 'paused') return null;
  return (
    <View style={[styles.pipRec, status === 'paused' && styles.pipRecPaused]}>
      <View style={styles.pipDot} />
      <Text style={styles.pipRecText}>
        {status === 'paused' ? 'PAUSED' : `REC ${formatRecElapsed(elapsedMs)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    ...(isWeb() || isElectron() ? {} : { elevation: 1000 }),
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
    ...(isWeb() || isElectron()
      ? {
        boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
      }
      : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 8,
      }),
  },
  recLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: REC_RED,
  },
  recText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    minWidth: 42,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roundBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 28,
    zIndex: 90,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    ...(isWeb() || isElectron()
      ? {
        boxShadow: '0 8px 22px rgba(0,0,0,0.28)',
      }
      : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
      }),
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  pipRec: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: REC_RED,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    gap: 3,
  },
  pipRecPaused: {
    backgroundColor: '#C77700',
  },
  pipDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF',
  },
  pipRecText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
