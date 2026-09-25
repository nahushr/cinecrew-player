import { Component } from 'react';
import { UIManager, NativeModules } from 'react-native';
import { isWeb } from '../../../utils/runtimePlatform';

/**
 * Whether the native VLC view manager is registered. It is absent in
 * Expo Go and can fail on new-architecture builds — in both cases we
 * fall back to expo-video instead of crashing with
 * "ViewConfig not found for component rctvlcplayer".
 */
export const VLC_AVAILABLE =
  isWeb() ||
  (() => {
    try {
      return !!(
        UIManager?.getViewManagerConfig?.('RCTVLCPlayer') ||
        NativeModules?.RCTVLCPlayer ||
        NativeModules?.VLCPlayer
      );
    } catch {
      return false;
    }
  })();

/**
 * Render-phase error boundary: if VLCPlayer throws during render (e.g. the
 * native view manager isn't registered on this build/Fabric), swap to the
 * expo-video fallback instead of crashing with "View config not found".
 */
export class VLCBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback || null;
    return this.props.children;
  }
}
