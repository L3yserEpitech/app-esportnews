// Overwatch per-map match-detail cards (RN port of the web OwGameCards).
// Tier-2 FPS: per-map blocks, each = map-screenshot hero (score + map name +
// a factual game-mode chip sourced from the asset mapper, never guessed) + a
// hero-bans row (1 ban per team in OWCS: team{n}ban1, with a "1" badge on the
// team that banned first via banstart). Overwatch has no per-player stats on the
// Liquipedia v3 API, so no scoreboard is rendered.
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
import { owMapImage, owMapMode, owHeroPortrait } from './owAssets';

// Bans are numbered team{n}ban{k} (1 per team in OWCS, but read every present
// index just in case).
function bansFor(ed: Record<string, unknown> | undefined, teamIndex: 1 | 2): string[] {
  if (!ed) return [];
  const out: string[] = [];
  for (let i = 1; ed[`team${teamIndex}ban${i}`] != null && i <= 10; i++) {
    out.push(String(ed[`team${teamIndex}ban${i}`]));
  }
  return out;
}

// Diagonal accent stripe overlay approximating the web "struck-through" look.
function StrikeOverlay() {
  return (
    <LinearGradient
      colors={['transparent', 'transparent', 'rgba(242,46,98,0.9)', 'rgba(242,46,98,0.9)', 'transparent', 'transparent']}
      locations={[0, 0.46, 0.48, 0.52, 0.54, 1]}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

function BanTile({ name, first }: { name: string; first: boolean }) {
  const img = imageUrl(owHeroPortrait(name)) ?? undefined;
  return (
    <View style={styles.banTile}>
      <View style={styles.banPortrait}>
        <LinearGradient
          colors={['rgba(24,40,89,0.5)', 'rgba(6,11,19,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {img ? (
          <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" />
        ) : (
          <Text style={styles.banFallback} numberOfLines={2}>{name}</Text>
        )}
        <StrikeOverlay />
        {first && (
          <View style={styles.banFirstBadge}>
            <Text style={styles.banFirstText}>1</Text>
          </View>
        )}
      </View>
      <Text style={styles.banName} numberOfLines={1}>{name}</Text>
    </View>
  );
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

function ScoreText({ value, winner }: { value: number; winner: boolean }) {
  return <Text style={[styles.score, winner ? styles.scoreWin : styles.scoreLose]}>{value}</Text>;
}

function MapHero({ game, home, away, mode, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming }: {
  game: PandaGame;
  home?: PandaTeam | null;
  away?: PandaTeam | null;
  mode: string | null;
  isHomeWin: boolean;
  isAwayWin: boolean;
  isLive: boolean;
  isFinished: boolean;
  isUpcoming: boolean;
}) {
  const splash = imageUrl(owMapImage(game.map)) ?? undefined;
  const homeScore = game.scores?.[0];
  const awayScore = game.scores?.[1];
  const hasScores = homeScore !== undefined && awayScore !== undefined;

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
          <TeamMini team={home} winner={isHomeWin} dim={isFinished && !isHomeWin} />
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
          {mode ? (
            <View style={styles.modeChip}>
              <Text style={styles.modeText}>{mode}</Text>
            </View>
          ) : null}
          {isUpcoming && <Text style={styles.upcomingText}>À venir</Text>}
        </View>

        <View style={[styles.heroSide, styles.heroSideRight]}>
          {hasScores && (
            <View style={styles.scoreRight}>
              <ScoreText value={awayScore!} winner={isAwayWin} />
            </View>
          )}
          <TeamMini team={away} winner={isAwayWin} dim={isFinished && !isAwayWin} reverse />
        </View>
      </View>
    </View>
  );
}

export default function OwGameCards({ match }: MatchSectionProps) {
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

        const mode = owMapMode(game.map);
        const ed = game.extradata;
        const homeBans = bansFor(ed, 1);
        const awayBans = bansFor(ed, 2);
        const banstart = ed?.banstart != null ? Number(ed.banstart) : null;
        const hasBans = homeBans.length > 0 || awayBans.length > 0;

        return (
          <View key={game.id ?? idx} style={[styles.block, isLive && styles.blockLive]}>
            <MapHero
              game={game}
              home={home}
              away={away}
              mode={mode}
              isHomeWin={isHomeWin}
              isAwayWin={isAwayWin}
              isLive={isLive}
              isFinished={isFinished}
              isUpcoming={isUpcoming}
            />

            {hasBans && (
              <View style={styles.bansRow}>
                <View style={styles.bansSide}>
                  <Text style={styles.bansLabel}>BANS</Text>
                  <View style={styles.bansTiles}>
                    {homeBans.map((b, i) => <BanTile key={`h-${b}-${i}`} name={b} first={banstart === 1 && i === 0} />)}
                  </View>
                </View>
                <View style={[styles.bansSide, styles.bansSideRight]}>
                  <Text style={[styles.bansLabel, styles.textRight]}>BANS</Text>
                  <View style={[styles.bansTiles, styles.bansTilesRight]}>
                    {awayBans.map((b, i) => <BanTile key={`a-${b}-${i}`} name={b} first={banstart === 2 && i === 0} />)}
                  </View>
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

  // Map hero
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
    minWidth: 96,
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
    gap: spacing.sm,
  },
  mapRule: {
    width: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  mapName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  modeChip: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(6,11,19,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  upcomingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 2,
  },

  // Bans
  bansRow: {
    backgroundColor: 'rgba(9,22,38,0.4)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.md,
  },
  bansSide: {
    flex: 1,
    gap: spacing.sm,
  },
  bansSideRight: {
    alignItems: 'flex-end',
  },
  bansLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bansTiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bansTilesRight: {
    justifyContent: 'flex-end',
  },
  banTile: {
    alignItems: 'center',
    gap: 2,
  },
  banPortrait: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(31,41,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  banFallback: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  banFirstBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 4,
    backgroundColor: 'rgba(242,46,98,0.8)',
    borderBottomRightRadius: borderRadius.sm,
  },
  banFirstText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 8,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  banName: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 44,
  },
});
