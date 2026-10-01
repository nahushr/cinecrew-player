import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PlayerIcon } from '../../customization';
import { formatProgressBarTime } from '../../../utils/progressBarTime.js';
import { mediaPlayerStyles as styles } from './mediaPlayerStyles';

export function InlinePreviewTopActions({ controls, muted, videoOnlyMode, handleMuteAction, showLiveBadge, isFullscreen, scale }) {
  const displayLiveBadge = Boolean(showLiveBadge ?? controls?.liveBadge ?? controls?.livePill ?? controls?.liveButton ?? false);
  const iconBoost = scale?.iconBoost || (isFullscreen ? 1.1 : 1.0);
  const fontBoost = scale?.fontBoost || iconBoost;
  return (
    <View style={styles.inlinePreviewTopRow} pointerEvents="box-none">
      {displayLiveBadge ? (
        <View style={styles.inlineLiveBadge} pointerEvents="none">
          <View style={styles.inlineLiveDot} />
          <Text style={[styles.inlineLiveText, fontBoost > 1 && { fontSize: Math.round(10 * fontBoost) }]}>LIVE</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {controls.mute !== false ? (
        <TouchableOpacity
          style={styles.inlinePreviewIconButton}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
          onPress={(event) => {
            event?.stopPropagation?.();
            handleMuteAction();
          }}
        >
          <PlayerIcon name={muted || videoOnlyMode ? 'mute' : 'unmute'} size={Math.round(19 * iconBoost)} color="#FFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function InlinePreviewCenterAction({ controls, colors, isPlaying, handlePlayPauseAction, handleSeekByAction, isFullscreen, scale }) {
  const iconBoost = scale?.iconBoost || (isFullscreen ? 1.1 : 1.0);
  return (
    <View style={styles.inlinePreviewCenterControls} pointerEvents="box-none">
      <View style={styles.inlinePreviewCenterRow}>
        {controls.seekBack !== false && typeof handleSeekByAction === 'function' ? (
          <TouchableOpacity
            style={styles.inlinePreviewSeekButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Rewind 10 seconds"
            onPress={(event) => {
              event?.stopPropagation?.();
              handleSeekByAction(-10);
            }}
          >
            <PlayerIcon name="replay-10" size={Math.round(26 * iconBoost)} color="#FFF" />
          </TouchableOpacity>
        ) : null}
        {controls.playPause !== false ? (
          <TouchableOpacity
            style={[styles.inlinePreviewCenterButton, { backgroundColor: colors?.brandAccent || (colors?.mode === 'dark' ? '#FF9A86' : '#D95045') }]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause preview' : 'Play preview'}
            onPress={(event) => {
              event?.stopPropagation?.();
              handlePlayPauseAction();
            }}
          >
            <PlayerIcon name={isPlaying ? 'pause' : 'play'} size={Math.round(27 * iconBoost)} color="#FFF" />
          </TouchableOpacity>
        ) : null}
        {controls.seekForward !== false && typeof handleSeekByAction === 'function' ? (
          <TouchableOpacity
            style={styles.inlinePreviewSeekButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Skip forward 10 seconds"
            onPress={(event) => {
              event?.stopPropagation?.();
              handleSeekByAction(10);
            }}
          >
            <PlayerIcon name="forward-10" size={Math.round(26 * iconBoost)} color="#FFF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function InlinePreviewBottomActions({
  controls, title, showInlineChatButton, showLiveChat, handlePanelAction,
  isFullscreen, handleFullscreenAction, invokeAction, onPromotePreview, mediaId,
  scale, currentTime,
}) {
  const iconBoost = scale?.iconBoost || (isFullscreen ? 1.1 : 1.0);
  const fontBoost = scale?.fontBoost || iconBoost;
  return (
    <View style={styles.inlinePreviewBottomRow} pointerEvents="box-none">
      <Text style={[styles.inlinePreviewTitle, fontBoost > 1 && { fontSize: Math.round(14 * fontBoost) }]} numberOfLines={1} pointerEvents="none">{title || 'Live TV'}</Text>
      <View style={styles.inlinePreviewActions} pointerEvents="box-none">
        {controls.liveChat !== false && showInlineChatButton && !showLiveChat ? (
          <TouchableOpacity
            style={styles.inlineChatButton}
            activeOpacity={0.84}
            accessibilityRole="button"
            accessibilityLabel="Open live chat"
            onPress={(event) => {
              event?.stopPropagation?.();
              handlePanelAction('chat');
            }}
          >
            <PlayerIcon name="comment-text-outline" size={Math.round(17 * iconBoost)} color="#FFF" />
            <Text style={[styles.inlineChatButtonText, fontBoost > 1 && { fontSize: Math.round(12 * fontBoost) }]}>Live Chat</Text>
          </TouchableOpacity>
        ) : null}
        {controls.fullscreen !== false ? (
          <TouchableOpacity
            style={styles.inlinePreviewIconButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isFullscreen ? 'Exit fullscreen' : 'Open live player'}
            onPress={(event) => {
              event?.stopPropagation?.();
              if (isFullscreen) handleFullscreenAction();
              else invokeAction('onFullscreen', onPromotePreview, {
                title,
                mediaId,
                isFullscreen: true,
                currentTime,
                startTime: currentTime,
                position: currentTime,
                progressTime: formatProgressBarTime(currentTime),
              });
            }}
          >
            <PlayerIcon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={Math.round(20 * iconBoost)} color="#FFF" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function InlinePreviewFeedback({ isLoading, errorMessage }) {
  if (isLoading && !errorMessage) {
    return (
      <View pointerEvents="none" style={styles.inlinePreviewLoading}>
        <View style={styles.inlinePreviewLoadingPill}>
          <ActivityIndicator size="small" color="#FFF" />
          <Text style={styles.inlinePreviewLoadingText}>Loading stream…</Text>
        </View>
      </View>
    );
  }
  if (!errorMessage) return null;
  return (
    <View pointerEvents="none" style={styles.inlinePreviewError}>
      <PlayerIcon name="alert-circle-outline" size={20} color="#FFF" />
      <Text style={styles.inlinePreviewErrorText} numberOfLines={2}>{errorMessage}</Text>
    </View>
  );
}

export function InlinePreviewFrame({
  hostRef, isValidPreviewRect, positionStyle, videoPlayer, title, onPromotePreview,
  controls, colors, muted, videoOnlyMode, handleMuteAction, isPlaying,
  handlePlayPauseAction, handleSeekByAction, showInlineChatButton, showLiveChat,
  handlePanelAction, isFullscreen, handleFullscreenAction, invokeAction, mediaId,
  isLoading, errorMessage, showLiveBadge, children, scale, currentTime,
}) {
  return (
    <View
      ref={hostRef}
      collapsable={false}
      pointerEvents={!isValidPreviewRect ? 'box-none' : 'auto'}
      style={[styles.playerHost, styles.playerHostInline, positionStyle]}
    >
      <View collapsable={false} pointerEvents="auto" style={styles.inlineVideoStage}>
        <View collapsable={false} pointerEvents="none" style={styles.videoContainer}>{videoPlayer}</View>
        {!showLiveChat ? (
          <View style={styles.inlinePreviewChrome} pointerEvents="box-none">
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={`Open ${title || 'live channel'} in the video player`}
            onPress={() => onPromotePreview?.({ currentTime, startTime: currentTime, title, mediaId })}
          />
          <InlinePreviewTopActions controls={controls} muted={muted} videoOnlyMode={videoOnlyMode} handleMuteAction={handleMuteAction} showLiveBadge={showLiveBadge} isFullscreen={isFullscreen} scale={scale} />
          {!isLoading ? (
            <InlinePreviewCenterAction
              controls={controls}
              colors={colors}
              isPlaying={isPlaying}
              handlePlayPauseAction={handlePlayPauseAction}
              handleSeekByAction={handleSeekByAction}
              isFullscreen={isFullscreen}
              scale={scale}
            />
          ) : null}
          <InlinePreviewBottomActions
            controls={controls}
            title={title}
            showInlineChatButton={showInlineChatButton}
            showLiveChat={showLiveChat}
            handlePanelAction={handlePanelAction}
            isFullscreen={isFullscreen}
            handleFullscreenAction={handleFullscreenAction}
            invokeAction={invokeAction}
            onPromotePreview={onPromotePreview}
            mediaId={mediaId}
            scale={scale}
            currentTime={currentTime}
          />
          <InlinePreviewFeedback isLoading={isLoading} errorMessage={errorMessage} />
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}
