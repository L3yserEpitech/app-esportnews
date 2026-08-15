// Rocket League per-game match-detail cards (RN port of the web RlGameCards).
// Light tier: arena hero + goals per game + an OT badge. Two v3 extradata keys:
//   - ot: "true" | "t" (two observed truthy variants) → overtime flag
//   - otlength: string like "+2:13" → shown verbatim in the badge
// Opponents are often 1v1 (opponent.type === 'solo') → no team logo is shown for
// a solo side; rlArenaImage is an empty registry today (navy-gradient fallback).
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { imageUrl } from '@/utils/imageUrl';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { PandaGame, PandaTeam } from '@/types';
import { parseGameWinner, TeamLogo, type MatchSectionProps } from '../shared';
import { rlArenaImage } from './rlAssets';

function parseOT(extradata?: Record<string, unknown>): { isOT: boolean; otlength: string | null } {
  const ot = extradata?.ot;
  const isOT = ot === 'true' || ot === 't' || ot === true;
  const otlength = typeof extradata?.otlength === 'string' ? extradata.otlength : null;
  return { isOT, otlength };
}

function TeamMini({ team, isSolo, winner, dim, reverse }: {
  team?: PandaTeam | null;
  isSolo: boolean;
  winner: boolean;
  dim: boolean;
  reverse?: boolean;
}) {
  return (
    <View style={[styles.teamMini, reverse && styles.rowReverse, dim && styles.dimmed]}>
      {/* Solo (1v1) opponents have no team entity → no logo. */}
      {!isSolo && <TeamLogo team={team} size="sm" />}
      <Text
        style={[styles.teamName, reverse && styles.textRight, winner ? styles.teamNameWin : null]}
        numberOfLines={1}
      >
        {team?.acronym || team?.name || '-'}
      </Text>
    </View>
  );
}

function ScoreText({ value, winner }: { value: number; winner: boolean }) {
  return <Text style={[styles.score, winner ? styles.scoreWin : styles.scoreLose]}>{value}</Text>;
}

function ArenaHero({ game, home, away, isSoloHome, isSoloAway, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming }: {
  game: PandaGame;
  home?: PandaTeam | null;
  away?: PandaTeam | null;
  isSoloHome: boolean;
  isSoloAway: boolean;
  isHomeWin: boolean;
  isAwayWin: boolean;
  isLive: boolean;
  isFinished: boolean;
  isUpcoming: boolean;
}) {
  const splash = imageUrl(rlArenaImage(game.map)) ?? undefined;
  const homeScore = game.scores?.[0];
  const awayScore = game.scores?.[1];
  const hasScores = homeScore !== undefined && awayScore !== undefined;
  const { isOT, otlength } = parseOT(game.extradata);

  return (
    <View style={[styles.hero, isUpcoming ? styles.heroUpcoming : styles.heroPlayed]}>
      {splash ? (
        <Image
          source={{ uri: splash }}
          style={[StyleSheet.absoluteFill, isUpcoming && styles.dimmed]}
          contentFit="cover"
        />
      ) : (
        <LinearGradient
          colors={['#091626', 'rgba(24,40,89,0.4)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <LinearGradient
        colors={[
          'rgba(6,11,19,0.96)',
          'rgba(6,11,19,0.6)',
          'rgba(6,11,19,0.25)',
          'rgba(6,11,19,0.6)',
          'rgba(6,11,19,0.96)',
        ]}
        locations={[0, 0.35, 0.5, 0.65, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(6,11,19,0.35)', 'transparent', 'transparent', 'rgba(6,11,19,0.45)']}
        locations={[0, 0.3, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {isHomeWin && <View style={[styles.winBar, styles.winBarLeft]} />}
      {isAwayWin && <View style={[styles.winBar, styles.winBarRight]} />}
      {isLive && <View style={[styles.winBar, styles.winBarLeft, styles.liveBar]} />}

      <View style={styles.heroContent}>
        <View style={styles.heroSide}>
          <TeamMini team={home} isSolo={isSoloHome} winner={isHomeWin} dim={isFinished && !isHomeWin} />
          {hasScores && (
            <View style={styles.scoreLeft}>
              <ScoreText value={homeScore!} winner={isHomeWin} />
            </View>
          )}
        </View>

        <View style={styles.heroCenter}>
          <Text style={[styles.heroLabel, isLive && styles.heroLabelLive]}>
            {isLive ? 'EN DIRECT' : `GAME ${game.position}`}
          </Text>
          {game.map ? (
            <View style={styles.mapNameRow}>
              <View style={styles.mapRule} />
              <Text style={styles.mapName} numberOfLines={1}>
                {game.map}
              </Text>
              <View style={styles.mapRule} />
            </View>
          ) : null}
          {isUpcoming && <Text style={styles.upcomingText}>À venir</Text>}
          {isOT && !isUpcoming && (
            <View style={styles.otBadge}>
              <Text style={styles.otText}>{otlength ? `OT ${otlength}` : 'OT'}</Text>
            </View>
          )}
        </View>

        <View style={[styles.heroSide, styles.heroSideRight]}>
          {hasScores && (
            <View style={styles.scoreRight}>
              <ScoreText value={awayScore!} winner={isAwayWin} />
            </View>
          )}
          <TeamMini team={away} isSolo={isSoloAway} winner={isAwayWin} dim={isFinished && !isAwayWin} reverse />
        </View>
      </View>
    </View>
  );
}

export default function RlGameCards({ match }: MatchSectionProps) {
  const games = match.games ?? [];
  if (games.length === 0) return null;
  const homeOpp = match.opponents?.[0];
  const awayOpp = match.opponents?.[1];
  const home = homeOpp?.opponent || homeOpp?.team;
  const away = awayOpp?.opponent || awayOpp?.team;
  const isSoloHome = homeOpp?.type === 'solo';
  const isSoloAway = awayOpp?.type === 'solo';

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

        return (
          <View key={game.id ?? idx} style={[styles.block, isLive && styles.blockLive]}>
            <ArenaHero
              game={game}
              home={home}
              away={away}
              isSoloHome={isSoloHome}
              isSoloAway={isSoloAway}
              isHomeWin={isHomeWin}
              isAwayWin={isAwayWin}
              isLive={isLive}
              isFinished={isFinished}
              isUpcoming={isUpcoming}
            />
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
  heroCenter: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 104,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 3,
  },
  heroLabelLive: {
    color: COLORS.live,
  },
  mapNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapRule: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  mapName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    flexShrink: 1,
  },
  upcomingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 2,
  },
  otBadge: {
    marginTop: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(242,46,98,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(242,46,98,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  otText: {
    color: COLORS.accent,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
