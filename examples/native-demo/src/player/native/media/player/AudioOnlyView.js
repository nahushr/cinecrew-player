import { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { isAndroid, isIOS, isWeb } from '../../../utils/runtimePlatform';
import { cleanPlayerTitle } from '../../../utils/mediaUtils';
import { PlayerIcon, usePlayerColors } from '../../customization';

function shouldDisplayEpisodeSubtitle(isMobile, episodeLabel, displayTitle) {
  if (isMobile || !episodeLabel) return false;
  const episode = episodeLabel.trim().toLowerCase();
  const title = displayTitle.toLowerCase();
  return Boolean(episode && title !== episode && !title.includes(episode));
}

function AudioArtwork({ posterUrl, isLandscape, palette }) {
  if (posterUrl) {
    return (
      <View style={[styles.audioOnlyPosterWrap, isLandscape && styles.audioOnlyPosterWrapLandscape]}>
        <Image source={{ uri: posterUrl }} style={styles.audioOnlyPoster} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View style={[styles.audioOnlyIconWrap, isLandscape && styles.audioOnlyIconWrapLandscape]}>
      <PlayerIcon name="headphones" size={isLandscape ? 36 : 54} color={palette.accentColor} />
    </View>
  );
}

function SoundWave({ isPlaying, isLandscape, accentColor }) {
  const animationBars = [
    ['short-left', styles.soundWaveBarAnim1],
    ['medium-left', styles.soundWaveBarAnim2],
    ['tall-left', styles.soundWaveBarAnim3],
    ['peak', styles.soundWaveBarAnim4],
    ['tall-right', styles.soundWaveBarAnim5],
    ['medium-right', styles.soundWaveBarAnim2],
    ['short-right', styles.soundWaveBarAnim4],
  ];
  return (
    <View style={[styles.soundWaveRow, isLandscape && styles.soundWaveRowLandscape]}>
      {animationBars.map(([key, animationStyle]) => (
        <View
          key={key}
          style={[styles.soundWaveBar, { backgroundColor: accentColor }, isPlaying ? animationStyle : styles.soundWaveBarStatic]}
        />
      ))}
    </View>
  );
}

function AudioOnlyBadge({ usesAudioProxy, palette, isLandscape }) {
  const message = usesAudioProxy
    ? 'Battery Saver Audio Mode • Screen can be locked'
    : 'Audio Mode • Video hidden • Screen can be locked';
  return (
    <View style={[styles.audioOnlyBadge, isLandscape && styles.audioOnlyBadgeLandscape, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }]}>
      <PlayerIcon name="lightning-bolt" size={14} color={palette.accentColor} />
      <Text style={[styles.audioOnlyBadgeText, { color: palette.accentColor }]}>{message}</Text>
    </View>
  );
}

export const AudioOnlyView = ({
  posterUrl,
  title,
  episodeLabel,
  isPlaying,
  windowWidth,
  windowHeight,
  usesAudioProxy = false,
  onToggleAudioOnly,
}) => {
  const palette = usePlayerColors();
  const isLandscape = windowWidth >= windowHeight;
  const isMobile = isAndroid() || isIOS() || Math.min(windowWidth, windowHeight) < 600;

  const displayTitle = useMemo(() => {
    return cleanPlayerTitle(title, episodeLabel, isMobile);
  }, [title, episodeLabel, isMobile]);

  const showEpisodeSubtitle = useMemo(
    () => shouldDisplayEpisodeSubtitle(isMobile, episodeLabel, displayTitle),
    [isMobile, episodeLabel, displayTitle],
  );

  return (
    <View style={styles.audioOnlyContainer} pointerEvents="auto">

      <View style={[styles.audioOnlyCard, isLandscape && styles.audioOnlyCardLandscape, { borderColor: palette.accentColor }]} pointerEvents="auto">
        <AudioArtwork posterUrl={posterUrl} isLandscape={isLandscape} palette={palette} />

        <SoundWave isPlaying={isPlaying} isLandscape={isLandscape} accentColor={palette.accentColor} />

        <Text style={[styles.audioOnlyTitle, isLandscape && styles.audioOnlyTitleLandscape, { color: palette.controlColor }]} numberOfLines={2}>
          {displayTitle}
        </Text>

        {showEpisodeSubtitle ? (
          <Text style={[styles.audioOnlyEpisodeText, { color: palette.mutedColor }]} numberOfLines={1}>
            {episodeLabel}
          </Text>
        ) : null}

        <AudioOnlyBadge usesAudioProxy={usesAudioProxy} palette={palette} isLandscape={isLandscape} />

        <TouchableOpacity
          style={[styles.audioOnlyReturnBtn, isLandscape && styles.audioOnlyReturnBtnLandscape, { backgroundColor: palette.backgroundColor, borderColor: palette.accentColor }]}
          onPress={(e) => {
            e.stopPropagation();
            onToggleAudioOnly();
          }}
          hitSlop={8}
          activeOpacity={0.8}
        >
          <PlayerIcon name="video-outline" size={18} color={palette.accentColor} />
          <Text style={[styles.audioOnlyReturnText, { color: palette.accentColor }]}>Switch to Video</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  audioOnlyContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#07090E',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 50,
  },
  audioOnlyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    maxWidth: 440,
    maxHeight: '92%',
    borderRadius: 20,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
    ...(isWeb() ? { boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.6)' } : null),
    zIndex: 12,
  },
  audioOnlyCardLandscape: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  audioOnlyPosterWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#00E5FF',
    marginBottom: 14,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    ...(isWeb() ? { boxShadow: '0px 4px 10px rgba(0, 229, 255, 0.5)' } : null),
  },
  audioOnlyPosterWrapLandscape: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 8,
  },
  audioOnlyPoster: {
    width: '100%',
    height: '100%',
  },
  audioOnlyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  audioOnlyIconWrapLandscape: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  soundWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 28,
    marginBottom: 12,
  },
  soundWaveRowLandscape: {
    height: 18,
    marginBottom: 6,
  },
  soundWaveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
  },
  soundWaveBarStatic: {
    height: 8,
    opacity: 0.4,
  },
  soundWaveBarAnim1: {
    height: 22,
  },
  soundWaveBarAnim2: {
    height: 14,
  },
  soundWaveBarAnim3: {
    height: 26,
  },
  soundWaveBarAnim4: {
    height: 18,
  },
  soundWaveBarAnim5: {
    height: 10,
  },
  audioOnlyTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  audioOnlyTitleLandscape: {
    fontSize: 14.5,
    marginBottom: 2,
  },
  audioOnlyEpisodeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  audioOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    borderColor: 'rgba(255, 214, 10, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 14,
  },
  audioOnlyBadgeLandscape: {
    marginTop: 3,
    marginBottom: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  audioOnlyBadgeText: {
    color: '#FFD60A',
    fontSize: 11,
    fontWeight: '600',
  },
  audioOnlyReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00E5FF',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  audioOnlyReturnBtnLandscape: {
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  audioOnlyReturnText: {
    color: '#00E5FF',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
