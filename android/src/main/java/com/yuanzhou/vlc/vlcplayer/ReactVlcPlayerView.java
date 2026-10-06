package com.yuanzhou.vlc.vlcplayer;

import android.annotation.SuppressLint;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.SurfaceTexture;
import android.media.AudioManager;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.SystemClock;
import android.os.PowerManager;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;
import android.view.TextureView;
import android.view.View;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.uimanager.ThemedReactContext;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.util.ArrayList;
import java.util.List;
import org.videolan.libvlc.Dialog;
import org.videolan.libvlc.LibVLC;
import org.videolan.libvlc.Media;
import org.videolan.libvlc.MediaPlayer;
import org.videolan.libvlc.interfaces.IVLCVout;

@SuppressLint("ViewConstructor")
class ReactVlcPlayerView extends TextureView
    implements LifecycleEventListener,
        TextureView.SurfaceTextureListener,
        AudioManager.OnAudioFocusChangeListener {

  private static final String TAG = "ReactVlcPlayerView";
  private static final String EVENT_PROP_DURATION = "duration";
  private static final String EVENT_PROP_SUCCESS = "success";
  private static final String EVENT_PROP_ERROR = "error";
  private static final String EVENT_PROP_IS_RECORDING = "isRecording";
  private static final String EVENT_PROP_RECORD_PATH = "recordPath";
  private static final String EVENT_PROP_OPERATION = "operation";
  private static final String EVENT_PROP_REQUEST_ACCEPTED = "requestAccepted";
  private static final String EVENT_TYPE_RECORDING_PATH = "RecordingPath";
  private static final String SOURCE_KEY_START_TIME = "startTime";
  private static final String FILE_URI_SCHEME = "file://";

  private final VideoEventEmitter eventEmitter;
  private LibVLC libvlc;
  private MediaPlayer mMediaPlayer = null;
  private boolean mMuted = false;
  private boolean isSurfaceViewDestory;
  private String src;
  private String subtitleUri;
  private String recordingPath;
  private String lastRecordingCandidatePath;
  private long lastRecordingCandidateSize = -1;
  private int stableRecordingCandidateSamples;
  private int recordingStopVerificationAttempts;
  private boolean recordingStopRequested;
  private boolean recordingStopEventEmitted;
  private Runnable recordingStopVerificationRunnable;
  private ReadableMap srcMap;
  private long pendingSeekTimeMs = -1;
  private long pendingSeekAttemptAtMs = 0;
  private int mVideoHeight = 0;
  private int mVideoWidth = 0;
  private int mVideoVisibleHeight = 0;
  private int mVideoVisibleWidth = 0;
  private int mSarNum = 0;
  private int mSarDen = 0;

  private boolean isPaused = true;
  private boolean isHostPaused = false;
  private boolean playInBackground = false;
  private boolean repeatEnabled = false;
  // Keep the requested volume separate from the mute state. React may apply
  // the `volume` and `muted` props in either order during the same update.
  private int mVolume = 100;
  private boolean autoAspectRatio = false;
  private boolean acceptInvalidCertificates = false;

  private float mProgressUpdateInterval = 0;
  private Handler mProgressUpdateHandler = new Handler();
  private Runnable mProgressUpdateRunnable = null;

  private final ThemedReactContext themedReactContext;
  private final AudioManager audioManager;

  private String mVideoInfoHash = null;

  public ReactVlcPlayerView(ThemedReactContext context) {
    super(context);
    // VLC updates this SurfaceTexture independently of the React Native view
    // tree. Do not let Android optimize it as an opaque child: after inline
    // controls are removed that optimization can retain stale dirty regions
    // as translucent rectangles over later video frames.
    setOpaque(false);
    this.eventEmitter = new VideoEventEmitter(context);
    this.themedReactContext = context;
    audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    this.setSurfaceTextureListener(this);

    this.addOnLayoutChangeListener(onLayoutChangeListener);
    context.addLifecycleEventListener(this);
  }

  @Override
  public void setId(int id) {
    super.setId(id);
    eventEmitter.setViewId(id);
  }

  @Override
  protected void onAttachedToWindow() {
    super.onAttachedToWindow();
  }

  @Override
  protected void onDetachedFromWindow() {
    super.onDetachedFromWindow();
    stopPlayback();
  }

  private PowerManager.WakeLock wakeLock = null;

  private void acquireWakeLock() {
    if (wakeLock == null) {
      try {
        PowerManager pm = (PowerManager) themedReactContext.getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
          wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CineCrew:VLCBackgroundAudio");
          wakeLock.setReferenceCounted(false);
        }
      } catch (Exception e) {
        Log.e(TAG, "Failed to create WakeLock", e);
      }
    }
    if (wakeLock != null && !wakeLock.isHeld()) {
      try {
        wakeLock.acquire(3 * 60 * 60 * 1000L);
      } catch (Exception e) {
        Log.e(TAG, "Failed to acquire WakeLock", e);
      }
    }
  }

  private void releaseWakeLock() {
    if (wakeLock != null && wakeLock.isHeld()) {
      try {
        wakeLock.release();
      } catch (Exception e) {
        Log.e(TAG, "Failed to release WakeLock", e);
      }
    }
  }

  // LifecycleEventListener implementation

  @Override
  public void onHostResume() {
    if (mMediaPlayer == null || !isHostPaused) {
      return;
    }

    if (playInBackground) {
      if (isSurfaceViewDestory && getSurfaceTexture() != null) {
        attachVideoSurface();
      }
      isHostPaused = false;
      if (!isPaused) {
        mMediaPlayer.play();
        acquireWakeLock();
      }
      return;
    }

    if (isSurfaceViewDestory) {
      attachVideoSurface();
      isHostPaused = false;
      isPaused = false;
      mMediaPlayer.play();
    }
  }

  @Override
  public void onHostPause() {
    if (playInBackground) {
      if (!isPaused && mMediaPlayer != null) {
        // Keep VLC alive for audio-only playback while Android locks
        // the screen or sends the activity to the background.
        isHostPaused = true;
        IVLCVout vlcOut = mMediaPlayer.getVLCVout();
        if (vlcOut != null && vlcOut.areViewsAttached()) {
          vlcOut.detachViews();
        }
        acquireWakeLock();
      }
      return;
    }

    releaseWakeLock();
    if (!isPaused && mMediaPlayer != null) {
      isPaused = true;
      isHostPaused = true;
      mMediaPlayer.pause();
      WritableMap map = Arguments.createMap();
      map.putString("type", "Paused");
      eventEmitter.onVideoStateChange(map);
    }
  }

  @Override
  public void onHostDestroy() {
    releaseWakeLock();
    stopPlayback();
  }

  // AudioManager.OnAudioFocusChangeListener implementation
  @Override
  public void onAudioFocusChange(int focusChange) {
    // VLC owns native audio focus; the component does not apply ducking or
    // pause policy from Android's focus callback.
  }

  private void setProgressUpdateRunnable() {
    if (mMediaPlayer == null || mProgressUpdateInterval <= 0) {
      return;
    }

    mProgressUpdateRunnable =
        () -> {
          applyPendingSeekTime();
          if (mMediaPlayer != null && !isPaused) {
            WritableMap map = Arguments.createMap();
            map.putBoolean("isPlaying", mMediaPlayer.isPlaying());
            map.putDouble("position", mMediaPlayer.getPosition());
            map.putDouble("currentTime", mMediaPlayer.getTime());
            map.putDouble(EVENT_PROP_DURATION, mMediaPlayer.getLength());
            updateVideoInfo();
            eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_PROGRESS);
          }

          mProgressUpdateHandler.postDelayed(
              mProgressUpdateRunnable, Math.round(mProgressUpdateInterval));
        };
    mProgressUpdateHandler.postDelayed(mProgressUpdateRunnable, 0);
  }

  /*************
   * Events  Listener
   *************/

  private View.OnLayoutChangeListener onLayoutChangeListener =
      new View.OnLayoutChangeListener() {

        @Override
        public void onLayoutChange(
            View view, int i, int i1, int i2, int i3, int i4, int i5, int i6, int i7) {
          if (view.getWidth() > 0 && view.getHeight() > 0) {
            mVideoWidth = view.getWidth(); // 获取宽度
            mVideoHeight = view.getHeight(); // 获取高度
            if (mMediaPlayer != null) {
              IVLCVout vlcOut = mMediaPlayer.getVLCVout();
              vlcOut.setWindowSize(mVideoWidth, mVideoHeight);
              if (autoAspectRatio) {
                mMediaPlayer.setAspectRatio(mVideoWidth + ":" + mVideoHeight);
              }
            }
          }
        }
      };

  /** 播放过程中的时间事件监听 */
  private MediaPlayer.EventListener mPlayerListener =
      new MediaPlayer.EventListener() {
        long currentTime = 0;
        long totalLength = 0;

        private String getRecordingEventPath(boolean recording, String pathForEvent) {
          if (recording) {
            return pathForEvent;
          }
          return findCompletedRecordingPath(pathForEvent);
        }

        @Override
        public void onEvent(MediaPlayer.Event event) {
          if (mMediaPlayer == null) {
            return;
          }
          applyPendingSeekTime();
          boolean isPlaying = mMediaPlayer.isPlaying();
          currentTime = mMediaPlayer.getTime();
          float position = mMediaPlayer.getPosition();
          totalLength = mMediaPlayer.getLength();
          WritableMap map = Arguments.createMap();
          map.putBoolean("isPlaying", isPlaying);
          map.putDouble("position", position);
          map.putDouble("currentTime", currentTime);
          map.putDouble(EVENT_PROP_DURATION, totalLength);

          switch (event.type) {
            case MediaPlayer.Event.EndReached:
              map.putString("type", "Ended");
              if (repeatEnabled) {
                mMediaPlayer.setTime(0);
                mMediaPlayer.play();
              } else {
                eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_END);
              }
              break;
            case MediaPlayer.Event.Playing:
              map.putString("type", "Playing");
              eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_ON_IS_PLAYING);
              break;
            case MediaPlayer.Event.Opening:
              map.putString("type", "Opening");
              eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_ON_OPEN);
              break;
            case MediaPlayer.Event.Paused:
              map.putString("type", "Paused");
              eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_ON_PAUSED);
              break;
            case MediaPlayer.Event.Buffering:
              map.putDouble("bufferRate", event.getBuffering());
              map.putString("type", "Buffering");
              eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_ON_VIDEO_BUFFERING);
              break;
            case MediaPlayer.Event.Stopped:
              map.putString("type", "Stopped");
              eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_ON_VIDEO_STOPPED);
              break;
            case MediaPlayer.Event.EncounteredError:
              map.putString("type", "Error");
              eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_ON_ERROR);

              break;
            case MediaPlayer.Event.TimeChanged:
              map.putString("type", "TimeChanged");
              eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_SEEK);
              break;
            case MediaPlayer.Event.RecordChanged:
              map.putString("type", EVENT_TYPE_RECORDING_PATH);
              map.putBoolean(EVENT_PROP_IS_RECORDING, event.getRecording());
              String eventPath = event.getRecordPath();
              String pathForEvent = eventPath != null ? eventPath : recordingPath;
              String completedPath = getRecordingEventPath(event.getRecording(), pathForEvent);
              if (completedPath != null) {
                map.putString(EVENT_PROP_RECORD_PATH, completedPath);
              }
              if (event.getRecording()) {
                eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_RECORDING_STATE);
              } else {
                completeRecordingStop(completedPath, map);
              }
              break;
            default:
              map.putString("type", event.type + "");
              eventEmitter.onVideoStateChange(map);
              break;
          }
        }
      };

  private IVLCVout.OnNewVideoLayoutListener onNewVideoLayoutListener =
      new IVLCVout.OnNewVideoLayoutListener() {
        @Override
        public void onNewVideoLayout(
            IVLCVout vout,
            int width,
            int height,
            int visibleWidth,
            int visibleHeight,
            int sarNum,
            int sarDen) {
          if (width * height == 0) {
            return;
          }
          // store video size
          mVideoWidth = width;
          mVideoHeight = height;
          mVideoVisibleWidth = visibleWidth;
          mVideoVisibleHeight = visibleHeight;
          mSarNum = sarNum;
          mSarDen = sarDen;
          WritableMap map = Arguments.createMap();
          map.putInt("mVideoWidth", mVideoWidth);
          map.putInt("mVideoHeight", mVideoHeight);
          map.putInt("mVideoVisibleWidth", mVideoVisibleWidth);
          map.putInt("mVideoVisibleHeight", mVideoVisibleHeight);
          map.putInt("mSarNum", mSarNum);
          map.putInt("mSarDen", mSarDen);
          map.putString("type", "onNewVideoLayout");
          eventEmitter.onVideoStateChange(map);
        }
      };

  IVLCVout.Callback callback =
      new IVLCVout.Callback() {
        @Override
        public void onSurfacesCreated(IVLCVout ivlcVout) {
          isSurfaceViewDestory = false;
        }

        @Override
        public void onSurfacesDestroyed(IVLCVout ivlcVout) {
          isSurfaceViewDestory = true;
        }
      };

  /*************
   * MediaPlayer
   *************/

  private void stopPlayback() {
    onStopPlayback();
    releasePlayer();
  }

  private void onStopPlayback() {
    setKeepScreenOn(false);
    audioManager.abandonAudioFocus(this);
  }

  private void attachVideoSurface() {
    if (mMediaPlayer == null || getSurfaceTexture() == null) {
      return;
    }

    IVLCVout vlcOut = mMediaPlayer.getVLCVout();
    if (vlcOut.areViewsAttached()) {
      vlcOut.detachViews();
    }
    vlcOut.setVideoSurface(getSurfaceTexture());
    vlcOut.attachViews(onNewVideoLayoutListener);
    isSurfaceViewDestory = false;
  }

  private void createPlayer(boolean autoplayResume, boolean isResume) {
    releasePlayer();
    if (getSurfaceTexture() == null) {
      return;
    }

    try {
      initializePlayer(autoplayResume, isResume);
      eventEmitter.loadStart();
      setProgressUpdateRunnable();
    } catch (Exception e) {
      eventEmitter.error("Failed to create VLC player", e);
    }
  }

  private void initializePlayer(boolean autoplayResume, boolean isResume) {
    ArrayList<String> initOptions = getStringOptions("initOptions");
    int initType = srcMap.hasKey("initType") ? srcMap.getInt("initType") : 1;
    libvlc = initType == 1 ? new LibVLC(getContext()) : new LibVLC(getContext(), initOptions);
    mMediaPlayer = new MediaPlayer(libvlc);
    setMutedModifier(mMuted);
    mMediaPlayer.setEventListener(mPlayerListener);
    registerDialogCallbacks();

    IVLCVout vlcOut = mMediaPlayer.getVLCVout();
    configureSurfaceSize(vlcOut);
    configureMedia(getMedia());
    attachSurfaceIfNeeded(vlcOut);
    startPlayerIfNeeded(autoplayResume, isResume);
  }

  private ArrayList<String> getStringOptions(String key) {
    ArrayList<String> options = new ArrayList<>();
    ReadableArray values = srcMap.hasKey(key) ? srcMap.getArray(key) : null;
    if (values == null) {
      return options;
    }
    for (int index = 0; index < values.size(); index++) {
      options.add(values.getString(index));
    }
    return options;
  }

  private void registerDialogCallbacks() {
    Dialog.setCallbacks(
        libvlc,
        new Dialog.Callbacks() {
          @Override
          public void onDisplay(Dialog.QuestionDialog dialog) {
            handleCertificateDialog(dialog);
          }

          @Override
          public void onDisplay(Dialog.ErrorMessage dialog) {
            // VLC's default error dialog behavior is intentionally retained.
          }

          @Override
          public void onDisplay(Dialog.LoginDialog dialog) {
            // VLC's default login dialog behavior is intentionally retained.
          }

          @Override
          public void onDisplay(Dialog.ProgressDialog dialog) {
            // VLC's default progress dialog behavior is intentionally retained.
          }

          @Override
          public void onCanceled(Dialog dialog) {
            // There is no app-side state to restore when VLC cancels a dialog.
          }

          @Override
          public void onProgressUpdate(Dialog.ProgressDialog dialog) {
            // VLC owns progress presentation; no bridge update is needed here.
          }
        });
  }

  private void configureSurfaceSize(IVLCVout vlcOut) {
    if (mVideoWidth <= 0 || mVideoHeight <= 0) {
      return;
    }
    vlcOut.setWindowSize(mVideoWidth, mVideoHeight);
    if (autoAspectRatio) {
      mMediaPlayer.setAspectRatio(mVideoWidth + ":" + mVideoHeight);
    }
  }

  private Media getMedia() {
    String uriString = srcMap.hasKey("uri") ? srcMap.getString("uri") : null;
    boolean isNetwork = srcMap.hasKey("isNetwork") && srcMap.getBoolean("isNetwork");
    boolean useUri =
        isNetwork
            || (uriString != null
                && (uriString.startsWith(FILE_URI_SCHEME) || uriString.startsWith("content://")));
    Media media;
    if (useUri) {
      media = new Media(libvlc, Uri.parse(uriString));
    } else {
      media = new Media(libvlc, uriString);
    }
    applyHardwareDecoder(media);
    for (String option : getStringOptions("mediaOptions")) {
      media.addOption(option);
    }
    if (pendingSeekTimeMs > 0) {
      media.addOption(":start-time=" + (pendingSeekTimeMs / 1000.0));
    }
    return media;
  }

  private void applyHardwareDecoder(Media media) {
    if (!srcMap.hasKey("hwDecoderEnabled") || !srcMap.hasKey("hwDecoderForced")) {
      return;
    }
    media.setHWDecoderEnabled(
        srcMap.getInt("hwDecoderEnabled") >= 1, srcMap.getInt("hwDecoderForced") >= 1);
  }

  private void configureMedia(Media media) {
    mVideoInfoHash = null;
    mMediaPlayer.setMedia(media);
    media.release();
    mMediaPlayer.setScale(0);
    if (subtitleUri != null) {
      mMediaPlayer.addSlave(Media.Slave.Type.Subtitle, subtitleUri, true);
    }
  }

  private void attachSurfaceIfNeeded(IVLCVout vlcOut) {
    if (vlcOut.areViewsAttached()) {
      return;
    }
    vlcOut.addCallback(callback);
    vlcOut.setVideoSurface(getSurfaceTexture());
    vlcOut.attachViews(onNewVideoLayoutListener);
  }

  private void startPlayerIfNeeded(boolean autoplayResume, boolean isResume) {
    boolean shouldPlay =
        isResume ? autoplayResume : !srcMap.hasKey("autoplay") || srcMap.getBoolean("autoplay");
    if (!shouldPlay) {
      return;
    }
    isPaused = false;
    mMediaPlayer.play();
  }

  private void releasePlayer() {
    if (libvlc == null) {
      mMediaPlayer = null;
      return;
    }

    if (mMediaPlayer != null) {
      // TextureView recreation must retain the current timeline, not reopen
      // the source at zero or at its original startTime.
      if (pendingSeekTimeMs < 0 && mMediaPlayer.getTime() > 0) {
        pendingSeekTimeMs = mMediaPlayer.getTime();
        pendingSeekAttemptAtMs = 0;
      }
      mMediaPlayer.setEventListener(null);
      final IVLCVout vout = mMediaPlayer.getVLCVout();
      vout.removeCallback(callback);
      vout.detachViews();
      mMediaPlayer.release();
    }
    mMediaPlayer = null;
    libvlc.release();
    libvlc = null;
    releaseWakeLock();

    if (mProgressUpdateRunnable != null) {
      mProgressUpdateHandler.removeCallbacks(mProgressUpdateRunnable);
    }
  }

  /**
   * 视频进度调整
   *
   * @param position
   */
  public void setPosition(float position) {
    if (mMediaPlayer != null && position >= 0 && position <= 1) {
      pendingSeekTimeMs = -1;
      pendingSeekAttemptAtMs = 0;
      mMediaPlayer.setPosition(position);
    }
  }

  public void seekTo(double seconds) {
    if (Double.isNaN(seconds) || Double.isInfinite(seconds) || seconds < 0) {
      return;
    }
    long target = Math.round(seconds * 1000);
    if (pendingSeekTimeMs != target) {
      pendingSeekTimeMs = target;
      pendingSeekAttemptAtMs = 0;
    }
    applyPendingSeekTime();
  }

  private void applyPendingSeekTime() {
    if (mMediaPlayer == null || pendingSeekTimeMs < 0) {
      return;
    }
    long length = mMediaPlayer.getLength();
    long target = length > 0 ? Math.min(pendingSeekTimeMs, length - 1) : pendingSeekTimeMs;
    long currentTime = mMediaPlayer.getTime();
    if (currentTime >= 0 && Math.abs(currentTime - target) <= 500) {
      pendingSeekTimeMs = -1;
      pendingSeekAttemptAtMs = 0;
      return;
    }
    // Opening/Playing can arrive before the demuxer permits seeking. Keep
    // the absolute timestamp until VLC reports it, independent of duration.
    if (!mMediaPlayer.isSeekable()) {
      return;
    }
    long now = SystemClock.uptimeMillis();
    if (pendingSeekAttemptAtMs > 0 && now - pendingSeekAttemptAtMs < 500) {
      return;
    }
    pendingSeekAttemptAtMs = now;
    mMediaPlayer.setTime(target);
  }

  public void restartPlayback() {
    pendingSeekTimeMs = -1;
    pendingSeekAttemptAtMs = 0;
    if (mMediaPlayer == null) {
      return;
    }
    isPaused = false;
    mMediaPlayer.setTime(0);
    mMediaPlayer.play();
    if (playInBackground) {
      acquireWakeLock();
    }
  }

  public void setAudioState(boolean muted, int volume) {
    mMuted = muted;
    mVolume = Math.max(0, Math.min(100, volume));
    if (mMediaPlayer != null) {
      mMediaPlayer.setVolume(mMuted ? 0 : mVolume);
    }
  }

  public void setSubtitleUri(String subtitleUri) {
    this.subtitleUri = subtitleUri;
    if (mMediaPlayer != null) {
      mMediaPlayer.addSlave(Media.Slave.Type.Subtitle, this.subtitleUri, true);
    }
  }

  /**
   * 设置资源路径
   *
   * @param uri
   * @param isNetStr
   */
  public void setSrc(String uri, boolean isNetStr, boolean autoplay) {
    if (mMediaPlayer != null && uri != null && uri.equals(this.src)) {
      return;
    }
    this.src = uri;
    createPlayer(autoplay, false);
  }

  public void setSrc(ReadableMap src) {
    if (src == null || !src.hasKey("uri") || src.isNull("uri")) {
      return;
    }

    String nextUri = src.getString("uri");
    boolean sameSource = srcMap != null
        && srcMap.hasKey("uri")
        && !srcMap.isNull("uri")
        && nextUri != null
        && nextUri.equals(srcMap.getString("uri"));
    if (mMediaPlayer != null && sameSource) {
      // React Native may resend the source map when an unrelated prop
      // changes (for example volume). Do not restart the media item.
      srcMap = src;
      return;
    }

    if (!sameSource) {
      // Release before assigning the new seek so the previous source's
      // playback time cannot replace this source's requested startTime.
      releasePlayer();
      double startTime = getRequestedStartTime(src);
      pendingSeekTimeMs = startTime > 0 && !Double.isInfinite(startTime)
          ? Math.round(startTime * 1000) : -1;
      pendingSeekAttemptAtMs = 0;
    }

    this.srcMap = src;
    createPlayer(true, false);
  }

  private double getRequestedStartTime(ReadableMap source) {
    if (!source.hasKey(SOURCE_KEY_START_TIME) || source.isNull(SOURCE_KEY_START_TIME)) {
      return 0;
    }
    return source.getDouble(SOURCE_KEY_START_TIME);
  }

  /**
   * 改变播放速率
   *
   * @param rateModifier
   */
  public void setRateModifier(float rateModifier) {
    if (mMediaPlayer != null) {
      mMediaPlayer.setRate(rateModifier);
    }
  }

  public void setmProgressUpdateInterval(float interval) {
    if (Float.compare(mProgressUpdateInterval, interval) == 0) {
      return;
    }
    mProgressUpdateInterval = interval;
    if (mProgressUpdateRunnable != null) {
      mProgressUpdateHandler.removeCallbacks(mProgressUpdateRunnable);
    }
    if (mMediaPlayer != null && mProgressUpdateInterval > 0) {
      setProgressUpdateRunnable();
    }
  }

  /**
   * 改变声音大小
   *
   * @param volumeModifier
   */
  public void setVolumeModifier(int volumeModifier) {
    mVolume = Math.max(0, Math.min(100, volumeModifier));
    if (mMediaPlayer != null) {
      mMediaPlayer.setVolume(mMuted ? 0 : mVolume);
    }
  }

  /**
   * 改变静音状态
   *
   * @param muted
   */
  public void setMutedModifier(boolean muted) {
    mMuted = muted;
    if (mMediaPlayer != null) {
      mMediaPlayer.setVolume(muted ? 0 : mVolume);
    }
  }

  /**
   * 改变播放状态
   *
   * @param paused
   */
  public void setPausedModifier(boolean paused) {
    if (mMediaPlayer != null) {
      if (paused) {
        isPaused = true;
        releaseWakeLock();
        mMediaPlayer.pause();
      } else {
        isPaused = false;
        if (playInBackground) {
          acquireWakeLock();
        }
        mMediaPlayer.play();
      }
    } else {
      createPlayer(!paused, false);
    }
  }

  /**
   * Take a screenshot of the current video frame
   *
   * @param path The file path where to save the screenshot
   * @return boolean indicating if the screenshot was taken successfully
   */
  public boolean doSnapshot(String path) {
    if (mMediaPlayer != null) {
      try {
        Bitmap bitmap = getBitmap();
        if (bitmap == null) {
          WritableMap event = Arguments.createMap();
          event.putBoolean(EVENT_PROP_SUCCESS, false);
          event.putString(EVENT_PROP_ERROR, "Failed to capture bitmap");
          eventEmitter.sendEvent(event, VideoEventEmitter.EVENT_ON_SNAPSHOT);
          return false;
        }

        File file = new File(path);
        file.getParentFile().mkdirs();

        FileOutputStream out = new FileOutputStream(file);

        String extension = path.substring(path.lastIndexOf(".") + 1);
        if (extension.equals("png")) {
          bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
        } else {
          bitmap.compress(Bitmap.CompressFormat.JPEG, 100, out);
        }
        out.flush();
        out.close();

        bitmap.recycle();

        WritableMap event = Arguments.createMap();
        event.putBoolean(EVENT_PROP_SUCCESS, true);
        event.putString("path", path);
        eventEmitter.sendEvent(event, VideoEventEmitter.EVENT_ON_SNAPSHOT);
        return true;
      } catch (Exception e) {
        WritableMap event = Arguments.createMap();
        event.putBoolean(EVENT_PROP_SUCCESS, false);
        event.putString(EVENT_PROP_ERROR, e.getMessage());
        eventEmitter.sendEvent(event, VideoEventEmitter.EVENT_ON_SNAPSHOT);
        return false;
      }
    }
    WritableMap event = Arguments.createMap();
    event.putBoolean(EVENT_PROP_SUCCESS, false);
    event.putString(EVENT_PROP_ERROR, "MediaPlayer is null");
    eventEmitter.sendEvent(event, VideoEventEmitter.EVENT_ON_SNAPSHOT);
    return false;
  }

  /**
   * 重新加载视频
   *
   * @param autoplay
   */
  public void doResume(boolean autoplay) {
    createPlayer(autoplay, true);
  }

  public void setRepeatModifier(boolean repeat) {
    repeatEnabled = repeat;
  }

  /**
   * 改变宽高比
   *
   * @param aspectRatio
   */
  public void setAspectRatio(String aspectRatio) {
    if (mMediaPlayer != null) {
      if (aspectRatio == null
          || aspectRatio.isEmpty()
          || "FIT".equalsIgnoreCase(aspectRatio)
          || "FIT_SCREEN".equalsIgnoreCase(aspectRatio)) {
        mMediaPlayer.setAspectRatio(null);
        mMediaPlayer.setScale(0);
      } else {
        mMediaPlayer.setAspectRatio(aspectRatio);
      }
    }
  }

  public void setAutoAspectRatio(boolean auto) {
    autoAspectRatio = auto;
  }

  public void setPlayInBackground(boolean play) {
    playInBackground = play;
    if (play && !isPaused) {
      acquireWakeLock();
    } else if (!play) {
      releaseWakeLock();
    }
  }

  public void setPlayWhenInactive(boolean play) {
    setPlayInBackground(play);
  }

  public void setAudioTrack(int track) {
    if (mMediaPlayer != null) {
      mMediaPlayer.setAudioTrack(track);
    }
  }

  public void setTextTrack(int track) {
    if (mMediaPlayer != null) {
      mMediaPlayer.setSpuTrack(track);
    }
  }

  public void startRecording(String recordingPath) {
    File targetDirectory = null;
    String error = null;
    try {
      targetDirectory = resolveRecordingDirectory(recordingPath);
    } catch (IOException exception) {
      error = exception.getMessage();
    }
    String targetPath = null;
    if (targetDirectory != null) {
      targetPath = targetDirectory.getAbsolutePath();
    }
    boolean accepted = mMediaPlayer != null && targetPath != null && mMediaPlayer.record(targetPath);
    if (accepted) {
      this.recordingPath = targetPath;
      recordingStopRequested = false;
      recordingStopEventEmitted = false;
      clearRecordingStopVerification();
    }
    WritableMap map = Arguments.createMap();
    map.putString(EVENT_PROP_OPERATION, "start");
    map.putBoolean(EVENT_PROP_REQUEST_ACCEPTED, accepted);
    map.putBoolean(EVENT_PROP_IS_RECORDING, accepted);
    if (!accepted) {
      map.putString(EVENT_PROP_ERROR, error != null ? error : "VLC rejected the recording request for this media source.");
    }
    if (targetPath != null) {
      map.putString(EVENT_PROP_RECORD_PATH, targetPath);
    }
    eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_RECORDING_STATE);
  }

  public void stopRecording() {
    boolean accepted = mMediaPlayer != null && mMediaPlayer.record(null);
    WritableMap map = Arguments.createMap();
    map.putString(EVENT_PROP_OPERATION, "stop");
    map.putBoolean(EVENT_PROP_REQUEST_ACCEPTED, accepted);
    // Keep the logical recording state active until LibVLC emits its final
    // RecordChanged event, which is when the output file is actually closed.
    map.putBoolean(EVENT_PROP_IS_RECORDING, true);
    if (this.recordingPath != null) {
      map.putString(EVENT_PROP_RECORD_PATH, this.recordingPath);
    }
    if (!accepted) {
      map.putString(EVENT_PROP_ERROR, "VLC rejected the request to stop recording.");
    } else {
      recordingStopRequested = true;
      recordingStopEventEmitted = false;
      resetRecordingCandidateObservation();
      scheduleRecordingStopVerification();
    }
    eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_RECORDING_STATE);
  }

  private void scheduleRecordingStopVerification() {
    clearRecordingStopVerification();
    recordingStopVerificationAttempts = 0;
    recordingStopVerificationRunnable = new Runnable() {
      @Override
      public void run() {
        if (!recordingStopRequested || recordingStopEventEmitted) {
          return;
        }
        recordingStopVerificationAttempts += 1;
        String completedPath = findCompletedRecordingPath(recordingPath);
        String stablePath = observeRecordingCandidate(completedPath);
        if (stablePath != null) {
          emitCompletedRecording(stablePath);
          return;
        }
        if (recordingStopVerificationAttempts >= 30) {
          emitRecordingStopTimeout();
          return;
        }
        mProgressUpdateHandler.postDelayed(this, 750);
      }
    };
    mProgressUpdateHandler.postDelayed(recordingStopVerificationRunnable, 750);
  }

  private String observeRecordingCandidate(String completedPath) {
    if (completedPath == null) {
      resetRecordingCandidateObservation();
      return null;
    }
    File candidate = new File(completedPath);
    if (!candidate.isFile() || candidate.length() <= 0) {
      resetRecordingCandidateObservation();
      return null;
    }
    long candidateSize = candidate.length();
    String candidatePath = candidate.getAbsolutePath();
    if (candidatePath.equals(lastRecordingCandidatePath)
        && candidateSize == lastRecordingCandidateSize) {
      stableRecordingCandidateSamples += 1;
    } else {
      lastRecordingCandidatePath = candidatePath;
      lastRecordingCandidateSize = candidateSize;
      stableRecordingCandidateSamples = 1;
    }
    return stableRecordingCandidateSamples >= 4 ? candidatePath : null;
  }

  private void emitCompletedRecording(String candidatePath) {
    WritableMap completedEvent = Arguments.createMap();
    completedEvent.putString("type", EVENT_TYPE_RECORDING_PATH);
    completeRecordingStop(candidatePath, completedEvent);
  }

  private void emitRecordingStopTimeout() {
    WritableMap failedEvent = Arguments.createMap();
    failedEvent.putString("type", EVENT_TYPE_RECORDING_PATH);
    failedEvent.putString(EVENT_PROP_OPERATION, "stop");
    failedEvent.putBoolean(EVENT_PROP_IS_RECORDING, false);
    failedEvent.putBoolean(EVENT_PROP_REQUEST_ACCEPTED, false);
    failedEvent.putString(EVENT_PROP_ERROR, "VLC accepted the stop request but no completed recording file became available.");
    recordingStopRequested = false;
    recordingPath = null;
    clearRecordingStopVerification();
    eventEmitter.sendEvent(failedEvent, VideoEventEmitter.EVENT_RECORDING_STATE);
  }

  private void completeRecordingStop(String completedPath, WritableMap map) {
    if (recordingStopEventEmitted) {
      return;
    }
    map.putString(EVENT_PROP_OPERATION, "stop");
    map.putBoolean(EVENT_PROP_IS_RECORDING, false);
    File completedFile = completedPath == null ? null : new File(completedPath);
    if (completedFile != null && completedFile.isFile() && completedFile.length() > 0) {
      map.putString(EVENT_PROP_RECORD_PATH, completedFile.getAbsolutePath());
      map.putBoolean(EVENT_PROP_REQUEST_ACCEPTED, true);
      map.putDouble("size", completedFile.length());
    } else {
      map.putBoolean(EVENT_PROP_REQUEST_ACCEPTED, false);
      map.putString(EVENT_PROP_ERROR, "VLC stopped recording without creating a non-empty media file.");
    }
    recordingStopEventEmitted = true;
    recordingStopRequested = false;
    recordingPath = null;
    clearRecordingStopVerification();
    eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_RECORDING_STATE);
  }

  private void resetRecordingCandidateObservation() {
    lastRecordingCandidatePath = null;
    lastRecordingCandidateSize = -1;
    stableRecordingCandidateSamples = 0;
  }

  private void clearRecordingStopVerification() {
    if (recordingStopVerificationRunnable != null) {
      mProgressUpdateHandler.removeCallbacks(recordingStopVerificationRunnable);
      recordingStopVerificationRunnable = null;
    }
  }

  public void mergeRecordingSegments(ReadableArray inputPaths) {
    List<String> paths = getRecordingSegmentPaths(inputPaths);
    new Thread(() -> mergeRecordingSegmentsOnWorker(paths), "cinecrew-recording-merge").start();
  }

  private List<String> getRecordingSegmentPaths(ReadableArray inputPaths) {
    List<String> paths = new ArrayList<>();
    if (inputPaths == null) {
      return paths;
    }
    for (int index = 0; index < inputPaths.size(); index += 1) {
      if (!inputPaths.isNull(index)) {
        paths.add(inputPaths.getString(index));
      }
    }
    return paths;
  }

  private void mergeRecordingSegmentsOnWorker(List<String> paths) {
    RecordingMergeResult result;
    try {
      result = assembleRecordingSegments(paths);
    } catch (Exception exception) {
      String message = exception.getMessage();
      result = RecordingMergeResult.failure(
          message == null ? "Could not assemble recording segments." : message);
    }
    RecordingMergeResult completed = result;
    themedReactContext.runOnUiQueueThread(() -> emitRecordingMergeResult(completed));
  }

  private RecordingMergeResult assembleRecordingSegments(List<String> paths) throws IOException {
    if (paths.isEmpty()) {
      throw new IOException("No recording segments were provided.");
    }
    List<File> segments = validateRecordingSegments(paths);
    boolean mp4 = isMp4RecordingSegments(segments);
    File output = createMergedRecordingOutput(segments, mp4);
    try {
      if (mp4 && segments.size() > 1) {
        remuxMp4Segments(segments, output);
      } else {
        concatenateRecordingSegments(segments, output);
      }
      long size = output.length();
      if (size <= 0) {
        throw new IOException("VLC produced an empty recording.");
      }
      String publishedPath = publishRecordingToMediaStore(output);
      deleteTemporaryRecordingSegments(segments);
      if (publishedPath != null && publishedPath.startsWith("content://")) {
        deleteRecordingFileIfPresent(output, "remove the copied temporary recording");
      }
      return new RecordingMergeResult(
          output.getAbsolutePath(), publishedPath, output.getName(), size, null);
    } catch (IOException | RuntimeException exception) {
      deleteRecordingFileIfPresent(output, "remove an incomplete recording");
      throw exception;
    }
  }

  private List<File> validateRecordingSegments(List<String> paths) throws IOException {
    List<File> segments = new ArrayList<>();
    boolean transportStream = false;
    boolean mp4 = false;
    for (String path : paths) {
      File segment = new File(path);
      if (!segment.isFile() || segment.length() <= 0) {
        throw new IOException("A VLC recording segment is missing or empty: " + path);
      }
      segments.add(segment);
      transportStream |= path.toLowerCase().endsWith(".ts");
      mp4 |= path.toLowerCase().endsWith(".mp4");
    }
    if (transportStream && mp4) {
      throw new IOException("VLC returned mixed TS and MP4 recording segments; they cannot be combined safely.");
    }
    if (!transportStream && !mp4) {
      throw new IOException("VLC returned an unsupported recording container.");
    }
    return segments;
  }

  private boolean isMp4RecordingSegments(List<File> segments) {
    return segments.get(0).getName().toLowerCase().endsWith(".mp4");
  }

  private File createMergedRecordingOutput(List<File> segments, boolean mp4) throws IOException {
    File segmentDirectory = segments.get(0).getParentFile();
    File recordingsDirectory = segmentDirectory == null ? null : segmentDirectory.getParentFile();
    if (recordingsDirectory == null) {
      recordingsDirectory = segmentDirectory;
    }
    if (recordingsDirectory == null) {
      throw new IOException("Could not locate the recording output directory.");
    }
    String extension = mp4 ? ".mp4" : ".ts";
    String filename = "cinecrew-recording-" + System.currentTimeMillis() + extension;
    File output = new File(recordingsDirectory, filename);
    File parent = output.getParentFile();
    if (parent != null && !parent.exists() && !parent.mkdirs()) {
      throw new IOException("Could not create the recording output directory.");
    }
    return output;
  }

  private void concatenateRecordingSegments(List<File> segments, File output) throws IOException {
    try (FileOutputStream destination = new FileOutputStream(output, false)) {
      byte[] buffer = new byte[64 * 1024];
      for (File segment : segments) {
        try (FileInputStream source = new FileInputStream(segment)) {
          int read;
          while ((read = source.read(buffer)) >= 0) {
            destination.write(buffer, 0, read);
          }
        }
      }
      destination.getFD().sync();
    }
  }

  private void deleteTemporaryRecordingSegments(List<File> segments) {
    for (File segment : segments) {
      deleteRecordingFileIfPresent(segment, "remove a temporary recording segment");
    }
  }

  private void emitRecordingMergeResult(RecordingMergeResult result) {
    WritableMap map = Arguments.createMap();
    map.putString(EVENT_PROP_OPERATION, "merge");
    map.putBoolean(EVENT_PROP_REQUEST_ACCEPTED, result.error == null);
    map.putBoolean(EVENT_PROP_IS_RECORDING, false);
    String resultPath = result.publishedPath == null ? result.outputPath : result.publishedPath;
    if (resultPath != null) {
      map.putString(EVENT_PROP_RECORD_PATH, resultPath);
    }
    if (result.error == null) {
      map.putDouble("size", result.size);
      if (result.filename != null) {
        map.putString("filename", result.filename);
      }
      map.putString("location", "Downloads/CineCrew Recordings");
    } else {
      map.putString(EVENT_PROP_ERROR, result.error);
    }
    eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_RECORDING_STATE);
  }

  private File resolveRecordingDirectory(String requestedPath) throws IOException {
    File target;
    if (requestedPath == null || requestedPath.trim().isEmpty()) {
      File moviesDirectory = getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES);
      if (moviesDirectory == null) {
        moviesDirectory = getContext().getFilesDir();
      }
      File baseDirectory = new File(moviesDirectory, "CineCrew Recordings");
      target = new File(baseDirectory, "cinecrew-" + System.currentTimeMillis());
    } else {
      String path = requestedPath.startsWith(FILE_URI_SCHEME) ? Uri.parse(requestedPath).getPath() : requestedPath;
      File requested = new File(path);
      String name = requested.getName();
      if (name.matches("(?i).+\\.(ts|mp4|mkv|mov|avi)$")) {
        String directoryName = name.replaceFirst("(?i)\\.[^.]+$", "");
        target = new File(requested.getParentFile(), directoryName);
      } else {
        target = requested;
      }
    }
    if (target == null || (!(target.exists() && target.isDirectory()) && !target.mkdirs())) {
      throw new IOException("Could not create the recording output directory.");
    }
    if (!target.isDirectory()) {
      throw new IOException("The recording output path is not a directory.");
    }
    return target;
  }

  private String findCompletedRecordingPath(String eventPath) {
    File completed = findLatestRecordingFile(eventPath);
    if (completed == null) {
      completed = findLatestRecordingFile(recordingPath);
    }
    return completed == null ? null : completed.getAbsolutePath();
  }

  private File findLatestRecordingFile(String path) {
    if (path == null || path.trim().isEmpty()) {
      return null;
    }
    String filesystemPath = path.startsWith(FILE_URI_SCHEME) ? Uri.parse(path).getPath() : path;
    File candidate = new File(filesystemPath);
    if (candidate.isFile() && candidate.length() > 0) {
      return candidate;
    }
    if (!candidate.isDirectory()) {
      return null;
    }
    File[] children = candidate.listFiles();
    if (children == null) {
      return null;
    }
    return findLatestRecordingChild(children);
  }

  private File findLatestRecordingChild(File[] children) {
    File latest = null;
    for (File child : children) {
      File candidate = findRecordingCandidate(child);
      if (isMoreRecentRecording(candidate, latest)) {
        latest = candidate;
      }
    }
    return latest;
  }

  private File findRecordingCandidate(File child) {
    if (child.isDirectory()) {
      return findLatestRecordingFile(child.getAbsolutePath());
    }
    if (child.isFile() && child.length() > 0) {
      return child;
    }
    return null;
  }

  private boolean isMoreRecentRecording(File candidate, File current) {
    if (candidate == null) {
      return false;
    }
    return current == null || candidate.lastModified() > current.lastModified();
  }

  private void remuxMp4Segments(List<File> segments, File output) throws IOException {
    MediaMuxer muxer = null;
    MediaExtractor template = null;
    List<MediaExtractor> extractors = new ArrayList<>();
    boolean muxerStarted = false;
    try {
      template = new MediaExtractor();
      template.setDataSource(segments.get(0).getAbsolutePath());
      muxer = new MediaMuxer(output.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
      Mp4TrackLayout trackLayout = addMp4OutputTracks(template, muxer);
      muxer.start();
      muxerStarted = true;
      long outputBaseUs = 0;
      long[] lastTrackSampleUs = new long[trackLayout.trackMimes.size()];
      java.util.Arrays.fill(lastTrackSampleUs, -1);
      for (File segment : segments) {
        MediaExtractor extractor = new MediaExtractor();
        extractors.add(extractor);
        extractor.setDataSource(segment.getAbsolutePath());
        long declaredDurationUs = validateAndSelectMp4Tracks(extractor, trackLayout);
        SegmentTiming timing = writeMp4SegmentSamples(
            extractor, muxer, trackLayout.outputTrackIndices, trackLayout.trackMimes,
            lastTrackSampleUs, outputBaseUs);
        outputBaseUs += getNextMp4SegmentBase(timing.lastSampleUs, declaredDurationUs);
      }
      muxer.stop();
      muxerStarted = false;
    } catch (IOException exception) {
      throw exception;
    } catch (Exception exception) {
      throw new IOException(exception.getMessage() == null ? "Could not join the MP4 recording segments." : exception.getMessage(), exception);
    } finally {
      if (muxer != null) {
        if (muxerStarted) {
          try {
            muxer.stop();
          } catch (RuntimeException ignored) {
            // The muxer can already be stopped after a failed write or finalize call.
          }
        }
        muxer.release();
      }
      if (template != null) {
        template.release();
      }
      for (MediaExtractor extractor : extractors) {
        extractor.release();
      }
    }
  }

  private Mp4TrackLayout addMp4OutputTracks(MediaExtractor template, MediaMuxer muxer)
      throws IOException {
    int trackCount = template.getTrackCount();
    if (trackCount <= 0) {
      throw new IOException("The MP4 recording has no media tracks.");
    }
    List<String> trackMimes = new ArrayList<>();
    int[] outputTrackIndices = new int[trackCount];
    for (int track = 0; track < trackCount; track += 1) {
      MediaFormat format = template.getTrackFormat(track);
      trackMimes.add(format.getString(MediaFormat.KEY_MIME));
      outputTrackIndices[track] = muxer.addTrack(format);
    }
    return new Mp4TrackLayout(trackMimes, outputTrackIndices);
  }

  private long validateAndSelectMp4Tracks(MediaExtractor extractor, Mp4TrackLayout trackLayout)
      throws IOException {
    if (extractor.getTrackCount() != trackLayout.trackMimes.size()) {
      throw new IOException("The paused recording segments have different audio/video track layouts.");
    }
    long declaredDurationUs = 0;
    for (int track = 0; track < trackLayout.trackMimes.size(); track += 1) {
      MediaFormat format = extractor.getTrackFormat(track);
      if (!trackLayout.trackMimes.get(track).equals(format.getString(MediaFormat.KEY_MIME))) {
        throw new IOException("The paused recording segments use different codecs and cannot be joined.");
      }
      if (format.containsKey(MediaFormat.KEY_DURATION)) {
        declaredDurationUs = Math.max(declaredDurationUs, format.getLong(MediaFormat.KEY_DURATION));
      }
      extractor.selectTrack(track);
    }
    return declaredDurationUs;
  }

  private SegmentTiming writeMp4SegmentSamples(
      MediaExtractor extractor,
      MediaMuxer muxer,
      int[] outputTrackIndices,
      List<String> trackMimes,
      long[] lastTrackSampleUs,
      long outputBaseUs) throws IOException {
    ByteBuffer buffer = ByteBuffer.allocateDirect(1024 * 1024);
    MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
    long firstSampleUs = -1;
    long lastSampleUs = 0;
    int sourceTrack = extractor.getSampleTrackIndex();
    while (sourceTrack >= 0) {
      long sampleTimeUs = extractor.getSampleTime();
      if (sampleTimeUs < 0) {
        throw new IOException("A paused recording segment contains a sample without a valid timestamp.");
      }
      if (firstSampleUs < 0) {
        firstSampleUs = sampleTimeUs;
      }
      long sampleSize = extractor.getSampleSize();
      if (sampleSize > Integer.MAX_VALUE) {
        throw new IOException("A recording sample is too large to merge.");
      }
      if (sampleSize > buffer.capacity()) {
        buffer = ByteBuffer.allocateDirect((int) sampleSize);
      }
      buffer.clear();
      int read = extractor.readSampleData(buffer, 0);
      if (read < 0) {
        return requireSegmentSamples(firstSampleUs, lastSampleUs);
      }
      long segmentTimeUs = sampleTimeUs - firstSampleUs;
      if (segmentTimeUs < 0) {
        throw new IOException("A paused recording segment has out-of-order media timestamps.");
      }
      lastSampleUs = Math.max(lastSampleUs, segmentTimeUs);
      long outputSampleUs = makeTrackTimestampMonotonic(
          segmentTimeUs, outputBaseUs, sourceTrack, lastTrackSampleUs, trackMimes);
      bufferInfo.set(0, read, outputSampleUs, extractor.getSampleFlags());
      muxer.writeSampleData(outputTrackIndices[sourceTrack], buffer, bufferInfo);
      lastTrackSampleUs[sourceTrack] = outputSampleUs;
      extractor.advance();
      sourceTrack = extractor.getSampleTrackIndex();
    }
    return requireSegmentSamples(firstSampleUs, lastSampleUs);
  }

  private SegmentTiming requireSegmentSamples(long firstSampleUs, long lastSampleUs)
      throws IOException {
    if (firstSampleUs < 0) {
      throw new IOException("A paused recording segment contains no media samples.");
    }
    return new SegmentTiming(lastSampleUs);
  }

  private long makeTrackTimestampMonotonic(
      long segmentTimeUs,
      long outputBaseUs,
      int sourceTrack,
      long[] lastTrackSampleUs,
      List<String> trackMimes) throws IOException {
    long outputSampleUs = outputBaseUs + segmentTimeUs;
    if (lastTrackSampleUs[sourceTrack] < outputSampleUs) {
      return outputSampleUs;
    }
    long timestampRegressionUs = lastTrackSampleUs[sourceTrack] - outputSampleUs;
    if (timestampRegressionUs > 100_000) {
      throw new IOException(
          "The paused recording has a " + trackMimes.get(sourceTrack)
              + " timestamp regression of " + timestampRegressionUs
              + " microseconds; Android cannot safely mux these segments without losing sync.");
    }
    return lastTrackSampleUs[sourceTrack] + 1;
  }

  private long getNextMp4SegmentBase(long lastSampleUs, long declaredDurationUs) {
    long sampleDurationUs = lastSampleUs + 40_000;
    long boundedDeclaredDurationUs = 0;
    if (declaredDurationUs > 0 && declaredDurationUs <= lastSampleUs + 250_000) {
      boundedDeclaredDurationUs = declaredDurationUs;
    }
    return Math.max(sampleDurationUs, boundedDeclaredDurationUs);
  }

  private static final class Mp4TrackLayout {
    final List<String> trackMimes;
    final int[] outputTrackIndices;

    Mp4TrackLayout(List<String> trackMimes, int[] outputTrackIndices) {
      this.trackMimes = trackMimes;
      this.outputTrackIndices = outputTrackIndices;
    }
  }

  private static final class SegmentTiming {
    final long lastSampleUs;

    SegmentTiming(long lastSampleUs) {
      this.lastSampleUs = lastSampleUs;
    }
  }

  private static final class RecordingMergeResult {
    final String outputPath;
    final String publishedPath;
    final String filename;
    final long size;
    final String error;

    RecordingMergeResult(String outputPath, String publishedPath, String filename, long size, String error) {
      this.outputPath = outputPath;
      this.publishedPath = publishedPath;
      this.filename = filename;
      this.size = size;
      this.error = error;
    }

    static RecordingMergeResult failure(String error) {
      return new RecordingMergeResult(null, null, null, 0, error);
    }
  }

  private void deleteRecordingFileIfPresent(File file, String operation) {
    if (file == null) {
      return;
    }
    try {
      Files.delete(file.toPath());
    } catch (NoSuchFileException exception) {
      Log.d(TAG, "Recording cleanup target was already absent: " + file.getAbsolutePath());
    } catch (IOException exception) {
      Log.w(TAG, "Could not " + operation + ": " + file.getAbsolutePath(), exception);
    }
  }

  private String publishRecordingToMediaStore(File recordingFile) throws IOException {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      return recordingFile.getAbsolutePath();
    }
    ContentResolver resolver = getContext().getContentResolver();
    String extension = recordingFile.getName().toLowerCase().endsWith(".ts") ? ".ts" : ".mp4";
    ContentValues values = new ContentValues();
    values.put(MediaStore.Video.Media.DISPLAY_NAME, recordingFile.getName());
    values.put(MediaStore.Video.Media.MIME_TYPE, extension.equals(".ts") ? "video/mp2t" : "video/mp4");
    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/CineCrew Recordings");
    values.put(MediaStore.MediaColumns.IS_PENDING, 1);
    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
    if (uri == null) {
      throw new IOException("Android could not add the recording to Downloads.");
    }
    try (FileInputStream input = new FileInputStream(recordingFile);
         OutputStream output = resolver.openOutputStream(uri, "w")) {
      if (output == null) {
        throw new IOException("Android could not open the saved recording destination.");
      }
      byte[] buffer = new byte[64 * 1024];
      int read;
      while ((read = input.read(buffer)) >= 0) {
        output.write(buffer, 0, read);
      }
      output.flush();
      ContentValues published = new ContentValues();
      published.put(MediaStore.MediaColumns.IS_PENDING, 0);
      resolver.update(uri, published, null, null);
      return uri.toString();
    } catch (IOException exception) {
      resolver.delete(uri, null, null);
      throw exception;
    }
  }

  public void stopPlayer() {
    if (mMediaPlayer == null) {
      return;
    }
    mMediaPlayer.stop();
  }

  private void handleCertificateDialog(Dialog.QuestionDialog dialog) {
    String text = dialog.getText();

    // Check if it's a certificate validation dialog
    if (text != null
        && (text.contains("certificate")
            || text.contains("SSL")
            || text.contains("TLS")
            || text.contains("cert"))) {
      if (acceptInvalidCertificates) {
        // Auto-accept invalid certificate
        dialog.postAction(1); // Action 1 typically means "Accept"
      } else {
        // Reject invalid certificate (default secure behavior)
        dialog.postAction(2); // Action 2 typically means "Reject"
      }
    } else {
      // For non-certificate dialogs, dismiss
      dialog.dismiss();
    }
  }

  public void setAcceptInvalidCertificates(boolean accept) {
    this.acceptInvalidCertificates = accept;
  }

  public void cleanUpResources() {
    recordingStopRequested = false;
    clearRecordingStopVerification();
    removeOnLayoutChangeListener(onLayoutChangeListener);
    stopPlayback();
  }

  @Override
  public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {
    mVideoWidth = width;
    mVideoHeight = height;

    // Reuse the existing VLC media player after a lock-screen surface
    // recreation. Recreating it here restarts the stream at 00:00.
    if (playInBackground && mMediaPlayer != null) {
      attachVideoSurface();
      isHostPaused = false;
      if (!isPaused) {
        mMediaPlayer.play();
      }
      return;
    }

    createPlayer(true, false);
  }

  @Override
  public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {
    mVideoWidth = width;
    mVideoHeight = height;
    if (mMediaPlayer != null) {
      IVLCVout vlcOut = mMediaPlayer.getVLCVout();
      if (vlcOut != null) {
        vlcOut.setWindowSize(width, height);
      }
      if (autoAspectRatio) {
        mMediaPlayer.setAspectRatio(width + ":" + height);
      }
    }
  }

  @Override
  public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {
    isSurfaceViewDestory = true;
    if (playInBackground && mMediaPlayer != null) {
      IVLCVout vlcOut = mMediaPlayer.getVLCVout();
      if (vlcOut != null && vlcOut.areViewsAttached()) {
        vlcOut.detachViews();
      }
    }
    return true;
  }

  @Override
  public void onSurfaceTextureUpdated(SurfaceTexture surface) {
    // VLC renders frames directly to the texture; no per-frame Java work is needed.
  }

  private void updateVideoInfo() {
    if (mMediaPlayer == null) {
      return;
    }
    String currentHash = buildVideoInfoHash();
    if (currentHash.equals(mVideoInfoHash)) {
      return;
    }

    WritableMap info = Arguments.createMap();
    info.putDouble(EVENT_PROP_DURATION, mMediaPlayer.getLength());
    putTrackInfo(info, "audioTracks", mMediaPlayer.getAudioTracks());
    putTrackInfo(info, "textTracks", mMediaPlayer.getSpuTracks());
    putVideoSize(info, mMediaPlayer.getCurrentVideoTrack());
    eventEmitter.sendEvent(info, VideoEventEmitter.EVENT_ON_LOAD);
    mVideoInfoHash = currentHash;
  }

  private String buildVideoInfoHash() {
    StringBuilder infoHash = new StringBuilder();
    infoHash.append("duration:").append(mMediaPlayer.getLength()).append(';');
    appendTrackHash(infoHash, "audioTracks", mMediaPlayer.getAudioTracks());
    appendTrackHash(infoHash, "textTracks", mMediaPlayer.getSpuTracks());
    Media.VideoTrack video = mMediaPlayer.getCurrentVideoTrack();
    if (video != null) {
      infoHash
          .append("videoSize:")
          .append(video.width)
          .append('x')
          .append(video.height)
          .append(';');
    }
    return infoHash.toString();
  }

  private void appendTrackHash(
      StringBuilder infoHash, String name, MediaPlayer.TrackDescription[] tracks) {
    if (tracks == null || tracks.length == 0) {
      return;
    }
    infoHash.append(name).append(':');
    for (MediaPlayer.TrackDescription track : tracks) {
      infoHash.append(track.id).append(':').append(track.name).append(',');
    }
    infoHash.append(';');
  }

  private void putTrackInfo(
      WritableMap info, String name, MediaPlayer.TrackDescription[] trackDescriptions) {
    if (trackDescriptions == null || trackDescriptions.length == 0) {
      return;
    }
    WritableArray tracks = new WritableNativeArray();
    for (MediaPlayer.TrackDescription track : trackDescriptions) {
      WritableMap trackMap = Arguments.createMap();
      trackMap.putInt("id", track.id);
      trackMap.putString("name", track.name);
      tracks.pushMap(trackMap);
    }
    info.putArray(name, tracks);
  }

  private void putVideoSize(WritableMap info, Media.VideoTrack video) {
    if (video == null) {
      return;
    }
    WritableMap videoSize = Arguments.createMap();
    videoSize.putInt("width", video.width);
    videoSize.putInt("height", video.height);
    info.putMap("videoSize", videoSize);
  }
}
