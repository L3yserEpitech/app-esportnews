/**
 * Design system - Theme color tokens
 * Palette complète dark/light selon CLAUDE.md
 */

export const themeColors = {
  dark: {
    // Brand & Primary
    primary900: '#060B13',      // Noir profond
    primary800: '#091626',      // Bleu très sombre
    primary600: '#182859',      // Bleu moyen

    // Text
    textPrimary: '#FFFFFF',     // Blanc
    textSecondary: '#B0B0B0',   // Gris clair
    textMuted: '#808080',       // Gris moyen
    textMutedAlt: '#6B7280',    // Gris (gray-500)

    // Background
    bgPrimary: '#060B13',       // Fond principal
    bgSecondary: '#091626',     // Fond secondaire
    bgTertiary: '#182859',      // Fond tertiaire
    bgHover: 'rgba(255, 255, 255, 0.05)',

    // Accent & Status
    accent: '#F22E62',          // Rose accent (CLAUDE.md)
    accentHover: '#D91E52',     // Rose hover
    accentAlt: '#F54A7B',       // Rose alt

    // Status Colors
    statusLive: '#FF4444',      // Live
    statusUpcoming: '#FFA500',  // Upcoming
    statusFinished: '#808080',  // Finished
    statusSuccess: '#4ADE80',   // Success

    // Borders
    borderPrimary: '#182859',
    borderSecondary: '#091626',
    borderAccent: '#F22E62',
    borderMuted: '#374151',

    // Utility
    overlay: 'rgba(0, 0, 0, 0.5)',
    transparent: 'transparent',
  },

  light: {
    // Brand & Primary
    primary900: '#F8F9FA',      // Blanc cassé (fond principal)
    primary800: '#FFFFFF',      // Blanc pur
    primary600: '#F0F4F8',      // Bleu très clair

    // Text
    textPrimary: '#1A1A1A',     // Quasi-noir
    textSecondary: '#4B5563',   // Gris
    textMuted: '#808080',       // Gris moyen
    textMutedAlt: '#A0A0A0',    // Gris clair

    // Background
    bgPrimary: '#F8F9FA',       // Fond principal
    bgSecondary: '#FFFFFF',     // Fond secondaire
    bgTertiary: '#F0F4F8',      // Fond tertiaire
    bgHover: 'rgba(0, 0, 0, 0.05)',

    // Accent & Status (même que dark)
    accent: '#F22E62',          // Rose accent
    accentHover: '#D91E52',     // Rose hover
    accentAlt: '#F54A7B',       // Rose alt

    // Status Colors (même que dark)
    statusLive: '#FF4444',      // Live
    statusUpcoming: '#FFA500',  // Upcoming
    statusFinished: '#999999',  // Finished (plus clair)
    statusSuccess: '#4ADE80',   // Success

    // Borders
    borderPrimary: '#E5E7EB',   // Gris très clair
    borderSecondary: '#F0F4F8', // Bleu très clair
    borderAccent: '#F22E62',    // Rose
    borderMuted: '#D1D5DB',     // Gris clair

    // Utility
    overlay: 'rgba(0, 0, 0, 0.3)',
    transparent: 'transparent',
  },
} as const;

export type Theme = 'dark' | 'light' | 'auto';
export type ThemeMode = 'dark' | 'light';
export type ThemeColors = typeof themeColors.dark;
