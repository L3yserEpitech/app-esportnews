/**
 * Semantic color tokens - Maps raw colors to use cases
 * This layer provides meaning to colors in context
 */

import { themeColors, type ThemeMode, type ThemeColors } from './theme';

export interface SemanticTokens {
  // Text colors
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
    accent: string;
    link: string;
  };

  // Background colors
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    surface: string;
    hover: string;
    active: string;
    disabled: string;
    overlay: string;
  };

  // Border colors
  border: {
    primary: string;
    secondary: string;
    accent: string;
    muted: string;
    focus: string;
  };

  // Interactive elements
  interactive: {
    primary: string;
    primaryHover: string;
    primaryActive: string;
    primaryDisabled: string;
    secondary: string;
    secondaryHover: string;
    danger: string;
    success: string;
  };

  // Status colors
  status: {
    live: string;
    upcoming: string;
    finished: string;
    success: string;
    warning: string;
    error: string;
  };

  // Component-specific
  card: {
    bg: string;
    border: string;
    text: string;
    textSecondary: string;
  };

  badge: {
    bg: string;
    text: string;
  };

  input: {
    bg: string;
    border: string;
    borderFocus: string;
    text: string;
    placeholder: string;
  };
}

/**
 * Get semantic tokens for a given theme
 */
export function getSemanticTokens(theme: ThemeMode): SemanticTokens {
  const colors = themeColors[theme];

  return {
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      muted: colors.textMuted,
      inverse: theme === 'dark' ? '#000000' : '#FFFFFF',
      accent: colors.accent,
      link: colors.accent,
    },

    bg: {
      primary: colors.bgPrimary,
      secondary: colors.bgSecondary,
      tertiary: colors.bgTertiary,
      surface: colors.bgSecondary,
      hover: colors.bgHover,
      active: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
      disabled: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
      overlay: colors.overlay,
    },

    border: {
      primary: colors.borderPrimary,
      secondary: colors.borderSecondary,
      accent: colors.borderAccent,
      muted: colors.borderMuted,
      focus: colors.accent,
    },

    interactive: {
      primary: colors.accent,
      primaryHover: colors.accentHover,
      primaryActive: colors.accentHover,
      primaryDisabled: colors.textMuted,
      secondary: colors.borderSecondary,
      secondaryHover: colors.bgTertiary,
      danger: colors.statusLive,
      success: colors.statusSuccess,
    },

    status: {
      live: colors.statusLive,
      upcoming: colors.statusUpcoming,
      finished: colors.statusFinished,
      success: colors.statusSuccess,
      warning: colors.statusUpcoming,
      error: colors.statusLive,
    },

    card: {
      bg: colors.bgSecondary,
      border: colors.borderPrimary,
      text: colors.textPrimary,
      textSecondary: colors.textSecondary,
    },

    badge: {
      bg: colors.bgTertiary,
      text: colors.textPrimary,
    },

    input: {
      bg: colors.bgPrimary,
      border: colors.borderMuted,
      borderFocus: colors.accent,
      text: colors.textPrimary,
      placeholder: colors.textMuted,
    },
  };
}

/**
 * Export all theme colors for both modes
 */
export const allThemeColors = themeColors;
