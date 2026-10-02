import * as ReactNativeWeb from 'react-native-web';

export * from 'react-native-web';
export const BackHandler = {
  addEventListener: () => ({ remove() {} }),
  removeEventListener() {},
};
export const PermissionsAndroid = {
  PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
  RESULTS: { GRANTED: 'granted' },
  check: async () => false,
  request: async () => 'denied',
};
export default ReactNativeWeb;
