import { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { isAndroid, isIOS } from '../../../utils/runtimePlatform';
import { cleanPlayerTitle } from '../../../utils/mediaUtils';
import { PlayerIcon, usePlayerColors } from '../../customization';

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
  onMinimize,
  controls = {},
}) => {
  const { width, height } = useWindowDimensions();
  const palette = usePlayerColors();
  const isPortrait = height >= width;
  const isMobile = isAndroid() || isIOS() || Math.min(width, height) < 600;

  const displayTitle = useMemo(() => {
    return cleanPlayerTitle(title, episodeLabel, isMobile);
  }, [title, episodeLabel, isMobile]);

  const showEpisodeSubtitle = useMemo(() => {
    // Strictly one title on mobile
    if (isMobile) return false;
    if (!episodeLabel) return false;
    const ep = episodeLabel.trim();
    if (!ep) return false;
    if (displayTitle.toLowerCase() === ep.toLowerCase() || displayTitle.toLowerCase().includes(ep.toLowerCase())) {
      return false;
    }
    return true;
  }, [isMobile, episodeLabel, displayTitle]);

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
        {controls.back !== false ? <TouchableOpacity
          style={styles.pill}
          onPress={(e) => {
            e.stopPropagation();
            onClose();
          }}
          hitSlop={12}
        >
          <PlayerIcon name="arrow-left" size={22} color={palette.controlColor} />
          <Text style={[styles.backText, { color: palette.controlColor, fontSize: scale?.backFont, fontWeight: scale?.backWeight }]}>
            Back
          </Text>
        </TouchableOpacity> : <View style={{ width: 12 }} />}

        {!isPortrait ? (
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.titleText, { color: palette.controlColor, fontSize: scale?.titleFont, fontWeight: scale?.titleWeight }]}
                numberOfLines={1}
              >
                {displayTitle}
              </Text>
            </View>
            {showEpisodeSubtitle ? (
              <Text style={[styles.episodeLabelText, { color: palette.mutedColor, fontSize: scale?.backFont }]} numberOfLines={1}>
                {episodeLabel}
              </Text>
            ) : null}
          </View>
        ) : <View style={styles.headerSpacer} />}

        <View style={styles.topRightActions}>
          {isLive && isScreenRecorderEnabled && recStatus === 'idle' && (
            controls.recording !== false &&
            <TouchableOpacity
              style={[styles.pill, isLoading && { opacity: 0.45 }]}
              onPress={onStartRecording}
              hitSlop={12}
              disabled={isLoading}
              accessibilityLabel="Start recording"
            >
              <PlayerIcon name="record-rec" size={22} color={palette.errorColor} />
            </TouchableOpacity>
          )}

          {isLive && isScreenRecorderEnabled && recStatus !== 'idle' && (
            controls.recording !== false &&
            <>
              <TouchableOpacity
                style={[
                  styles.pill,
                  recStatus === 'paused' ? styles.recPausePill : styles.recActivePill,
                ]}
                onPress={recStatus === 'paused' ? onResumeRecording : onPauseRecording}
                hitSlop={12}
                accessibilityLabel={recStatus === 'paused' ? 'Resume recording' : 'Pause recording'}
              >
                <PlayerIcon
                  name={recStatus === 'paused' ? 'play' : 'pause'}
                  size={20}
                  color={palette.controlColor}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pill, styles.recStopPill]}
                onPress={onStopRecording}
                hitSlop={12}
                accessibilityLabel="Stop recording"
              >
              <PlayerIcon name="stop" size={20} color={palette.errorColor} />
              </TouchableOpacity>
            </>
          )}

          {/* Live Chat Toggle Button (Live TV Only) */}
          {controls.liveChat !== false && isLive && isLiveCommentsEnabled && (
            <TouchableOpacity
              style={[
                styles.pill,
                showLiveChat && drawerTab === 'chat' && {
                  backgroundColor: palette.surfaceColor,
                  borderColor: palette.accentColor,
                  borderWidth: 1,
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleChatTab('chat');
              }}
              hitSlop={12}
            >
              <PlayerIcon
                name={showLiveChat && drawerTab === 'chat' ? 'comment-text-multiple' : 'comment-text-multiple-outline'}
                size={20}
                color={showLiveChat && drawerTab === 'chat' ? palette.accentColor : palette.controlColor}
              />
            </TouchableOpacity>
          )}

          {controls.epg !== false && isLive && isEpgEnabled && (
            <TouchableOpacity
              style={[
                styles.pill,
                showLiveChat && drawerTab === 'epg' && {
                  backgroundColor: palette.surfaceColor,
                  borderColor: palette.accentColor,
                  borderWidth: 1,
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleChatTab('epg');
              }}
              hitSlop={12}
            >
              <PlayerIcon
                name={showLiveChat && drawerTab === 'epg' ? 'television-guide' : 'television-classic'}
                size={20}
                color={showLiveChat && drawerTab === 'epg' ? palette.accentColor : palette.controlColor}
              />
            </TouchableOpacity>
          )}

          {/* Stream Diagnostics Overlay Toggle Button */}
          {diagnosticsOverlayEnabled && (
            <TouchableOpacity
              style={[
                styles.pill,
                showLiveChat && drawerTab === 'diagnostics' && {
                  backgroundColor: palette.surfaceColor,
                  borderColor: palette.accentColor,
                  borderWidth: 1,
                },
              ]}
              onPress={(e) => {
                e.stopPropagation();
                onToggleChatTab('diagnostics');
              }}
              hitSlop={12}
            >
              <PlayerIcon
                name="pulse"
                size={20}
                color={showLiveChat && drawerTab === 'diagnostics' ? palette.accentColor : palette.controlColor}
              />
            </TouchableOpacity>
          )}

          {!isLive && controls.restart !== false && (
            <TouchableOpacity
              style={styles.pill}
              onPress={(e) => {
                e.stopPropagation();
                onRestart();
              }}
              hitSlop={12}
            >
              <PlayerIcon name="restart" size={20} color={palette.controlColor} />
            </TouchableOpacity>
          )}

          {controls.mute !== false ? <TouchableOpacity
            style={styles.pill}
            onPress={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            hitSlop={12}
          >
            <PlayerIcon
              name={muted ? 'volume-off' : 'volume-high'}
              size={20}
              color={muted ? palette.errorColor : palette.controlColor}
            />
          </TouchableOpacity> : null}

          {controls.lock !== false ? <TouchableOpacity
            style={styles.pill}
            onPress={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            hitSlop={12}
          >
            <PlayerIcon name="lock-open-variant" size={20} color={palette.controlColor} />
          </TouchableOpacity> : null}

          {controls.minimize && typeof onMinimize === 'function' ? (
            <TouchableOpacity style={styles.pill} onPress={onMinimize} hitSlop={12} accessibilityLabel="Minimize player">
              <PlayerIcon name="arrow-collapse" size={20} color={palette.controlColor} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isPortrait && (
        <View style={styles.portraitTitleBlock}>
          <Text
            style={[styles.titleText, styles.portraitTitleText, { color: palette.controlColor, fontSize: scale?.titleFont, fontWeight: scale?.titleWeight }]}
            numberOfLines={2}
          >
            {displayTitle}
          </Text>
          {showEpisodeSubtitle ? (
            <Text style={[styles.episodeLabelText, styles.portraitEpisodeLabel, { color: palette.mutedColor, fontSize: scale?.backFont }]} numberOfLines={1}>
              {episodeLabel}
            </Text>
          ) : null}
        </View>
      )}
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
