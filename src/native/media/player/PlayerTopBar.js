import { forwardRef, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { isAndroid, isIOS, isElectronOverlay } from '../../../utils/runtimePlatform';
import { cleanPlayerTitle } from '../../../utils/mediaUtils';
import { PlayerIcon, usePlayerColors } from '../../customization';

function controlButtonSize(compact, scale) {
  const boost = scale?.buttonBoost || 1;
  if (boost <= 1) return null;
  const size = Math.round((compact ? 30 : 38) * boost);
  return { width: size, height: size, borderRadius: size / 2 };
}

function shouldShowEpisodeSubtitle(isMobile, episodeLabel, displayTitle) {
  if (isMobile || !episodeLabel) return false;
  const episode = episodeLabel.trim().toLowerCase();
  const title = displayTitle.toLowerCase();
  return Boolean(episode && title !== episode && !title.includes(episode));
}

function BackButton({ visible, palette, onClose, compact, scale }) {
  if (!visible) return <View style={{ width: 12 }} />;
  const iconBoost = scale?.iconBoost || 1;
  const buttonBoost = scale?.buttonBoost || 1;
  const buttonHeight = Math.round((compact ? 30 : 38) * buttonBoost);
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        styles.backPill,
        compact && styles.compactPill,
        {
          width: Math.round((compact ? 74 : 84) * buttonBoost),
          height: buttonHeight,
          borderRadius: buttonHeight / 2,
        },
      ]}
      onPress={(event) => { event.stopPropagation(); onClose(); }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <PlayerIcon name="arrow-left" size={Math.round((compact ? 18 : 20) * iconBoost)} color={palette.controlColor} />
      <Text style={[styles.backText, { color: palette.controlColor, fontSize: scale?.backFont || (compact ? 12 : 14) }]}>Back</Text>
    </TouchableOpacity>
  );
}

function RecordingControls({ canRecord, enabled, status, loading, controls, onStart, onResume, onPause, onStop, palette, compact, scale }) {
  if (!canRecord || controls.recording === false || enabled === false) return null;
  const iconBoost = scale?.iconBoost || 1;
  if (status === 'idle') {
    return (
      <TouchableOpacity style={[styles.pill, compact && styles.compactPill, controlButtonSize(compact, scale), loading && { opacity: 0.45 }]} onPress={onStart} hitSlop={12} disabled={loading} accessibilityLabel="Start recording">
        <PlayerIcon name="record-rec" size={Math.round((compact ? 18 : 22) * iconBoost)} color={palette.errorColor} />
      </TouchableOpacity>
    );
  }
  const isPaused = status === 'paused';
  return (
    <>
      <TouchableOpacity style={[styles.pill, compact && styles.compactPill, controlButtonSize(compact, scale), isPaused ? styles.recPausePill : styles.recActivePill]} onPress={isPaused ? onResume : onPause} hitSlop={12} accessibilityLabel={isPaused ? 'Resume recording' : 'Pause recording'}>
        <PlayerIcon name={isPaused ? 'play' : 'pause'} size={Math.round((compact ? 18 : 20) * iconBoost)} color={palette.controlColor} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.pill, compact && styles.compactPill, controlButtonSize(compact, scale), styles.recStopPill]} onPress={onStop} hitSlop={12} accessibilityLabel="Stop recording">
        <PlayerIcon name="stop" size={Math.round((compact ? 18 : 20) * iconBoost)} color={palette.errorColor} />
      </TouchableOpacity>
    </>
  );
}

function ServiceActionButton({ name, tab, enabled, controls, showLiveChat, drawerTab, onToggle, activeIcon, inactiveIcon, label, palette, compact, scale }) {
  if (!enabled || controls[name] === false) return null;
  const active = showLiveChat && drawerTab === tab;
  const iconBoost = scale?.iconBoost || 1;
  return (
    <TouchableOpacity
      key={tab}
      style={[
        styles.pill,
        compact && styles.compactPill,
        controlButtonSize(compact, scale),
        active && {
          backgroundColor: 'rgba(0, 229, 255, 0.12)',
          borderColor: palette.accentColor,
          borderWidth: 1,
        },
      ]}
      onPress={(event) => { event.stopPropagation(); onToggle(tab); }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <PlayerIcon
        name={active ? activeIcon : inactiveIcon}
        size={Math.round((compact ? 18 : 20) * iconBoost)}
        color={active ? palette.accentColor : palette.controlColor}
      />
    </TouchableOpacity>
  );
}

function SessionActionButton({ visible, compact, onPress, icon, color, accessibilityLabel, scale }) {
  if (!visible) return null;
  const iconBoost = scale?.iconBoost || 1;
  return (
    <TouchableOpacity
      style={[styles.pill, compact && styles.compactPill, controlButtonSize(compact, scale)]}
      onPress={(event) => { event.stopPropagation(); onPress(); }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <PlayerIcon name={icon} size={Math.round((compact ? 18 : 20) * iconBoost)} color={color} />
    </TouchableOpacity>
  );
}

export const PlayerLockButton = forwardRef(function PlayerLockButton(
  { locked = false, onPress, onLayout, compact = false, style, scale },
  ref,
) {
  const palette = usePlayerColors();
  const iconBoost = scale?.iconBoost || 1;
  const stateStyle = {
    backgroundColor: palette.controlBackground,
    borderWidth: 1,
    borderColor: locked ? palette.accentColor : 'transparent',
  };
  return (
    <TouchableOpacity
      ref={ref}
      style={[styles.pill, compact && styles.compactPill, controlButtonSize(compact, scale), stateStyle, style]}
      onLayout={onLayout}
      onPress={(event) => { event.stopPropagation(); onPress?.(); }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={locked ? 'Unlock controls' : 'Lock player controls'}
      accessibilityState={{ selected: locked }}
    >
      <PlayerIcon
        name={locked ? 'lock' : 'lock-open-variant'}
        size={Math.round((compact ? 18 : 20) * iconBoost)}
        color={locked ? palette.accentColor : palette.controlColor}
      />
    </TouchableOpacity>
  );
});

function PlayerTitle({ isPortrait, compact, displayTitle, episodeLabel, showEpisodeSubtitle, palette, scale }) {
  if (isPortrait || compact) return null;
  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleRow}>
        <Text style={[styles.titleText, { color: palette.controlColor, fontSize: scale?.titleFont, fontWeight: scale?.titleWeight }]} numberOfLines={1}>{displayTitle}</Text>
      </View>
      {showEpisodeSubtitle ? <Text style={[styles.episodeLabelText, { color: palette.mutedColor, fontSize: scale?.backFont }]} numberOfLines={1}>{episodeLabel}</Text> : null}
    </View>
  );
}

function PortraitPlayerTitle({ isPortrait, compact, displayTitle, episodeLabel, showEpisodeSubtitle, palette, scale }) {
  if (!isPortrait || compact) return null;
  return (
    <View style={styles.portraitTitleBlock}>
      <Text style={[styles.titleText, styles.portraitTitleText, { color: palette.controlColor, fontSize: scale?.titleFont, fontWeight: scale?.titleWeight }]} numberOfLines={2}>{displayTitle}</Text>
      {showEpisodeSubtitle ? <Text style={[styles.episodeLabelText, styles.portraitEpisodeLabel, { color: palette.mutedColor, fontSize: scale?.backFont }]} numberOfLines={1}>{episodeLabel}</Text> : null}
    </View>
  );
}

function CompactLandscapeTitle({ compact, displayTitle, palette, scale }) {
  if (!compact) return null;
  const fontSize = scale?.titleFont ? Math.min(scale.titleFont, 14) : 12;
  return (
    <Text style={[styles.compactLandscapeTitle, { color: palette.controlColor, fontSize }]} numberOfLines={1}>
      {displayTitle}
    </Text>
  );
}

export const PlayerTopBar = ({
  insets,
  scale,
  title,
  episodeLabel,
  isLive,
  isScreenRecorderEnabled,
  canRecord,
  recStatus,
  isLoading,
  showLiveChat,
  drawerTab,
  isLiveCommentsEnabled,
  isEpgEnabled,
  diagnosticsOverlayEnabled,
  muted,
  onClose,
  onStartRecording,
  onResumeRecording,
  onPauseRecording,
  onStopRecording,
  onToggleChatTab,
  onRestart,
  onToggleMute,
  onToggleLock,
  controls = {},
  locked = false,
  isFullscreen = false,
  playerIsPortrait,
  compact = false,
  isPlaying = false,
  paused = true,
  onPlayerLayout,
  onHeaderLayout,
}) => {
  const topBarRef = useRef(null);
  const landscapeTopOffsetRef = useRef(0);
  const [landscapeTopOffset, setLandscapeTopOffset] = useState(0);
  const { width, height } = useWindowDimensions();
  const palette = usePlayerColors();
  const isPortrait = playerIsPortrait ?? (height >= width);
  const isMobile = isAndroid() || isIOS() || Math.min(width, height) < 600;
  const electronFullscreen = isFullscreen && isElectronOverlay();
  const compactAndroidLandscape = compact && isAndroid();
  const compactImmersiveAndroid = compactAndroidLandscape && isFullscreen;
  const shouldShowLandscapeTitle = !isPortrait && Boolean(paused);

  const alignCompactLandscapeTopBar = () => {
    if (!compact) {
      if (landscapeTopOffsetRef.current !== 0) {
        landscapeTopOffsetRef.current = 0;
        setLandscapeTopOffset(0);
      }
      return;
    }

    topBarRef.current?.measureInWindow?.((_x, windowY) => {
      // The native fullscreen host can start above the app's safe-area origin
      // after rotation. Move only the top controls back into the visible player
      // region; the video surface, center controls, and seek bar stay untouched.
      const baseWindowY = windowY - landscapeTopOffsetRef.current;
      const safeTop = compactImmersiveAndroid ? 4 : Math.max(insets?.top || 0, 8);
      const nextOffset = Math.max(0, safeTop - baseWindowY);
      if (Math.abs(nextOffset - landscapeTopOffsetRef.current) > 1) {
        landscapeTopOffsetRef.current = nextOffset;
        setLandscapeTopOffset(nextOffset);
      }
    });
  };

  const displayTitle = useMemo(() => {
    return cleanPlayerTitle(title, episodeLabel, isMobile);
  }, [title, episodeLabel, isMobile]);

  const showEpisodeSubtitle = useMemo(
    () => shouldShowEpisodeSubtitle(isMobile, episodeLabel, displayTitle),
    [isMobile, episodeLabel, displayTitle],
  );

  return (
    <View
      style={[
        styles.topBar,
        isPortrait && styles.portraitTopBar,
        compact && styles.compactLandscapeTopBar,
        compact && { top: landscapeTopOffset },
        {
          paddingTop: electronFullscreen ? 8 : compactImmersiveAndroid ? 4 : isFullscreen ? Math.max(insets?.top || 0, 24) : 8,
          paddingHorizontal: electronFullscreen ? 8 : (isFullscreen || !isPortrait) ? Math.max(insets?.left || 0, insets?.right || 0, 20) : (compact ? 4 : 10),
        },
      ]}
      ref={(node) => { topBarRef.current = node; }}
      onLayout={(event) => {
        alignCompactLandscapeTopBar();
        onPlayerLayout?.(event);
      }}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.headerRow,
          !isPortrait && styles.landscapeHeaderRow,
          isPortrait && styles.portraitHeaderRow,
          compact && styles.compactLandscapeHeaderRow,
          compactAndroidLandscape && styles.compactAndroidLandscapeHeaderRow,
        ]}
        onLayout={onHeaderLayout}
      >
        <BackButton visible={!locked && controls.back !== false} palette={palette} onClose={onClose} compact={compact} scale={scale} />
        {!locked && (isPortrait || shouldShowLandscapeTitle) ? <PlayerTitle isPortrait={isPortrait} compact={compact} displayTitle={displayTitle} episodeLabel={episodeLabel} showEpisodeSubtitle={showEpisodeSubtitle} palette={palette} scale={scale} /> : null}

        <View style={[
          styles.topRightActions,
          isPortrait && styles.portraitTopRightActions,
          compact && styles.compactTopRightActions,
          compactAndroidLandscape && styles.compactAndroidTopRightActions,
        ]}>
          {locked ? <PlayerLockButton locked onPress={onToggleLock} compact={compact} scale={scale} /> : (
            <>
              <RecordingControls canRecord={canRecord ?? true} enabled={isScreenRecorderEnabled} status={recStatus} loading={isLoading} controls={controls} onStart={onStartRecording} onResume={onResumeRecording} onPause={onPauseRecording} onStop={onStopRecording} palette={palette} compact={compact} scale={scale} />
              <ServiceActionButton name="liveChat" tab="chat" enabled={isLiveCommentsEnabled} controls={controls} showLiveChat={showLiveChat} drawerTab={drawerTab} onToggle={onToggleChatTab} activeIcon="comment-text-multiple" inactiveIcon="comment-text-multiple-outline" label="Live chat" palette={palette} compact={compact} scale={scale} />
              <ServiceActionButton name="epg" tab="epg" enabled={isEpgEnabled} controls={controls} showLiveChat={showLiveChat} drawerTab={drawerTab} onToggle={onToggleChatTab} activeIcon="television-guide" inactiveIcon="television-classic" label="Programme guide" palette={palette} compact={compact} scale={scale} />
              <SessionActionButton visible={!isLive && controls.restart !== false} compact={compact} onPress={onRestart} icon="restart" color={palette.controlColor} accessibilityLabel="Restart playback" scale={scale} />
              <SessionActionButton visible={controls.mute !== false} compact={compact} onPress={onToggleMute} icon={muted ? 'mute' : 'unmute'} color={muted ? palette.errorColor : palette.controlColor} accessibilityLabel={muted ? 'Unmute' : 'Mute'} scale={scale} />
              <ServiceActionButton name="diagnostics" tab="diagnostics" enabled={diagnosticsOverlayEnabled} controls={controls} showLiveChat={showLiveChat} drawerTab={drawerTab} onToggle={onToggleChatTab} activeIcon="pulse" inactiveIcon="pulse" label="Stream diagnostics" palette={palette} compact={compact} scale={scale} />
              {controls.lock !== false ? <PlayerLockButton compact={compact} onPress={onToggleLock} scale={scale} /> : null}
            </>
          )}
        </View>
      </View>
      {!locked && shouldShowLandscapeTitle ? <CompactLandscapeTitle compact={compact} displayTitle={displayTitle} palette={palette} scale={scale} /> : null}
      {!locked ? <PortraitPlayerTitle isPortrait={isPortrait} compact={compact} displayTitle={displayTitle} episodeLabel={episodeLabel} showEpisodeSubtitle={showEpisodeSubtitle} palette={palette} scale={scale} /> : null}
    </View>
  );
};


const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
    zIndex: 70,
    elevation: 70,
  },
  portraitTopBar: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 8,
  },
  compactLandscapeTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    minHeight: 58,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    paddingVertical: 2,
    gap: 2,
    zIndex: 90,
    elevation: 90,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  landscapeHeaderRow: {
    flex: 1,
  },
  portraitHeaderRow: {
    width: '100%',
  },
  compactLandscapeHeaderRow: {
    width: '100%',
    minHeight: 30,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 0,
    flexShrink: 0,
  },
  compactAndroidLandscapeHeaderRow: {
    justifyContent: 'space-between',
    gap: 6,
  },
  portraitTopRightActions: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  compactTopRightActions: {
    flexDirection: 'row',
    flexShrink: 0,
    gap: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  compactAndroidTopRightActions: {
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  compactLandscapeTitle: {
    alignSelf: 'stretch',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingBottom: 2,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitTitleBlock: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  titleText: {
    color: '#FFF',
    textAlign: 'center',
  },
  portraitTitleText: {
    width: '100%',
    textAlign: 'center',
  },
  episodeLabelText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  portraitEpisodeLabel: {
    textAlign: 'center',
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  backPill: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 8,
  },
  compactPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  backText: {
    color: '#FFF',
    fontWeight: '600',
  },
  recActivePill: {
    backgroundColor: 'rgba(255, 82, 82, 0.28)',
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  recPausePill: {
    backgroundColor: 'rgba(255, 193, 7, 0.22)',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  recStopPill: {
    backgroundColor: 'rgba(255, 82, 82, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.7)',
  },
});
