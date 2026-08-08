// Generic per-game player-stats section (RN port of the web PlayerStatsTable).
// Game-agnostic: it reads getStatColumns(match.wiki) and, for each game with
// participants, splits them by team and renders a per-team <Scoreboard>. This is
// Returns null when there are no columns or no participants.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import type { PandaTeam } from '@/types';
import { SectionHeader, type MatchSectionProps } from './shared';
import { Scoreboard } from './Scoreboard';
import { getStatColumns } from './statColumns';

export default function PlayerStatsTable({ match }: MatchSectionProps) {
  const wiki = match.wiki ?? '';
  const columns = getStatColumns(wiki);
  const games = (match.games ?? []).filter(g => (g.participants?.length ?? 0) > 0);
  if (columns.length === 0 || games.length === 0) return null;

  const home = match.opponents?.[0]?.opponent || match.opponents?.[0]?.team;
  const away = match.opponents?.[1]?.opponent || match.opponents?.[1]?.team;
  const characterIcon = undefined;

  const teamLabel = (t?: PandaTeam | null, fallback = '-') => t?.acronym || t?.name || fallback;

  return (
    <View style={styles.section}>
      <SectionHeader icon="chart-line" title="Statistiques des joueurs" />
      <View style={styles.games}>
        {games.map((game, idx) => {
          const parts = game.participants ?? [];
          const team1 = parts.filter(p => p.team === 1);
          const team2 = parts.filter(p => p.team === 2);
          if (team1.length === 0 && team2.length === 0) return null;

          return (
            <View key={game.id ?? idx} style={styles.game}>
              {games.length > 1 && (
                <Text style={styles.gameLabel}>
                  GAME {game.position}{game.map ? ` · ${game.map}` : ''}
                </Text>
              )}
              <View style={styles.boards}>
                {team1.length > 0 && (
                  <Scoreboard
                    participants={team1}
                    columns={columns}
                    characterIcon={characterIcon}
                    teamLabel={teamLabel(home)}
                    teamLogo={home?.image_url}
                  />
                )}
                {team2.length > 0 && (
                  <Scoreboard
                    participants={team2}
                    columns={columns}
                    characterIcon={characterIcon}
                    teamLabel={teamLabel(away)}
                    teamLogo={away?.image_url}
                  />
                )}
              </View>
            </View>
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
  games: {
    gap: spacing.lg,
  },
  game: {
    gap: spacing.sm,
  },
  gameLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  boards: {
    gap: spacing.md,
  },
});
