import { Component } from 'react';
import { UIManager, NativeModules } from 'react-native';
import { isWeb } from '../../../utils/runtimePlatform';

/** Whether the native VLC view manager is registered in this app binary. */
export const VLC_AVAILABLE =
  !isWeb() &&
  (() => {
    try {
      return !!(
        UIManager?.hasViewManagerConfig?.('RCTVLCPlayer') ||
        UIManager?.getViewManagerConfig?.('RCTVLCPlayer') ||
        UIManager?.RCTVLCPlayer ||
        NativeModules?.RCTVLCPlayer ||
        NativeModules?.VLCPlayer
      );
    } catch {
      return false;
    }
  })();

function asVlcFailure(error) {
  const failure = error instanceof Error ? error : new Error(String(error || 'VLC playback failed.'));
  failure.engine = 'vlc';
  failure.blockPlayback = true;
  return failure;
}

/** Contains VLC render failures and reports them without switching engines. */
export class VLCBoundary extends Component {
  state = { failed: false };
  errorReported = false;

  componentDidMount() {
    if (this.props.unavailable) {
      this.reportFailure(new Error('VLC playback is unavailable in this app build. Rebuild the native app with the CineCrew VLC module installed; no fallback engine is used.'));
    }
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    this.reportFailure(error);
  }

  reportFailure(error) {
    if (this.errorReported) return;
    this.errorReported = true;
    try {
      this.props.onError?.(asVlcFailure(error));
    } catch {
      // An app callback must not break React's error-boundary recovery.
    }
  }

  render() {
    if (this.state.failed || this.props.unavailable) return null;
    return this.props.children;
  }
}
