import React from 'react';
import { isElectron, isWeb } from '../../../utils/runtimePlatform';
import { ElectronVideoPlayer } from '../ElectronVideoPlayer';
import { WebVideoPlayer } from '../WebVideoPlayer';
import VLCPlayer from '../../../../packages/react-native-vlc-media-player/VLCPlayer.js';
import { VLC_AVAILABLE, VLCBoundary } from './VLCBoundary';
import { mediaPlayerStyles as styles } from './mediaPlayerStyles';

export function PlatformMediaSurface(props) {
  const {
    playerStreamUrl,
    vlcRef,
    isPlaying,
    muted,
    videoOnlyMode,
    volume,
    playbackRate,
    aspectRatio,
    title,
    posterUrl,
    isLive,
    isAudioOnly,
    selectedAudioTrack,
    handleTracksChanged,
    handleProgress,
    handleNativePlaying,
    handleWebBuffering,
    handleEpisodeEnded,
    handleWebError,
    handleVlcError,
    togglePlayPause,
    handleSeekByAction,
    handlePlaybackRoute,
    nativeSource,
    computedAspectRatio,
    handleNativeLoadStart,
    handleNativeOpen,
    handleNativeBuffering,
    onRecordingCreated,
    onRecordingState,
    getPlayerHostBounds,
    getPlayerHostElement,
    setIsFullscreen
  } = props;
  if (isElectron()) {
    return (
      <ElectronVideoPlayer
        ref={vlcRef}
        streamUrl={playerStreamUrl}
        getContainerBounds={getPlayerHostBounds}
        getContainerElement={getPlayerHostElement}
        paused={!isPlaying}
        muted={muted || videoOnlyMode}
        volume={muted || videoOnlyMode ? 0 : volume}
        playbackRate={playbackRate}
        videoAspectRatio={aspectRatio}
        title={title}
        posterUrl={posterUrl}
        isLive={isLive}
        audioOnly={isAudioOnly}
        audioTrack={selectedAudioTrack}
        onTracksChanged={handleTracksChanged}
        onProgress={handleProgress}
        onPlaying={handleNativePlaying}
        onPlaybackStateChange={togglePlayPause}
        onBuffering={handleWebBuffering}
        onEnded={handleEpisodeEnded}
        onError={handleWebError}
        onClose={props.handleClose}
        onPlaybackRoute={handlePlaybackRoute}
        onFullscreenChange={setIsFullscreen}
      />
    );
  }
  if (isWeb()) {
    return (
      <WebVideoPlayer
        key={`web-${playerStreamUrl}`}
        ref={vlcRef}
        streamUrl={playerStreamUrl}
        paused={!isPlaying}
        muted={muted || videoOnlyMode}
        volume={muted || videoOnlyMode ? 0 : volume}
        playbackRate={playbackRate}
        videoAspectRatio={aspectRatio}
        title={title}
        posterUrl={posterUrl}
        isLive={isLive}
        audioOnly={isAudioOnly}
        videoOnly={videoOnlyMode}
        audioTrack={selectedAudioTrack}
        onTracksChanged={handleTracksChanged}
        onProgress={handleProgress}
        onPlaying={handleNativePlaying}
        onBuffering={handleWebBuffering}
        onEnded={handleEpisodeEnded}
        onError={handleWebError}
        onTogglePlayPause={togglePlayPause}
        onSeekBy={handleSeekByAction}
        onPlaybackRoute={handlePlaybackRoute}
      />
    );
  }
  return (
    <VLCBoundary key={`vlcb-${playerStreamUrl}`} unavailable={!VLC_AVAILABLE} onError={handleVlcError}>
      {VLC_AVAILABLE ? (
        <VLCPlayer
          rate={playbackRate}
          key={`vlc-${playerStreamUrl}`}
          ref={vlcRef}
          style={styles.video}
          autoAspectRatio={false}
          videoAspectRatio={computedAspectRatio}
          audioTrack={selectedAudioTrack}
          autoplay={true}
          paused={!isPlaying}
          muted={muted || videoOnlyMode}
          volume={volume}
          playInBackground={isAudioOnly}
          playWhenInactive={isAudioOnly}
          source={nativeSource}
          onLoadStart={handleNativeLoadStart}
          onProgress={handleProgress}
          onVLCProgress={handleProgress}
          onPlaying={handleNativePlaying}
          onVLCPlaying={handleNativePlaying}
          onOpen={handleNativeOpen}
          onVLCOpened={handleNativeOpen}
          onEnd={handleEpisodeEnded}
          onBuffering={handleNativeBuffering}
          onVLCBuffering={handleNativeBuffering}
          onError={handleVlcError}
          onVLCError={handleVlcError}
          onRecordingCreated={onRecordingCreated}
          onRecordingState={onRecordingState}
        />
      ) : null}
    </VLCBoundary>
  );
}
