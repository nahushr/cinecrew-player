import * as ReactNativeWeb from 'react-native-web';

export * from 'react-native-web';
export const BackHandler = {
  addEventListener: () => ({ remove() {} }),
  removeEventListener() {},
};
export default ReactNativeWeb;
