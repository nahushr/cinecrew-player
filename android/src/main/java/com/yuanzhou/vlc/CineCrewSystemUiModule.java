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
      updateNavigationBarVisibility(activity, hidden);
    });
  }

  private void updateNavigationBarVisibility(Activity activity, boolean hidden) {
    if (hidden == immersiveNavigationBar) {
      return;
    }
    Window window = activity.getWindow();
    boolean updated;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      updated = updateModernNavigationBar(window, hidden);
    } else {
      updateLegacyNavigationBar(window.getDecorView(), hidden);
      updated = true;
    }
    if (!updated) {
      return;
    }
    immersiveNavigationBar = hidden;
  }

  private boolean updateModernNavigationBar(Window window, boolean hidden) {
    WindowInsetsController controller = window.getInsetsController();
    if (controller == null) {
      return false;
    }
    int navigationBars = WindowInsets.Type.navigationBars();
    if (hidden) {
      rememberModernNavigationBarState(window, controller, navigationBars);
      controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      controller.hide(navigationBars);
      return true;
    }
    setModernNavigationBarVisibility(controller, navigationBars);
    controller.setSystemBarsBehavior(previousSystemBarsBehavior);
    return true;
  }

  private void rememberModernNavigationBarState(
      Window window, WindowInsetsController controller, int navigationBars) {
    if (immersiveNavigationBar) {
      return;
    }
    WindowInsets rootInsets = window.getDecorView().getRootWindowInsets();
    navigationBarWasVisible = rootInsets == null || rootInsets.isVisible(navigationBars);
    previousSystemBarsBehavior = controller.getSystemBarsBehavior();
  }

  private void setModernNavigationBarVisibility(
      WindowInsetsController controller, int navigationBars) {
    if (navigationBarWasVisible) {
      controller.show(navigationBars);
      return;
    }
    controller.hide(navigationBars);
  }

  private void updateLegacyNavigationBar(View decorView, boolean hidden) {
    if (hidden) {
      rememberLegacySystemUiState(decorView);
      int immersiveFlags = View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
      decorView.setSystemUiVisibility(decorView.getSystemUiVisibility() | immersiveFlags);
      return;
    }
    decorView.setSystemUiVisibility(previousSystemUiVisibility);
  }

  private void rememberLegacySystemUiState(View decorView) {
    if (!immersiveNavigationBar) {
      previousSystemUiVisibility = decorView.getSystemUiVisibility();
    }
  }
}
