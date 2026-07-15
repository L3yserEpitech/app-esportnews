import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { SectionHeader, TeamLogo, type MatchSectionProps } from './shared';

// Thin for now — full rosters (player fetch) land in Phase 3. We only render the
// two teams (logo + name) from the match payload; no team-detail fetch here.
export default function RostersPanel({ match }: MatchSectionProps) {
  const teams = (match.opponents || [])
    .map(o => o.opponent || o.team)
    .filter(t => t && t.name);
  if (teams.length < 2) return null;

  return (
    <View style={styles.section}>
      <SectionHeader icon="account-group-outline" title="Équipes" />
      <View style={styles.grid}>
        {teams.map((team, idx) => {
          const isWinner = match.winner_id != null && team!.id === match.winner_id;
          return (
            <Surface
              key={team!.id ?? idx}
              style={[styles.card, isWinner && styles.cardWinner]}
              elevation={0}
            >
              <TeamLogo team={team} size="md" highlight={isWinner} />
              <Text style={styles.teamName} numberOfLines={1}>{team!.name}</Text>
              {team!.acronym ? (
                <Text style={styles.acronym} numberOfLines={1}>{team!.acronym}</Text>
              ) : null}
            </Surface>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardWinner: {
    borderColor: `${COLORS.accent}40`,
    backgroundColor: COLORS.primaryTransparent,
  },
  teamName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  acronym: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
