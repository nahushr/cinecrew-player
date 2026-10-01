import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PlayerIcon } from '../../customization';
import { mediaPlayerStyles as styles } from './mediaPlayerStyles';

export function InlinePreviewTopActions({ controls, muted, videoOnlyMode, handleMuteAction, showLiveBadge }) {
  const displayLiveBadge = Boolean(showLiveBadge ?? controls?.liveBadge ?? controls?.livePill ?? controls?.liveButton ?? false);
  return (
    <View style={styles.inlinePreviewTopRow} pointerEvents="box-none">
      {displayLiveBadge ? (
        <View style={styles.inlineLiveBadge} pointerEvents="none">
          <View style={styles.inlineLiveDot} />
          <Text style={styles.inlineLiveText}>LIVE</Text>
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
          <PlayerIcon name={muted || videoOnlyMode ? 'mute' : 'unmute'} size={19} color="#FFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function InlinePreviewCenterAction({ controls, colors, isPlaying, handlePlayPauseAction }) {
  return (
    <View style={styles.inlinePreviewCenterControls} pointerEvents="box-none">
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
          <PlayerIcon name={isPlaying ? 'pause' : 'play'} size={27} color="#FFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function InlinePreviewBottomActions({
  controls, title, showInlineChatButton, showLiveChat, handlePanelAction,
  isFullscreen, handleFullscreenAction, invokeAction, onPromotePreview, mediaId,
}) {
  return (
    <View style={styles.inlinePreviewBottomRow} pointerEvents="box-none">
      <Text style={styles.inlinePreviewTitle} numberOfLines={1} pointerEvents="none">{title || 'Live TV'}</Text>
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
            <PlayerIcon name="comment-text-outline" size={17} color="#FFF" />
            <Text style={styles.inlineChatButtonText}>Live Chat</Text>
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
              else invokeAction('onFullscreen', onPromotePreview, { title, mediaId });
            }}
          >
            <PlayerIcon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={20} color="#FFF" />
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
  handlePlayPauseAction, showInlineChatButton, showLiveChat, handlePanelAction,
  isFullscreen, handleFullscreenAction, invokeAction, mediaId, isLoading,
  errorMessage, showLiveBadge, children,
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
            onPress={onPromotePreview}
          />
          <InlinePreviewTopActions controls={controls} muted={muted} videoOnlyMode={videoOnlyMode} handleMuteAction={handleMuteAction} showLiveBadge={showLiveBadge} />
          {!isLoading ? (
            <InlinePreviewCenterAction controls={controls} colors={colors} isPlaying={isPlaying} handlePlayPauseAction={handlePlayPauseAction} />
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
          />
          <InlinePreviewFeedback isLoading={isLoading} errorMessage={errorMessage} />
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}
