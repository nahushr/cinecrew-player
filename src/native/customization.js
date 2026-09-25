import React, { createContext, useContext } from 'react';
import { Text } from 'react-native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

const PlayerCustomizationContext = createContext({ icons: {}, theme: {} });

export function PlayerCustomizationProvider({ icons, theme, children }) {
  return React.createElement(
    PlayerCustomizationContext.Provider,
    { value: { icons: icons || {}, theme: theme || {} } },
    children,
  );
}

export function usePlayerColors() {
  const { theme = {} } = useContext(PlayerCustomizationContext);
  const colors = theme.colors || {};
  return {
    accentColor: theme.accentColor || theme.brandAccent || colors.brandAccent || colors.primary || '#00E5FF',
    backgroundColor: theme.backgroundColor || colors.background || '#050B14',
    surfaceColor: theme.surfaceColor || colors.surface || '#111B2A',
    controlBackground: theme.controlBackground || 'rgba(0, 0, 0, 0.5)',
    controlColor: theme.controlColor || theme.textColor || colors.onSurfacePrimary || '#FFFFFF',
    mutedColor: theme.mutedTextColor || colors.onSurfaceSecondary || '#B8C2D0',
    errorColor: theme.errorColor || colors.error || '#FF5252',
    borderColor: theme.borderColor || colors.outline || 'rgba(255,255,255,0.18)',
  };
}

export function PlayerIcon({ name, pack = 'community', size = 20, color = '#FFFFFF', style }) {
  const customization = useContext(PlayerCustomizationContext);
  const custom = customization.icons?.[name] || customization.icons?.[`${pack}:${name}`];
  if (React.isValidElement(custom)) {
    return React.cloneElement(custom, { size, color, style, 'aria-hidden': true });
  }
  if (typeof custom === 'function') {
    return React.createElement(custom, { name, size, color, style, 'aria-hidden': true });
  }
  if (typeof custom === 'string' && !/^[a-z0-9-]+$/i.test(custom)) {
    return React.createElement(Text, { style: [{ fontSize: size, color }, style], accessibilityElementsHidden: true }, custom);
  }
  const IconSet = pack === 'material' ? MaterialIcons : MaterialCommunityIcons;
  const defaultIconNames = { mute: 'volume-off', unmute: 'volume-high' };
  return React.createElement(IconSet, { name: typeof custom === 'string' ? custom : (defaultIconNames[name] || name), size, color, style });
}
