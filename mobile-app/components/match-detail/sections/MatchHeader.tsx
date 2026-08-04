import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { teamRoute } from '@/utils/teamLink';
import { TeamLogo, formatDate, formatTime, type MatchSectionProps } from './shared';

export default function MatchHeader({ match, isLive }: MatchSectionProps) {
  const router = useRouter();
  const homeTeam = match.opponents?.[0]?.opponent || match.opponents?.[0]?.team;
  const awayTeam = match.opponents?.[1]?.opponent || match.opponents?.[1]?.team;
  const homeScore = match.results?.find(r => r.team_id === homeTeam?.id)?.score ?? match.results?.[0]?.score;
  const awayScore = match.results?.find(r => r.team_id === awayTeam?.id)?.score ?? match.results?.[1]?.score;
  const hasScores = homeScore !== undefined && awayScore !== undefined;
  const isFinished = match.status === 'finished';
  const isHomeWinner = hasScores && homeScore! > awayScore!;
  const isAwayWinner = hasScores && awayScore! > homeScore!;

  const homeRoute = teamRoute(homeTeam, match.wiki);
  const awayRoute = teamRoute(awayTeam, match.wiki);

  const statusLabel = isLive ? 'EN DIRECT' : isFinished ? 'TERMINÉ' : 'À VENIR';
  const statusColor = isLive ? COLORS.live : isFinished ? COLORS.textMuted : COLORS.primary;

  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isLive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, pulse]);

  return (
    <View style={styles.section}>
      {/* Context pills */}
      <View style={styles.pills}>
        <View style={[styles.pill, { backgroundColor: `${statusColor}1A`, borderColor: `${statusColor}40` }]}>
          {isLive && <Animated.View style={[styles.liveDot, { opacity: pulse }]} />}
          <Text style={[styles.pillText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {match.number_of_games ? (
          <View style={styles.mutedPill}>
            <Text style={styles.mutedPillText}>BO{match.number_of_games}</Text>
          </View>
        ) : null}

        {match.rescheduled ? (
          <View style={[styles.pill, { backgroundColor: `${COLORS.primary}14`, borderColor: `${COLORS.primary}33` }]}>
            <MaterialCommunityIcons name="refresh" size={11} color={COLORS.primary} />
            <Text style={[styles.pillText, { color: COLORS.primary }]}>Reprogrammé</Text>
          </View>
        ) : null}
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreboard}>
        <Pressable
          style={({ pressed }) => [styles.teamCol, pressed && homeRoute && styles.teamColPressed]}
          onPress={() => homeRoute && router.push(homeRoute)}
          disabled={!homeRoute}
        >
          <TeamLogo team={homeTeam} highlight={isHomeWinner} />
          <Text style={[styles.teamName, isFinished && !isHomeWinner && styles.teamNameLoser]} numberOfLines={1}>
            {homeTeam?.name || '-'}
          </Text>
          {homeTeam?.acronym && homeTeam.acronym.toUpperCase() !== (homeTeam.name || '').toUpperCase() ? (
            <Text style={styles.acronym}>{homeTeam.acronym}</Text>
          ) : null}
        </Pressable>

        <View style={styles.center}>
          {hasScores ? (
            <View style={styles.scoreRow}>
              <Text style={[styles.score, isHomeWinner ? styles.scoreWin : styles.scoreLose]}>{homeScore}</Text>
              <Text style={styles.scoreColon}>:</Text>
              <Text style={[styles.score, isAwayWinner ? styles.scoreWin : styles.scoreLose]}>{awayScore}</Text>
            </View>
          ) : (
            <Text style={styles.vs}>VS</Text>
          )}
          {isFinished && match.winner ? (
            <View style={styles.winnerRow}>
              <MaterialCommunityIcons name="trophy" size={12} color={COLORS.accent} />
              <Text style={styles.winnerText}>{(match.winner.acronym || match.winner.name || '').toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={({ pressed }) => [styles.teamCol, pressed && awayRoute && styles.teamColPressed]}
          onPress={() => awayRoute && router.push(awayRoute)}
          disabled={!awayRoute}
        >
          <TeamLogo team={awayTeam} highlight={isAwayWinner} />
          <Text style={[styles.teamName, isFinished && !isAwayWinner && styles.teamNameLoser]} numberOfLines={1}>
            {awayTeam?.name || '-'}
          </Text>
          {awayTeam?.acronym && awayTeam.acronym.toUpperCase() !== (awayTeam.name || '').toUpperCase() ? (
            <Text style={styles.acronym}>{awayTeam.acronym}</Text>
          ) : null}
        </Pressable>
      </View>

      {/* Context info */}
      <View style={styles.infoBar}>
        {match.tournament?.name ? (
          <Text style={styles.infoTournament} numberOfLines={1}>{match.tournament.name}</Text>
        ) : null}
        {match.begin_at ? (
          <View style={styles.infoDate}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={12} color={`${COLORS.accent}80`} />
            <Text style={styles.infoDateText}>{formatDate(match.begin_at)} · {formatTime(match.begin_at)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: COLORS.surface,
  },
  pills: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.live,
  },
  mutedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  mutedPillText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scoreboard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamColPressed: {
    opacity: 0.6,
  },
  teamName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  teamNameLoser: {
    color: COLORS.textMuted,
  },
  acronym: {
    color: `${COLORS.accent}B3`,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  score: {
    fontSize: 44,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreWin: {
    color: COLORS.accent,
  },
  scoreLose: {
    color: 'rgba(255,255,255,0.3)',
  },
  scoreColon: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 24,
    fontWeight: '300',
  },
  vs: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 36,
    fontWeight: '900',
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
  },
  winnerText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  infoBar: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoTournament: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoDateText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
});
