import { Platform } from 'react-native';

export function isElectron() {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && /cursor/i.test(navigator.userAgent)) return false;
  return Boolean(window.process?.versions?.electron);
}

export function isWeb() {
  return Platform.OS === 'web' && !isElectron();
}

export function isAndroid() {
  return Platform.OS === 'android';
}

export function isIOS() {
  return Platform.OS === 'ios';
}
