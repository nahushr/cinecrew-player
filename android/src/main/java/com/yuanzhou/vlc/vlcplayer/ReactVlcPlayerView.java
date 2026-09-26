package com.yuanzhou.vlc.vlcplayer;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.SurfaceTexture;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Handler;
import android.os.PowerManager;
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
import java.io.FileOutputStream;
import java.util.ArrayList;
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

  private final VideoEventEmitter eventEmitter;
  private LibVLC libvlc;
  private MediaPlayer mMediaPlayer = null;
  private boolean mMuted = false;
  private boolean isSurfaceViewDestory;
  private String src;
  private String subtitleUri;
  private ReadableMap srcMap;
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
  private int preVolume = 100;
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

        @Override
        public void onEvent(MediaPlayer.Event event) {
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
              map.putString("type", "RecordingPath");
              map.putBoolean(EVENT_PROP_IS_RECORDING, event.getRecording());
              // Record started emits and event with the record path (but no file).
              // Only want to emit when recording has stopped and the recording is created.
              if (!event.getRecording() && event.getRecordPath() != null) {
                map.putString("recordPath", event.getRecordPath());
              }
              eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_RECORDING_STATE);
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
                && (uriString.startsWith("file://") || uriString.startsWith("content://")));
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
      mMediaPlayer.setPosition(position);
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
    if (mMediaPlayer != null
        && srcMap != null
        && srcMap.hasKey("uri")
        && !srcMap.isNull("uri")
        && nextUri != null
        && nextUri.equals(srcMap.getString("uri"))) {
      // React Native may resend the source map when an unrelated prop
      // changes (for example volume). Do not restart the media item.
      srcMap = src;
      return;
    }

    this.srcMap = src;
    createPlayer(true, false);
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
    if (mMediaPlayer != null) {
      mMediaPlayer.setVolume(volumeModifier);
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
      if (muted) {
        this.preVolume = mMediaPlayer.getVolume();
        mMediaPlayer.setVolume(0);
      } else {
        mMediaPlayer.setVolume(this.preVolume);
      }
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
    boolean accepted = mMediaPlayer != null && recordingPath != null && mMediaPlayer.record(recordingPath);
    WritableMap map = Arguments.createMap();
    map.putString("operation", "start");
    map.putBoolean("requestAccepted", accepted);
    map.putBoolean(EVENT_PROP_IS_RECORDING, accepted);
    if (!accepted) {
      map.putString(EVENT_PROP_ERROR, "VLC rejected the recording request for this media source.");
    }
    eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_RECORDING_STATE);
  }

  public void stopRecording() {
    boolean accepted = mMediaPlayer != null && mMediaPlayer.record(null);
    WritableMap map = Arguments.createMap();
    map.putString("operation", "stop");
    map.putBoolean("requestAccepted", accepted);
    map.putBoolean(EVENT_PROP_IS_RECORDING, !accepted);
    if (!accepted) {
      map.putString(EVENT_PROP_ERROR, "VLC rejected the request to stop recording.");
    }
    eventEmitter.sendEvent(map, VideoEventEmitter.EVENT_RECORDING_STATE);
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
