// Shared helpers + props contract for modular match-detail sections (RN port).
// Extracted from the web match detail so each section is a focused unit.
// Mobile is dark-only, so the web `isDark`/theme-logo picking is dropped.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUrl } from '@/utils/imageUrl';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { PandaMatch, PandaGame } from '@/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface MatchSectionProps {
  match: PandaMatch;
  game?: PandaGame;
  isLive: boolean;
}

export const parseGameWinner = (winner: unknown): { id: number | null; type: string } | null => {
  if (!winner) return null;
  if (typeof winner === 'object' && winner !== null && 'id' in winner) {
    return winner as { id: number | null; type: string };
  }
  if (typeof winner === 'string') {
    try { return JSON.parse(winner); } catch { return null; }
  }
  return null;
};

// Role → badge colors. Web returned tailwind classes; here we return concrete
// color values so sections can spread them into StyleSheet objects.
export interface RoleBadgeStyle {
  color: string;
  backgroundColor: string;
  borderColor: string;
}

export const getRoleBadgeStyle = (role?: string | null): RoleBadgeStyle | null => {
  if (!role) return null;
  const r = role.toLowerCase();
  const mk = (color: string): RoleBadgeStyle => ({
    color,
    backgroundColor: `${color}1A`,
    borderColor: `${color}40`,
  });
  if (r.includes('captain') || r.includes('igl')) return mk('#22D3EE'); // cyan
  if (r.includes('coach')) return mk('#FBBF24'); // amber
  if (r.includes('mid')) return mk('#60A5FA'); // blue
  if (r.includes('adc') || r.includes('bot')) return mk('#4ADE80'); // green
  if (r.includes('support') || r.includes('sup')) return mk('#FACC15'); // yellow
  if (r.includes('top')) return mk('#F87171'); // red
  if (r.includes('jungl') || r.includes('jgl')) return mk('#C084FC'); // purple
  if (r.includes('awp') || r.includes('sniper')) return mk('#FB923C'); // orange
  return mk(COLORS.textSecondary);
};

export const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return dateString;
  }
};

export const formatTime = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h${remaining > 0 ? `${remaining}m` : ''}`;
  }
  return `${minutes}m`;
};

type LogoTeam = { image_url?: string | null; name?: string | null; acronym?: string | null } | null | undefined;

const LOGO_SIZES = { sm: 28, md: 48, lg: 88 } as const;

export const TeamLogo = ({ team, size = 'lg', highlight = false }: {
  team: LogoTeam;
  size?: keyof typeof LOGO_SIZES;
  highlight?: boolean;
}) => {
  const dim = LOGO_SIZES[size];
  const uri = imageUrl(team?.image_url) ?? undefined;
  return (
    <View style={[
      styles.logoBox,
      { width: dim, height: dim, borderRadius: dim / 4 },
      highlight && styles.logoBoxHighlight,
    ]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: dim * 0.72, height: dim * 0.72 }} contentFit="contain" />
      ) : (
        <MaterialCommunityIcons name="shield-outline" size={dim * 0.42} color={COLORS.textMuted} />
      )}
    </View>
  );
};

export const SectionHeader = ({ icon, title, extra }: { icon: IconName; title: string; extra?: React.ReactNode }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionAccentBar} />
    <MaterialCommunityIcons name={icon} size={18} color={COLORS.accent} />
    <Text style={styles.sectionTitle}>{title}</Text>
    {extra ? <View style={styles.sectionExtra}>{extra}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  logoBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoBoxHighlight: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.primaryTransparent,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionAccentBar: {
    width: 4,
    height: 20,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.accent,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionExtra: {
    marginLeft: 'auto',
  },
});
