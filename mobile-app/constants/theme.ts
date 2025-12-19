import { MD3DarkTheme } from 'react-native-paper';
import { COLORS } from './colors';

// Material Design 3 theme configuration
export const theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: COLORS.primary,
    primaryContainer: COLORS.primaryTransparent,
    secondary: COLORS.darkBlue,
    secondaryContainer: COLORS.dark,
    tertiary: COLORS.info,
    surface: COLORS.surface,
    surfaceVariant: COLORS.surfaceVariant,
    surfaceDisabled: COLORS.divider,
    background: COLORS.background,
    error: COLORS.live,
    errorContainer: COLORS.liveTransparent,
    onPrimary: '#FFFFFF',
    onPrimaryContainer: COLORS.primary,
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#FFFFFF',
    onTertiary: '#FFFFFF',
    onSurface: COLORS.text,
    onSurfaceVariant: COLORS.textSecondary,
    onSurfaceDisabled: COLORS.textMuted,
    onError: '#FFFFFF',
    onErrorContainer: COLORS.live,
    onBackground: COLORS.text,
    outline: COLORS.border,
    outlineVariant: COLORS.divider,
    inverseSurface: COLORS.text,
    inverseOnSurface: COLORS.background,
    inversePrimary: COLORS.primary,
    shadow: '#000000',
    scrim: COLORS.overlay,
    backdrop: COLORS.overlay,
    elevation: {
      level0: 'transparent',
      level1: COLORS.surface,
      level2: COLORS.surfaceVariant,
      level3: COLORS.darkBlue,
      level4: COLORS.dark,
      level5: COLORS.darkest,
    },
  },
};

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Border radius scale
export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// Shadow presets
export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
} as const;

export type Theme = typeof theme;
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
