// Shared props contract + helpers for modular tournament-detail sections (RN port).
// The shell owns match enrichment and passes the enriched `matches` array down;
// each section filters/groups it and self-hides when empty.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { PandaTournament, PandaMatch } from '@/types';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface TournamentSectionProps {
  tournament: PandaTournament;
  matches: PandaMatch[];
}

export interface MatchDateGroup {
  dateKey: string;
  label: string;
  matches: PandaMatch[];
}

/** Group matches by date string (YYYY-MM-DD) preserving order. */
export function groupMatchesByDate(matches: PandaMatch[]): MatchDateGroup[] {
  const groups = new Map<string, PandaMatch[]>();
  const order: string[] = [];

  for (const m of matches) {
    const raw = m.begin_at || m.scheduled_at || '';
    let dateKey = 'unknown';
    if (raw) {
      const d = new Date(raw);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 2000) {
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
      order.push(dateKey);
    }
    groups.get(dateKey)!.push(m);
  }

  return order.map(dateKey => {
    let label: string;
    if (dateKey === 'unknown') {
      label = 'Date inconnue';
    } else {
      const [y, mo, d] = dateKey.split('-').map(Number);
      const date = new Date(y, mo - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.getTime() === today.getTime()) {
        label = "Aujourd'hui";
      } else if (date.getTime() === yesterday.getTime()) {
        label = 'Hier';
      } else if (date.getTime() === tomorrow.getTime()) {
        label = 'Demain';
      } else {
        label = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
    }
    return { dateKey, label, matches: groups.get(dateKey)! };
  });
}

// Consistent with match-detail's SectionHeader: accent bar + icon + uppercase title.
export const SectionHeader = ({ icon, title, extra }: { icon: IconName; title: string; extra?: React.ReactNode }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionAccentBar} />
    <MaterialCommunityIcons name={icon} size={18} color={COLORS.accent} />
    <Text style={styles.sectionTitle}>{title}</Text>
    {extra ? <View style={styles.sectionExtra}>{extra}</View> : null}
  </View>
);

const styles = StyleSheet.create({
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
