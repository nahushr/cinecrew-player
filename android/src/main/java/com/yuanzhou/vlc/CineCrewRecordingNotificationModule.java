package com.yuanzhou.vlc;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public final class CineCrewRecordingNotificationModule extends ReactContextBaseJavaModule {
  private static final String CHANNEL_ID = "cinecrew_recordings";

  CineCrewRecordingNotificationModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "CineCrewRecordingNotifications";
  }

  @ReactMethod
  public void showRecordingNotification(String filename, String savedUri, String mimeType, Promise promise) {
    try {
      ReactApplicationContext context = getReactApplicationContext();
      if (Build.VERSION.SDK_INT >= 33
          && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        promise.resolve(false);
        return;
      }

      NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      if (manager == null) {
        promise.resolve(false);
        return;
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Saved recordings",
            NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Notifications when CineCrew video recordings are ready.");
        manager.createNotificationChannel(channel);
      }

      String safeFilename = filename == null || filename.trim().isEmpty() ? "Video recording" : filename;
      String savedLocation = "Saved to Downloads/CineCrew Recordings";
      Notification.Builder builder = new Notification.Builder(context, CHANNEL_ID)
          .setSmallIcon(android.R.drawable.stat_sys_download_done)
          .setContentTitle("Download complete")
          .setContentText(safeFilename)
          .setStyle(new Notification.BigTextStyle().bigText(safeFilename + "\n" + savedLocation))
          .setCategory(Notification.CATEGORY_STATUS)
          .setAutoCancel(true)
          .setVisibility(Notification.VISIBILITY_PUBLIC)
          .setShowWhen(true);

      if (savedUri != null && savedUri.startsWith("content://")) {
        Uri uri = Uri.parse(savedUri);
        Intent openRecording = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, mimeType == null ? "video/*" : mimeType)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            uri.hashCode(),
            openRecording,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        builder.setContentIntent(pendingIntent);
      }

      manager.notify(savedUri == null ? safeFilename.hashCode() : savedUri.hashCode(), builder.build());
      promise.resolve(true);
    } catch (SecurityException exception) {
      // A notification permission may be revoked after the app checked it. The
      // recording itself is already saved, so notification failure is non-fatal.
      promise.resolve(false);
    } catch (Exception exception) {
      promise.reject("RECORDING_NOTIFICATION_FAILED", exception.getMessage(), exception);
    }
  }
}
