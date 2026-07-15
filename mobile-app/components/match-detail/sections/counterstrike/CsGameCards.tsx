// Counter-Strike 2 per-map match-detail cards (RN port of the web CsGameCards).
// Tier-2 FPS: a vertical stack of per-map blocks, each = map-screenshot hero
// (round scores + map name) + a CT/T half-by-half chip row. CS has NO player
// stats on the Liquipedia v3 API (the Lua modules don't expose them — the
// per-player detail lives on HLTV, handled by the externalLinks section) and the
// API does NOT return mapveto for CS, so neither is rendered here.
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
import { csMapImage } from './csAssets';

// HLTV side colours: CT sky-blue, T orange.
const SIDE_COLORS: Record<string, string> = {
  ct: '#38BDF8',
  t: '#FB923C',
};

// Lua tables arrive as objects {"1": 8, "2": 5} (sometimes arrays) — flatten to
// an ordered list of the half values.
function orderedValues(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const out: string[] = [];
    for (let i = 1; obj[String(i)] !== undefined; i++) out.push(String(obj[String(i)]));
    return out;
  }
  return [];
}

type Half = { label: string; t1: string; t2: string; t1side: string; t2side: string };

function parseHalves(game: PandaGame, otLabel: string): Half[] {
  const ed = game.extradata;
  if (!ed) return [];
  const t1 = orderedValues(ed.t1halfs);
  const t2 = orderedValues(ed.t2halfs);
  const t1sides = orderedValues(ed.t1sides).map(s => s.toLowerCase());
  const t2sides = orderedValues(ed.t2sides).map(s => s.toLowerCase());
  const n = Math.min(t1.length, t2.length);
  const halves: Half[] = [];
  for (let i = 0; i < n; i++) {
    halves.push({
      label: i < 2 ? `H${i + 1}` : `${otLabel}${n > 3 ? i - 1 : ''}`,
      t1: t1[i],
      t2: t2[i],
      t1side: t1sides[i] || '',
      t2side: t2sides[i] || '',
    });
  }
  return halves;
}

function HalfChip({ half }: { half: Half }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{half.label}</Text>
      <Text style={[styles.chipScore, { color: SIDE_COLORS[half.t1side] || COLORS.text }]}>{half.t1}</Text>
      <Text style={styles.chipColon}>:</Text>
      <Text style={[styles.chipScore, { color: SIDE_COLORS[half.t2side] || COLORS.text }]}>{half.t2}</Text>
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

function MapHero({ game, home, away, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming }: {
  game: PandaGame;
  home?: PandaTeam | null;
  away?: PandaTeam | null;
  isHomeWin: boolean;
  isAwayWin: boolean;
  isLive: boolean;
  isFinished: boolean;
  isUpcoming: boolean;
}) {
  const splash = imageUrl(csMapImage(game.map)) ?? undefined;
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

export default function CsGameCards({ match }: MatchSectionProps) {
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

        const halves = parseHalves(game, 'OT');

        return (
          <View key={game.id ?? idx} style={[styles.block, isLive && styles.blockLive]}>
            <MapHero
              game={game}
              home={home}
              away={away}
              isHomeWin={isHomeWin}
              isAwayWin={isAwayWin}
              isLive={isLive}
              isFinished={isFinished}
              isUpcoming={isUpcoming}
            />

            {halves.length > 0 && (
              <View style={styles.halvesRow}>
                <View style={styles.chips}>
                  {halves.map((h, i) => <HalfChip key={i} half={h} />)}
                </View>
                <View style={styles.legend}>
                  <Text style={[styles.legendItem, { color: SIDE_COLORS.ct }]}>CT</Text>
                  <Text style={[styles.legendItem, { color: SIDE_COLORS.t }]}>T</Text>
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
  upcomingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    marginTop: 2,
  },

  // Halves
  halvesRow: {
    backgroundColor: 'rgba(9,22,38,0.4)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(6,11,19,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(31,41,55,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipScore: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  chipColon: {
    color: 'rgba(107,114,128,0.5)',
    fontSize: 10,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  legendItem: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
