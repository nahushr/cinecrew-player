import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NativePlayerDemo } from './src/components/NativePlayerDemo';

export default function App() {
  return (
    <SafeAreaProvider>
      <NativePlayerDemo />
    </SafeAreaProvider>
  );
}
