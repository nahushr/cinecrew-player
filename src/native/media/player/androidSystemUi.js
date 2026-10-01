import { NativeModules, Platform } from 'react-native';

export function setAndroidImmersiveNavigationBar(hidden) {
  if (Platform.OS !== 'android') return;
  NativeModules.CineCrewSystemUi?.setImmersiveNavigationBar?.(Boolean(hidden));
}
