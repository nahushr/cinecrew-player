package com.yuanzhou.vlc;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public final class CineCrewSystemUiModule extends ReactContextBaseJavaModule {
  private boolean immersiveNavigationBar;
  private boolean navigationBarWasVisible = true;
  private int previousSystemBarsBehavior;
  private int previousSystemUiVisibility;

  CineCrewSystemUiModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "CineCrewSystemUi";
  }

  @ReactMethod
  public void setImmersiveNavigationBar(boolean hidden) {
    Activity activity = getCurrentActivity();
    if (activity == null) {
      return;
    }

    activity.runOnUiThread(() -> {
      if (hidden == immersiveNavigationBar) {
        return;
      }

      Window window = activity.getWindow();
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        WindowInsetsController controller = window.getInsetsController();
        if (controller == null) {
          return;
        }

        int navigationBars = WindowInsets.Type.navigationBars();
        if (hidden) {
          if (!immersiveNavigationBar) {
            WindowInsets rootInsets = window.getDecorView().getRootWindowInsets();
            navigationBarWasVisible = rootInsets == null || rootInsets.isVisible(navigationBars);
            previousSystemBarsBehavior = controller.getSystemBarsBehavior();
          }
          controller.setSystemBarsBehavior(
              WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
          controller.hide(navigationBars);
        } else {
          if (navigationBarWasVisible) {
            controller.show(navigationBars);
          } else {
            controller.hide(navigationBars);
          }
          controller.setSystemBarsBehavior(previousSystemBarsBehavior);
        }
      } else {
        View decorView = window.getDecorView();
        if (hidden) {
          if (!immersiveNavigationBar) {
            previousSystemUiVisibility = decorView.getSystemUiVisibility();
          }
          int immersiveFlags = View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
              | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
              | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
              | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
          decorView.setSystemUiVisibility(decorView.getSystemUiVisibility() | immersiveFlags);
        } else {
          decorView.setSystemUiVisibility(previousSystemUiVisibility);
        }
      }
      immersiveNavigationBar = hidden;
    });
  }
}
