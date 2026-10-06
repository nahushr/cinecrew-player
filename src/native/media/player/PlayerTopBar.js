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

function getTopBarPaddingTop({ electronFullscreen, compactImmersiveAndroid, isFullscreen, insets }) {
  if (electronFullscreen) return 8;
  if (compactImmersiveAndroid) return 4;
  if (isFullscreen) return Math.max(insets?.top || 0, 24);
  return 8;
}

function getTopBarPaddingHorizontal({ electronFullscreen, isFullscreen, isPortrait, insets, compact }) {
  if (electronFullscreen) return 8;
  if (isFullscreen || !isPortrait) return Math.max(insets?.left || 0, insets?.right || 0, 20);
  return compact ? 4 : 10;
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
        compact ? styles.compactBackPill : styles.regularBackPill,
        {
          minWidth: Math.round((compact ? 76 : 88) * buttonBoost),
          height: buttonHeight,
          borderRadius: buttonHeight / 2,
          paddingLeft: Math.round((compact ? 8 : 10) * buttonBoost),
          paddingRight: Math.round((compact ? 12 : 16) * buttonBoost),
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

function updateCompactLandscapeTopOffset({
  compact,
  compactImmersiveAndroid,
  insets,
  topBarRef,
  landscapeTopOffsetRef,
  setLandscapeTopOffset,
}) {
  if (!compact) {
    if (landscapeTopOffsetRef.current !== 0) {
      landscapeTopOffsetRef.current = 0;
      setLandscapeTopOffset(0);
    }
    return;
  }

  topBarRef.current?.measureInWindow?.((_x, windowY) => {
    const baseWindowY = windowY - landscapeTopOffsetRef.current;
    const safeTop = compactImmersiveAndroid ? 4 : Math.max(insets?.top || 0, 8);
    const nextOffset = Math.max(0, safeTop - baseWindowY);
    if (Math.abs(nextOffset - landscapeTopOffsetRef.current) <= 1) return;
    landscapeTopOffsetRef.current = nextOffset;
    setLandscapeTopOffset(nextOffset);
  });
}

function UnlockedTopActions(props) {
  const {
    canRecord, isScreenRecorderEnabled, recStatus, isLoading, controls,
    onStartRecording, onResumeRecording, onPauseRecording, onStopRecording,
    isLiveCommentsEnabled, showLiveChat, drawerTab, onToggleChatTab,
    isEpgEnabled, diagnosticsOverlayEnabled, isLive, compact, scale,
    palette, controlsLock, onRestart, onToggleMute, muted,
  } = props;
  const muteIcon = muted ? 'mute' : 'unmute';
  const muteColor = muted ? palette.errorColor : palette.controlColor;
  const muteLabel = muted ? 'Unmute' : 'Mute';
  return (
    <>
      <RecordingControls canRecord={canRecord ?? true} enabled={isScreenRecorderEnabled} status={recStatus} loading={isLoading} controls={controls} onStart={onStartRecording} onResume={onResumeRecording} onPause={onPauseRecording} onStop={onStopRecording} palette={palette} compact={compact} scale={scale} />
      <ServiceActionButton name="liveChat" tab="chat" enabled={isLiveCommentsEnabled} controls={controls} showLiveChat={showLiveChat} drawerTab={drawerTab} onToggle={onToggleChatTab} activeIcon="comment-text-multiple" inactiveIcon="comment-text-multiple-outline" label="Live chat" palette={palette} compact={compact} scale={scale} />
      <ServiceActionButton name="epg" tab="epg" enabled={isEpgEnabled} controls={controls} showLiveChat={showLiveChat} drawerTab={drawerTab} onToggle={onToggleChatTab} activeIcon="television-guide" inactiveIcon="television-classic" label="Programme guide" palette={palette} compact={compact} scale={scale} />
      <SessionActionButton visible={!isLive && controls.restart !== false} compact={compact} onPress={onRestart} icon="restart" color={palette.controlColor} accessibilityLabel="Restart playback" scale={scale} />
      <SessionActionButton visible={controls.mute !== false} compact={compact} onPress={onToggleMute} icon={muteIcon} color={muteColor} accessibilityLabel={muteLabel} scale={scale} />
      <ServiceActionButton name="diagnostics" tab="diagnostics" enabled={diagnosticsOverlayEnabled} controls={controls} showLiveChat={showLiveChat} drawerTab={drawerTab} onToggle={onToggleChatTab} activeIcon="pulse" inactiveIcon="pulse" label="Stream diagnostics" palette={palette} compact={compact} scale={scale} />
      {controlsLock}
    </>
  );
}

function PlayerTopActions({ locked, props }) {
  if (locked) {
    return <PlayerLockButton locked onPress={props.onToggleLock} compact={props.compact} scale={props.scale} />;
  }
  return <UnlockedTopActions {...props} />;
}

function PlayerTopBarLayout({
  topBarStyle,
  headerRowStyle,
  topRightActionsStyle,
  topBarRef,
  onLayout,
  onHeaderLayout,
  backButton,
  headerTitle,
  actions,
  landscapeTitle,
  portraitTitle,
}) {
  return (
    <View ref={topBarRef} style={topBarStyle} onLayout={onLayout} pointerEvents="box-none">
      <View
        style={headerRowStyle}
        onLayout={onHeaderLayout}
      >
        {backButton}
        {headerTitle}
        <View style={topRightActionsStyle}>{actions}</View>
      </View>
      {landscapeTitle}
      {portraitTitle}
    </View>
  );
}

function getTopBarStyles({ isPortrait, compact, landscapeTopOffset, electronFullscreen, compactImmersiveAndroid, isFullscreen, insets }) {
  return [
    styles.topBar,
    isPortrait ? styles.portraitTopBar : null,
    compact ? styles.compactLandscapeTopBar : null,
    compact ? { top: landscapeTopOffset } : null,
    {
      paddingTop: getTopBarPaddingTop({ electronFullscreen, compactImmersiveAndroid, isFullscreen, insets }),
      paddingHorizontal: getTopBarPaddingHorizontal({ electronFullscreen, isFullscreen, isPortrait, insets, compact }),
    },
  ];
}

function getHeaderRowStyles({ isPortrait, compact, compactAndroidLandscape }) {
  return [
    styles.headerRow,
    isPortrait ? styles.portraitHeaderRow : styles.landscapeHeaderRow,
    compact ? styles.compactLandscapeHeaderRow : null,
    compactAndroidLandscape ? styles.compactAndroidLandscapeHeaderRow : null,
  ];
}

function getTopRightActionsStyles({ isPortrait, compact, compactAndroidLandscape }) {
  return [
    styles.topRightActions,
    isPortrait ? styles.portraitTopRightActions : null,
    compact ? styles.compactTopRightActions : null,
    compactAndroidLandscape ? styles.compactAndroidTopRightActions : null,
  ];
}

function getTopBarTitleElements({ locked, isPortrait, shouldShowLandscapeTitle, titleProps, palette, scale }) {
  return {
    headerTitle: !locked && (isPortrait || shouldShowLandscapeTitle)
      ? <PlayerTitle {...titleProps} />
      : null,
    landscapeTitle: !locked && shouldShowLandscapeTitle
      ? <CompactLandscapeTitle compact={titleProps.compact} displayTitle={titleProps.displayTitle} palette={palette} scale={scale} />
      : null,
    portraitTitle: !locked ? <PortraitPlayerTitle {...titleProps} /> : null,
  };
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
  const lockControl = controls.lock !== false && (
    <PlayerLockButton compact={compact} onPress={onToggleLock} scale={scale} />
  );
  const topActionsProps = {
    canRecord,
    isScreenRecorderEnabled,
    recStatus,
    isLoading,
    controls,
    onStartRecording,
    onResumeRecording,
    onPauseRecording,
    onStopRecording,
    isLiveCommentsEnabled,
    showLiveChat,
    drawerTab,
    onToggleChatTab,
    isEpgEnabled,
    diagnosticsOverlayEnabled,
    isLive,
    compact,
    scale,
    palette,
    controlsLock: lockControl,
    onRestart,
    onToggleMute,
    muted,
  };
  const alignCompactLandscapeTopBar = () => updateCompactLandscapeTopOffset({
    compact,
    compactImmersiveAndroid,
    insets,
    topBarRef,
    landscapeTopOffsetRef,
    setLandscapeTopOffset,
  });
  const displayTitle = useMemo(
    () => cleanPlayerTitle(title, episodeLabel, isMobile),
    [title, episodeLabel, isMobile],
  );
  const showEpisodeSubtitle = useMemo(
    () => shouldShowEpisodeSubtitle(isMobile, episodeLabel, displayTitle),
    [isMobile, episodeLabel, displayTitle],
  );
  const titleProps = { isPortrait, compact, displayTitle, episodeLabel, showEpisodeSubtitle, palette, scale };
  const titleElements = getTopBarTitleElements({ locked, isPortrait, shouldShowLandscapeTitle, titleProps, palette, scale });

  return (
    <PlayerTopBarLayout
      topBarRef={(node) => { topBarRef.current = node; }}
      topBarStyle={getTopBarStyles({ isPortrait, compact, landscapeTopOffset, electronFullscreen, compactImmersiveAndroid, isFullscreen, insets })}
      headerRowStyle={getHeaderRowStyles({ isPortrait, compact, compactAndroidLandscape })}
      topRightActionsStyle={getTopRightActionsStyles({ isPortrait, compact, compactAndroidLandscape })}
      onLayout={(event) => {
        alignCompactLandscapeTopBar();
        onPlayerLayout?.(event);
      }}
      onHeaderLayout={onHeaderLayout}
      backButton={<BackButton visible={!locked && controls.back !== false} palette={palette} onClose={onClose} compact={compact} scale={scale} />}
      headerTitle={titleElements.headerTitle}
      actions={<PlayerTopActions locked={locked} props={{ ...topActionsProps, onToggleLock, scale, compact }} />}
      landscapeTitle={titleElements.landscapeTitle}
      portraitTitle={titleElements.portraitTitle}
    />
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
    width: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 14,
  },
  regularBackPill: {
    minWidth: 88,
    paddingLeft: 10,
    paddingRight: 14,
  },
  compactBackPill: {
    minWidth: 76,
    paddingLeft: 8,
    paddingRight: 12,
    gap: 5,
  },
  compactPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  backText: {
    color: '#FFF',
    fontWeight: '600',
    paddingRight: 2,
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
