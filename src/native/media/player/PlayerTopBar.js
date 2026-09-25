import { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { isAndroid, isIOS } from '../../../utils/runtimePlatform';
import { cleanPlayerTitle } from '../../../utils/mediaUtils';
import { PlayerIcon, usePlayerColors } from '../../customization';

function shouldShowEpisodeSubtitle(isMobile, episodeLabel, displayTitle) {
  if (isMobile || !episodeLabel) return false;
  const episode = episodeLabel.trim().toLowerCase();
  const title = displayTitle.toLowerCase();
  return Boolean(episode && title !== episode && !title.includes(episode));
}

function BackButton({ visible, palette, scale, onClose }) {
  if (!visible) return <View style={{ width: 12 }} />;
  return (
    <TouchableOpacity style={styles.pill} onPress={(event) => { event.stopPropagation(); onClose(); }} hitSlop={12}>
      <PlayerIcon name="arrow-left" size={22} color={palette.controlColor} />
      <Text style={[styles.backText, { color: palette.controlColor, fontSize: scale?.backFont, fontWeight: scale?.backWeight }]}>Back</Text>
    </TouchableOpacity>
  );
}

function RecordingControls({ isLive, enabled, status, loading, controls, onStart, onResume, onPause, onStop, palette }) {
  if (!isLive || !enabled || controls.recording === false) return null;
  if (status === 'idle') {
    return (
      <TouchableOpacity style={[styles.pill, loading && { opacity: 0.45 }]} onPress={onStart} hitSlop={12} disabled={loading} accessibilityLabel="Start recording">
        <PlayerIcon name="record-rec" size={22} color={palette.errorColor} />
      </TouchableOpacity>
    );
  }
  const isPaused = status === 'paused';
  return (
    <>
      <TouchableOpacity style={[styles.pill, isPaused ? styles.recPausePill : styles.recActivePill]} onPress={isPaused ? onResume : onPause} hitSlop={12} accessibilityLabel={isPaused ? 'Resume recording' : 'Pause recording'}>
        <PlayerIcon name={isPaused ? 'play' : 'pause'} size={20} color={palette.controlColor} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.pill, styles.recStopPill]} onPress={onStop} hitSlop={12} accessibilityLabel="Stop recording">
        <PlayerIcon name="stop" size={20} color={palette.errorColor} />
      </TouchableOpacity>
    </>
  );
}

function LiveServiceControls({ isLive, controls, showLiveChat, drawerTab, showChat, showEpg, showDiagnostics, onToggle, palette }) {
  const renderServiceButton = (name, tab, enabled, activeName) => {
    if (!isLive || !enabled || controls[name] === false) return null;
    const active = showLiveChat && drawerTab === tab;
    return (
      <TouchableOpacity key={tab} style={[styles.pill, active && { backgroundColor: palette.surfaceColor, borderColor: palette.accentColor, borderWidth: 1 }]} onPress={(event) => { event.stopPropagation(); onToggle(tab); }} hitSlop={12}>
        <PlayerIcon name={active ? activeName : ({ chat: 'comment-text-multiple-outline', epg: 'television-classic', diagnostics: 'pulse' }[tab])} size={20} color={active ? palette.accentColor : palette.controlColor} />
      </TouchableOpacity>
    );
  };
  return <>{renderServiceButton('liveChat', 'chat', showChat, 'comment-text-multiple')}{renderServiceButton('epg', 'epg', showEpg, 'television-guide')}{renderServiceButton('diagnostics', 'diagnostics', showDiagnostics, 'pulse')}</>;
}

function PlaybackSessionControls({ isLive, controls, muted, onRestart, onMute, onLock, palette }) {
  return (
    <>
      {!isLive && controls.restart !== false ? <TouchableOpacity style={styles.pill} onPress={(event) => { event.stopPropagation(); onRestart(); }} hitSlop={12}><PlayerIcon name="restart" size={20} color={palette.controlColor} /></TouchableOpacity> : null}
      {controls.mute !== false ? <TouchableOpacity style={styles.pill} onPress={(event) => { event.stopPropagation(); onMute(); }} hitSlop={12}><PlayerIcon name={muted ? 'mute' : 'unmute'} size={20} color={muted ? palette.errorColor : palette.controlColor} /></TouchableOpacity> : null}
      {controls.lock !== false ? <TouchableOpacity style={styles.pill} onPress={(event) => { event.stopPropagation(); onLock(); }} hitSlop={12}><PlayerIcon name="lock-open-variant" size={20} color={palette.controlColor} /></TouchableOpacity> : null}
    </>
  );
}

function PlayerTitle({ isPortrait, displayTitle, episodeLabel, showEpisodeSubtitle, palette, scale }) {
  if (isPortrait) return <View style={styles.headerSpacer} />;
  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleRow}>
        <Text style={[styles.titleText, { color: palette.controlColor, fontSize: scale?.titleFont, fontWeight: scale?.titleWeight }]} numberOfLines={1}>{displayTitle}</Text>
      </View>
      {showEpisodeSubtitle ? <Text style={[styles.episodeLabelText, { color: palette.mutedColor, fontSize: scale?.backFont }]} numberOfLines={1}>{episodeLabel}</Text> : null}
    </View>
  );
}

function PortraitPlayerTitle({ isPortrait, displayTitle, episodeLabel, showEpisodeSubtitle, palette, scale }) {
  if (!isPortrait) return null;
  return (
    <View style={styles.portraitTitleBlock}>
      <Text style={[styles.titleText, styles.portraitTitleText, { color: palette.controlColor, fontSize: scale?.titleFont, fontWeight: scale?.titleWeight }]} numberOfLines={2}>{displayTitle}</Text>
      {showEpisodeSubtitle ? <Text style={[styles.episodeLabelText, styles.portraitEpisodeLabel, { color: palette.mutedColor, fontSize: scale?.backFont }]} numberOfLines={1}>{episodeLabel}</Text> : null}
    </View>
  );
}

export const PlayerTopBar = ({
  insets,
  scale,
  title,
  episodeLabel,
  isLive,
  isScreenRecorderEnabled,
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
}) => {
  const { width, height } = useWindowDimensions();
  const palette = usePlayerColors();
  const isPortrait = height >= width;
  const isMobile = isAndroid() || isIOS() || Math.min(width, height) < 600;

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
        {
          paddingTop: Math.max(insets?.top || 0, 24),
          paddingHorizontal: Math.max(insets?.left || 0, insets?.right || 0, 20),
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.headerRow, !isPortrait && styles.landscapeHeaderRow, isPortrait && styles.portraitHeaderRow]}>
        <BackButton visible={controls.back !== false} palette={palette} scale={scale} onClose={onClose} />
        <PlayerTitle isPortrait={isPortrait} displayTitle={displayTitle} episodeLabel={episodeLabel} showEpisodeSubtitle={showEpisodeSubtitle} palette={palette} scale={scale} />

        <View style={styles.topRightActions}>
          <RecordingControls isLive={isLive} enabled={isScreenRecorderEnabled} status={recStatus} loading={isLoading} controls={controls} onStart={onStartRecording} onResume={onResumeRecording} onPause={onPauseRecording} onStop={onStopRecording} palette={palette} />
          <LiveServiceControls isLive={isLive} controls={controls} showLiveChat={showLiveChat} drawerTab={drawerTab} showChat={isLiveCommentsEnabled} showEpg={isEpgEnabled} showDiagnostics={diagnosticsOverlayEnabled} onToggle={onToggleChatTab} palette={palette} />
          <PlaybackSessionControls isLive={isLive} controls={controls} muted={muted} onRestart={onRestart} onMute={onToggleMute} onLock={onToggleLock} palette={palette} />
        </View>
      </View>
      <PortraitPlayerTitle isPortrait={isPortrait} displayTitle={displayTitle} episodeLabel={episodeLabel} showEpisodeSubtitle={showEpisodeSubtitle} palette={palette} scale={scale} />
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
  headerSpacer: {
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: '#FFF',
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
