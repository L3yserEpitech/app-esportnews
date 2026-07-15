// EA Sports FC per-game match-detail cards (RN port of the web FcGameCards).
// Light tier: football score cards. Liquipedia exposes no stadium image (the
// `map` field is just "Game N" and is ignored), so the navy-gradient hero
// replaces the splash. The differentiator is the penalty-shootout pill from
// extradata.penaltyscores = { "1": home, "2": away } — a game can be won on a
// level/null score, decided on penalties, so the winner is honoured regardless.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { PandaGame, PandaTeam } from '@/types';
import { parseGameWinner, TeamLogo, type MatchSectionProps } from '../shared';

// penaltyscores is a Lua object {"1": <home>, "2": <away>} — NOT an array.
function parsePenalties(extradata?: Record<string, unknown>): { home: number; away: number } | null {
  const raw = extradata?.penaltyscores;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const home = Number(obj['1']);
  const away = Number(obj['2']);
  if (isNaN(home) || isNaN(away)) return null;
  return { home, away };
}

function TeamMini({ team, winner, dim, reverse }: {
  team?: PandaTeam | null;
  winner: boolean;
  dim: boolean;
  reverse?: boolean;
}) {
  return (
    <View style={[styles.teamMini, reverse && styles.rowReverse, dim && styles.dimmed]}>
      <TeamLogo team={team} size="sm" />
      <Text
        style={[styles.teamName, reverse && styles.textRight, winner ? styles.teamNameWin : null]}
        numberOfLines={1}
      >
        {team?.acronym || team?.name || '-'}
      </Text>
    </View>
  );
}

export default function FcGameCards({ match }: MatchSectionProps) {
  const games = match.games ?? [];
  if (games.length === 0) return null;
  const home = match.opponents?.[0]?.opponent || match.opponents?.[0]?.team;
  const away = match.opponents?.[1]?.opponent || match.opponents?.[1]?.team;

  return (
    <View style={styles.stack}>
      {games.map((game, idx) => {
        const winnerData = parseGameWinner(game.winner);
        const winnerTeam = winnerData?.id
          ? match.opponents?.find(o => (o.opponent || o.team)?.id === winnerData.id)
          : null;
        const winId = (winnerTeam?.opponent || winnerTeam?.team)?.id ?? null;
        const isHomeWin = winId != null && winId === home?.id;
        const isAwayWin = winId != null && winId === away?.id;
        const isLive = game.status === 'running';
        const isFinished = game.finished;
        const isUpcoming = !isFinished && !isLive;
        const homeScore = game.scores?.[0];
        const awayScore = game.scores?.[1];
        const hasScores = homeScore !== undefined && awayScore !== undefined;
        const penalties = parsePenalties(game.extradata);
        const penHomeWin = penalties ? penalties.home > penalties.away : false;
        const penAwayWin = penalties ? penalties.away > penalties.home : false;

        return (
          <View key={game.id ?? idx} style={[styles.block, isLive && styles.blockLive]}>
            <View style={[styles.hero, isUpcoming ? styles.heroUpcoming : styles.heroPlayed]}>
              <LinearGradient
                colors={['#091626', 'rgba(24,40,89,0.4)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              {isHomeWin && <View style={[styles.winBar, styles.winBarLeft]} />}
              {isAwayWin && <View style={[styles.winBar, styles.winBarRight]} />}
              {isLive && <View style={[styles.winBar, styles.winBarLeft, styles.liveBar]} />}

              <View style={styles.heroContent}>
                <View style={styles.heroSide}>
                  <TeamMini team={home} winner={isHomeWin} dim={isFinished && !isHomeWin} />
                  {hasScores && (
                    <View style={styles.scoreLeft}>
                      <Text style={[styles.score, isHomeWin ? styles.scoreWin : isFinished && isAwayWin ? styles.scoreLose : styles.scoreNeutral]}>
                        {homeScore}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.heroCenter}>
                  <Text style={[styles.heroLabel, isLive && styles.heroLabelLive]}>
                    {isLive ? 'EN DIRECT' : `GAME ${game.position}`}
                  </Text>
                  {isUpcoming && <Text style={styles.upcomingText}>À venir</Text>}
                </View>

                <View style={[styles.heroSide, styles.heroSideRight]}>
                  {hasScores && (
                    <View style={styles.scoreRight}>
                      <Text style={[styles.score, isAwayWin ? styles.scoreWin : isFinished && isHomeWin ? styles.scoreLose : styles.scoreNeutral]}>
                        {awayScore}
                      </Text>
                    </View>
                  )}
                  <TeamMini team={away} winner={isAwayWin} dim={isFinished && !isAwayWin} reverse />
                </View>
              </View>
            </View>

            {penalties && (
              <View style={styles.penRow}>
                <Text style={styles.penLabel}>Tirs au but</Text>
                <View style={styles.penChip}>
                  <Text style={[styles.penScore, penHomeWin ? styles.penWin : styles.penLose]}>{penalties.home}</Text>
                  <Text style={styles.penDash}>–</Text>
                  <Text style={[styles.penScore, penAwayWin ? styles.penWin : styles.penLose]}>{penalties.away}</Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  block: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  blockLive: {
    borderColor: `${COLORS.live}66`,
  },
  hero: {
    justifyContent: 'center',
  },
  heroPlayed: {
    height: 120,
  },
  heroUpcoming: {
    height: 76,
  },
  dimmed: {
    opacity: 0.5,
  },
  winBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.accent,
  },
  winBarLeft: {
    left: 0,
  },
  winBarRight: {
    right: 0,
  },
  liveBar: {
    backgroundColor: COLORS.live,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  heroSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  heroSideRight: {
    justifyContent: 'flex-end',
  },
  scoreLeft: {
    marginLeft: 'auto',
    paddingLeft: spacing.sm,
  },
  scoreRight: {
    marginRight: 'auto',
    paddingRight: spacing.sm,
  },
  teamMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    flexShrink: 1,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  teamName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  teamNameWin: {
    color: COLORS.text,
  },
  textRight: {
    textAlign: 'right',
  },
  score: {
    fontSize: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreWin: {
    color: COLORS.accent,
    textShadowColor: 'rgba(242,46,98,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  scoreLose: {
    color: 'rgba(255,255,255,0.45)',
  },
  scoreNeutral: {
    color: COLORS.text,
  },
  heroCenter: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroLabelLive: {
    color: COLORS.live,
  },
  upcomingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 2,
  },
  penRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(9,22,38,0.4)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  penLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  penChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(6,11,19,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(31,41,55,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  penScore: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  penWin: {
    color: COLORS.accent,
  },
  penLose: {
    color: COLORS.textSecondary,
  },
  penDash: {
    color: 'rgba(107,114,128,0.5)',
    fontSize: 10,
  },
});
