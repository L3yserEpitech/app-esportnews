// Thin rosters for now — rich player rosters come with the team endpoints
// (Phase 3). Renders the tournament's teams (logo + name); if the backend
// exposed an expected_roster with players, lists them under each team.
// Self-hides when there are no teams.
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { imageUrl } from '@/utils/imageUrl';
import type { PandaTeam, PandaPlayer } from '@/types';
import { SectionHeader, type TournamentSectionProps } from './shared';

function TeamBlock({
  team,
  players,
  wiki,
}: {
  team?: PandaTeam | null;
  players?: PandaPlayer[];
  wiki?: string | null;
}) {
  const router = useRouter();
  if (!team) return null;
  const logo = imageUrl(team.image_url);
  const teamId = typeof team.id === 'number' ? team.id : null;
  // L'id vient d'un opponent : c'est un hash du nom, pas un pageid. La page
  // d'équipe résout par template, d'où son passage en paramètre.
  const teamTemplate = team.template ?? '';
  // Sans template, aucune page d'équipe n'est atteignable : on ne rend pas le
  // bloc cliquable plutôt que d'ouvrir un écran qui finira en erreur.
  const canOpenTeam = teamId != null && teamTemplate.length > 0;
  const goToTeam = () => {
    if (!canOpenTeam) return;
    router.push({
      pathname: '/team/[id]',
      params: { id: String(teamId), wiki: wiki ?? '', template: teamTemplate },
    });
  };
  return (
    <Pressable
      style={styles.block}
      onPress={goToTeam}
      disabled={!canOpenTeam}
    >
      <View style={styles.teamRow}>
        <View style={styles.logoBox}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" />
          ) : (
            <MaterialCommunityIcons name="shield-outline" size={20} color={COLORS.textSecondary} />
          )}
        </View>
        <Text style={styles.teamName} numberOfLines={1}>{team.name || team.acronym || 'TBD'}</Text>
      </View>
      {players && players.length > 0 ? (
        <View style={styles.players}>
          {players.map((p, i) => (
            <View key={`${p.id ?? p.name}-${i}`} style={styles.playerRow}>
              <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
              {p.role ? <Text style={styles.playerRole}>{p.role}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function RostersSection({ tournament }: TournamentSectionProps) {
  const roster = tournament.expected_roster?.filter(r => r.team) ?? [];
  const teams = tournament.teams ?? [];

  if (roster.length === 0 && teams.length === 0) return null;

  return (
    <View>
      <SectionHeader icon="account-group" title="Équipes & Rosters" />
      <View style={styles.grid}>
        {roster.length > 0
          ? roster.map((r, i) => (
              <TeamBlock key={r.team?.id ?? i} team={r.team} players={r.players} wiki={tournament.wiki} />
            ))
          : teams.map((t, i) => (
              <TeamBlock key={t.id ?? i} team={t} wiki={tournament.wiki} />
            ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  block: {
    minWidth: '47%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: spacing.sm,
  },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBox: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 26, height: 26 },
  teamName: { flex: 1, color: COLORS.text, fontWeight: '700', fontSize: 14 },
  players: { gap: 2 },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  playerName: { flex: 1, color: COLORS.textSecondary, fontSize: 12 },
  playerRole: { color: COLORS.primary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
