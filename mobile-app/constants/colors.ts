// Brand Colors from CLAUDE.md
export const COLORS = {
  // Primary brand colors
  primary: '#F22E62',      // Pink/Red accent
  darkest: '#060B13',      // Darkest background
  dark: '#091626',         // Dark background
  darkBlue: '#182859',     // Dark blue accent

  // Semantic colors
  background: '#060B13',
  surface: '#091626',
  surfaceVariant: '#182859',

  // Text colors
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#6B7280',

  // Status colors
  live: '#EF4444',         // Red for live indicator
  success: '#10B981',      // Green for success/finished
  warning: '#F59E0B',      // Orange for warnings
  info: '#3B82F6',         // Blue for info

  // Tier badge colors
  tierS: '#FFD700',        // Gold
  tierA: '#C0C0C0',        // Silver
  tierB: '#CD7F32',        // Bronze
  tierC: '#6B7280',        // Gray
  tierD: '#4B5563',        // Dark gray

  // UI elements
  border: '#1F2937',
  borderPrimary: '#1F2937',
  borderSecondary: '#374151',
  divider: '#374151',
  overlay: 'rgba(0, 0, 0, 0.6)',

  // Transparent variants
  primaryTransparent: 'rgba(242, 46, 98, 0.1)',
  liveTransparent: 'rgba(239, 68, 68, 0.1)',
} as const;

export type ColorKey = keyof typeof COLORS;
