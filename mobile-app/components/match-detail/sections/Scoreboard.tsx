// Reusable per-team stats table primitive (RN port of the web vlr.gg-style
// scoreboard). Game-agnostic: it never branches on wiki — a game card hands it
// the right `columns` (from statColumns or a bespoke set) plus an optional
// `characterIcon` resolver, and this renders the table. Works for Valorant
// (ACS/ADR/KAST), LoL (gold/CS/damage) and Dota (net worth/GPM/XPM) alike.
//
// RN has no <table>: rows/cells are Views. The table is wrapped in a horizontal
// ScrollView so wide stat sets scroll on narrow screens. Zebra rows, right-
// aligned numeric cells, dark theme.
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUrl } from '@/utils/imageUrl';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { PandaParticipant } from '@/types';
import type { StatColumn } from './statColumns';

export interface ScoreboardProps {
  participants: PandaParticipant[];
  columns: StatColumn[];
  // Resolve a character (agent/champion/hero) name → icon URL. When provided a
  // leading icon cell is rendered next to each player.
  characterIcon?: (name?: string | null) => string | null;
  teamLabel?: string;
  teamLogo?: string | null;
  // Rows sorted descending by this accessor when provided (e.g. Valorant ACS).
  sortBy?: (p: PandaParticipant) => number | null;
  // Header label resolver (e.g. i18n). Default prettifies the column label.
  labelFor?: (label: string) => string;
}

const CELL_W = 52;

const prettify = (label: string): string => label.replace(/_/g, ' ').toUpperCase();

// +/- style sign coloring for `signed` columns (matches web: emerald / accent).
const signColor = (value: string): string | undefined => {
  if (value.startsWith('+')) return COLORS.success;
  if (/^-\d/.test(value)) return COLORS.accent;
  return undefined;
};

export function Scoreboard({
  participants,
  columns,
  characterIcon,
  teamLabel,
  teamLogo,
  sortBy,
  labelFor = prettify,
}: ScoreboardProps) {
  const rows = sortBy
    ? [...participants].sort((a, b) => (sortBy(b) ?? -1) - (sortBy(a) ?? -1))
    : participants;
  if (rows.length === 0) return null;

  const logoUri = imageUrl(teamLogo) ?? undefined;

  return (
    <View style={styles.wrap}>
      {(teamLabel || logoUri) && (
        <View style={styles.header}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.headerLogo} contentFit="contain" />
          ) : null}
          {teamLabel ? <Text style={styles.headerLabel} numberOfLines={1}>{teamLabel}</Text> : null}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableInner}>
        <View>
          {/* Header row */}
          <View style={[styles.row, styles.headerRow]}>
            {characterIcon ? <View style={styles.iconCell} /> : null}
            <Text style={[styles.th, styles.playerCol]} numberOfLines={1}>PLAYER</Text>
            {columns.map(c => (
              <Text
                key={c.key}
                style={[styles.th, styles.statCol, alignStyle(c.align)]}
                numberOfLines={1}
              >
                {labelFor(c.label)}
              </Text>
            ))}
          </View>

          {/* Data rows */}
          {rows.map((p, i) => {
            const icon = characterIcon ? imageUrl(characterIcon(p.character)) ?? undefined : undefined;
            return (
              <View key={i} style={[styles.row, i % 2 === 1 && styles.zebra]}>
                {characterIcon ? (
                  <View style={styles.iconCell}>
                    {icon ? (
                      <Image source={{ uri: icon }} style={styles.iconImg} contentFit="cover" />
                    ) : (
                      <View style={styles.iconImg}>
                        <MaterialCommunityIcons name="account" size={14} color={COLORS.textMuted} />
                      </View>
                    )}
                  </View>
                ) : null}
                <Text style={[styles.td, styles.playerCol, styles.playerName]} numberOfLines={1}>
                  {p.player || '-'}
                </Text>
                {columns.map(c => {
                  const value = c.fmt(p);
                  const color = c.signed ? signColor(value) : undefined;
                  return (
                    <Text
                      key={c.key}
                      style={[styles.td, styles.statCol, styles.numeric, alignStyle(c.align), color ? { color } : null]}
                      numberOfLines={1}
                    >
                      {value}
                    </Text>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const alignStyle = (align?: StatColumn['align']) =>
  align === 'left' ? styles.alignLeft : align === 'center' ? styles.alignCenter : styles.alignRight;

const styles = StyleSheet.create({
  wrap: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(6,11,19,0.4)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(9,22,38,0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerLogo: {
    width: 16,
    height: 16,
  },
  headerLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableInner: {
    minWidth: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  headerRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  zebra: {
    backgroundColor: 'rgba(9,22,38,0.35)',
  },
  iconCell: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImg: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(24,40,89,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCol: {
    width: 96,
  },
  statCol: {
    width: CELL_W,
  },
  th: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  playerName: {
    color: COLORS.text,
    fontWeight: '700',
  },
  numeric: {
    fontVariant: ['tabular-nums'],
  },
  alignLeft: {
    textAlign: 'left',
  },
  alignCenter: {
    textAlign: 'center',
  },
  alignRight: {
    textAlign: 'right',
  },
});

export default Scoreboard;
