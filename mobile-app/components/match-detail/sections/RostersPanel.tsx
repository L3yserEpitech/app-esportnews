import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { SectionHeader, TeamLogo, type MatchSectionProps } from './shared';

// Thin for now — full rosters (player fetch) land in Phase 3. We only render the
// two teams (logo + name) from the match payload; no team-detail fetch here.
export default function RostersPanel({ match }: MatchSectionProps) {
  const router = useRouter();
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
          const teamId = typeof team!.id === 'number' ? team!.id : null;
          // L'id d'un opponent est un hash du nom, pas un pageid : la page
          // d'équipe résout par template, d'où son passage en paramètre.
          const teamTemplate = team!.template ?? '';
          // Sans template (opponents "solo" des jeux 1v1), aucune page d'équipe
          // n'est atteignable : mieux vaut ne pas rendre la carte cliquable.
          const canOpenTeam = teamId != null && teamTemplate.length > 0;
          const goToTeam = () => {
            if (!canOpenTeam) return;
            router.push({
              pathname: '/team/[id]',
              params: { id: String(teamId), wiki: match.wiki ?? '', template: teamTemplate },
            });
          };
          return (
            <Surface
              key={team!.id ?? idx}
              style={[styles.card, isWinner && styles.cardWinner]}
              elevation={0}
            >
              <Pressable
                onPress={goToTeam}
                disabled={!canOpenTeam}
                style={styles.cardPressable}
              >
                <TeamLogo team={team} size="md" highlight={isWinner} />
                <Text style={styles.teamName} numberOfLines={1}>{team!.name}</Text>
                {team!.acronym ? (
                  <Text style={styles.acronym} numberOfLines={1}>{team!.acronym}</Text>
                ) : null}
              </Pressable>
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
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardPressable: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
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
