// Rainbow Six Siege per-map match-detail cards (RN port of the web R6GameCards).
// Tier-2 FPS: per-map blocks, each = map-background hero (round scores + map
// name) + operator bans (struck-through tiles with an atk/def badge) + an
// aggregated ATK/DEF split chip per team. The v3 API only exposes aggregated
// {atk, def} half totals (NOT sequential H1/H2/OT) and no per-player scoreboard.
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
import { r6MapImage, r6OperatorIcon } from './r6Assets';

// R6 side colours: attack orange, defence sky-blue.
const SIDE_COLORS: Record<string, string> = {
  atk: '#FB923C',
  def: '#38BDF8',
};

// Lua tables arrive as objects {"1": "Azami"} (sometimes arrays) — flatten.
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

const num = (v: unknown): number | null => {
  const s = String(v ?? '').trim();
  return s !== '' && !isNaN(+s) ? +s : null;
};

// Split of the rounds a team won by side. t{n}halfs = an aggregated {atk, def}
// object (no sequential halves / OT in the API). t{n}firstside.rt = the side
// played first in regulation, used to order the chip.
type SideSplit = { atk: number | null; def: number | null; first: string | null };

function sideSplit(game: PandaGame, teamIndex: 1 | 2): SideSplit | null {
  const ed = game.extradata;
  if (!ed) return null;
  const halfs = ed[`t${teamIndex}halfs`] as Record<string, unknown> | undefined;
  if (!halfs || typeof halfs !== 'object') return null;
  const atk = num(halfs.atk);
  const def = num(halfs.def);
  if (atk === null && def === null) return null;
  const firstRaw = ed[`t${teamIndex}firstside`] as Record<string, unknown> | undefined;
  const first = firstRaw && typeof firstRaw === 'object' ? String(firstRaw.rt ?? '').toLowerCase() || null : null;
  return { atk, def, first };
}

type Ban = { operator: string; side: string };

function bans(game: PandaGame, teamIndex: 1 | 2): Ban[] {
  const ed = game.extradata;
  if (!ed) return [];
  const ops = orderedValues(ed[`t${teamIndex}bans`]);
  const types = orderedValues(ed[`t${teamIndex}bantypes`]).map(s => s.toLowerCase());
  return ops
    .map((operator, i) => ({ operator: operator.trim(), side: types[i] || '' }))
    .filter(b => b.operator !== '');
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

function BanTile({ ban, reverse }: { ban: Ban; reverse: boolean }) {
  const icon = imageUrl(r6OperatorIcon(ban.operator)) ?? undefined;
  const sideColor = SIDE_COLORS[ban.side];
  return (
    <View style={styles.banTile}>
      <View style={styles.banPortrait}>
        <LinearGradient
          colors={['rgba(24,40,89,0.5)', 'rgba(6,11,19,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {icon ? (
          <Image source={{ uri: icon }} style={styles.banIcon} contentFit="contain" />
        ) : (
          <Text style={styles.banFallback} numberOfLines={2}>{ban.operator}</Text>
        )}
        <StrikeOverlay />
        {ban.side ? (
          <View style={[styles.banSideBadge, reverse ? styles.banSideBadgeLeft : styles.banSideBadgeRight]}>
            <Text style={[styles.banSideText, { color: sideColor || COLORS.textMuted }]}>{ban.side}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.banName} numberOfLines={1}>{ban.operator}</Text>
    </View>
  );
}

function SideSplitChip({ split, reverse, label }: { split: SideSplit; reverse: boolean; label: string }) {
  const atkGroup = (
    <View style={styles.splitGroup}>
      <Text style={[styles.splitLabel, { color: SIDE_COLORS.atk }]}>ATK</Text>
      <Text style={[styles.splitVal, { color: SIDE_COLORS.atk }]}>{split.atk ?? '-'}</Text>
    </View>
  );
  const defGroup = (
    <View style={styles.splitGroup}>
      <Text style={[styles.splitLabel, { color: SIDE_COLORS.def }]}>DEF</Text>
      <Text style={[styles.splitVal, { color: SIDE_COLORS.def }]}>{split.def ?? '-'}</Text>
    </View>
  );
  const first = split.first === 'def' ? [defGroup, atkGroup] : [atkGroup, defGroup];
  const groups = reverse ? [...first].reverse() : first;
  return (
    <View style={[styles.splitChip, reverse && styles.rowReverse]}>
      <Text style={styles.splitTeam} numberOfLines={1}>{label}</Text>
      {groups[0]}
      <Text style={styles.splitDot}>·</Text>
      {groups[1]}
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
  const splash = imageUrl(r6MapImage(game.map)) ?? undefined;
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

export default function R6GameCards({ match }: MatchSectionProps) {
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

        const homeBans = bans(game, 1);
        const awayBans = bans(game, 2);
        const hasBans = homeBans.length > 0 || awayBans.length > 0;
        const homeSplit = sideSplit(game, 1);
        const awaySplit = sideSplit(game, 2);
        const hasSplit = !!homeSplit || !!awaySplit;
        const hasDetails = hasBans || hasSplit;

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

            {hasDetails && (
              <View style={styles.details}>
                {hasBans && (
                  <View style={styles.bansRow}>
                    <View style={styles.bansSide}>
                      {homeBans.length > 0 && <Text style={styles.bansLabel}>BANS</Text>}
                      <View style={styles.bansTiles}>
                        {homeBans.map((b, i) => <BanTile key={`${b.operator}-${i}`} ban={b} reverse={false} />)}
                      </View>
                    </View>
                    <View style={[styles.bansSide, styles.bansSideRight]}>
                      {awayBans.length > 0 && <Text style={[styles.bansLabel, styles.textRight]}>BANS</Text>}
                      <View style={[styles.bansTiles, styles.bansTilesRight]}>
                        {awayBans.map((b, i) => <BanTile key={`${b.operator}-${i}`} ban={b} reverse={true} />)}
                      </View>
                    </View>
                  </View>
                )}

                {hasSplit && (
                  <View style={styles.splitRow}>
                    {homeSplit && <SideSplitChip split={homeSplit} reverse={false} label={home?.acronym || home?.name || '-'} />}
                    {awaySplit && <SideSplitChip split={awaySplit} reverse={true} label={away?.acronym || away?.name || '-'} />}
                  </View>
                )}
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

  // Details
  details: {
    backgroundColor: 'rgba(9,22,38,0.4)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    padding: spacing.md,
    gap: spacing.lg,
  },
  bansRow: {
    flexDirection: 'row',
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
    borderColor: 'rgba(31,41,55,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  banIcon: {
    width: '75%',
    height: '75%',
  },
  banFallback: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  banSideBadge: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: 'rgba(6,11,19,0.85)',
    paddingHorizontal: 2,
  },
  banSideBadgeRight: {
    right: 0,
    borderTopLeftRadius: borderRadius.sm,
  },
  banSideBadgeLeft: {
    left: 0,
    borderTopRightRadius: borderRadius.sm,
  },
  banSideText: {
    fontSize: 7,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  banName: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 44,
  },
  splitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  splitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(6,11,19,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(31,41,55,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  splitTeam: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 80,
  },
  splitGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  splitLabel: {
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  splitVal: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  splitDot: {
    color: 'rgba(107,114,128,0.4)',
    fontSize: 10,
  },
});
