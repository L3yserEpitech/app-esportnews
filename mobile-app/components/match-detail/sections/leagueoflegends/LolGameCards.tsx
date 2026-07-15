// League of Legends rich per-game match-detail cards (RN port of the web
// LolGameCards). Mirrors the Valorant reference structure but with the LoL
// design system: LoL has no map variety, so each per-game block is a "champion
// duel" hero — the KEY champion splash of each team fused at the center, with
// TEAM KILLS as the big numbers (a 1-0 game score is visually pointless), a
// blue/red side pastille per team, an objectives chip strip, a draft row
// (picks role-ordered + struck-through bans), and an op.gg-style scoreboard per
// team (via the shared <Scoreboard> primitive) with an item-build strip below.
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { imageUrl } from '@/utils/imageUrl';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { PandaGame, PandaParticipant, PandaTeam } from '@/types';
import { parseGameWinner, TeamLogo, formatDuration, type MatchSectionProps } from '../shared';
import { parseDraft } from '../draft';
import { Scoreboard } from '../Scoreboard';
import type { StatColumn } from '../statColumns';
import { lolChampSplash, lolChampIcon, lolSpellIcon, lolItemIcon, useLolItemMap } from './lolAssets';

const BLUE = '#38BDF8'; // sky-400
const RED = '#EF4444'; // red-500

const ROLE_ORDER: Record<string, number> = { top: 0, jungle: 1, jgl: 1, mid: 2, bot: 3, adc: 3, support: 4, sup: 4 };
const ROLE_SHORT: Record<string, string> = { top: 'TOP', jungle: 'JGL', jgl: 'JGL', mid: 'MID', bot: 'BOT', adc: 'BOT', support: 'SUP', sup: 'SUP' };
const roleRank = (p: PandaParticipant): number => ROLE_ORDER[(p.role ?? '').toLowerCase()] ?? 9;

const statNum = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null;
const kfmt = (v: unknown): string => {
  const n = statNum(v);
  return n === null ? '-' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
};

const teamParts = (game: PandaGame, teamIndex: 1 | 2): PandaParticipant[] =>
  (game.participants ?? []).filter(p => p.team === teamIndex).slice().sort((a, b) => roleRank(a) - roleRank(b));

// The "star" champion of a team on a game — its splash backs the duel hero:
// best KDA impact, tie-broken on damage. Falls back to the drafted champion 1.
function keyChampion(game: PandaGame, teamIndex: 1 | 2): string | null {
  const parts = (game.participants ?? []).filter(p => p.team === teamIndex && p.character);
  if (!parts.length) {
    const ed = game.extradata;
    return ed ? ((ed[`team${teamIndex}champion1`] as string) ?? null) : null;
  }
  const score = (p: PandaParticipant) =>
    (p.kills ?? 0) * 2 + (p.assists ?? 0) - (p.deaths ?? 0) * 2 + (statNum(p.extra?.damagedone) ?? 0) / 10000;
  return parts.slice().sort((a, b) => score(b) - score(a))[0].character ?? null;
}

const teamKills = (game: PandaGame, teamIndex: 1 | 2): number | null => {
  const parts = (game.participants ?? []).filter(p => p.team === teamIndex);
  if (!parts.length || parts.every(p => p.kills == null)) return null;
  return parts.reduce((s, p) => s + (p.kills ?? 0), 0);
};

const sideColor = (side: unknown): string | null =>
  side === 'blue' ? BLUE : side === 'red' ? RED : null;

// op.gg columns: KDA · KP% · CS · GOLD · DMG. Item build is rendered separately
// (see ItemBuilds) — it doesn't fit the generic string-cell model.
const LOL_COLUMNS: StatColumn[] = [
  {
    key: 'kda',
    label: 'kda',
    fmt: p => ([p.kills, p.deaths, p.assists].every(x => x == null) ? '-' : `${p.kills ?? 0} / ${p.deaths ?? 0} / ${p.assists ?? 0}`),
    align: 'center',
  },
  {
    key: 'kp',
    label: 'kp',
    fmt: p => {
      const kp = statNum(p.extra?.killparticipation);
      return kp === null ? '-' : `${Math.round(kp * 100)}%`;
    },
    align: 'center',
  },
  { key: 'cs', label: 'cs', fmt: p => (statNum(p.extra?.creepscore) ?? '-').toString(), align: 'center' },
  { key: 'gold', label: 'gold', fmt: p => kfmt(p.extra?.gold), align: 'center' },
  { key: 'damage', label: 'damage', fmt: p => kfmt(p.extra?.damagedone), align: 'center' },
];

// A champion tile (draft). Picks: portrait + name. Bans: reduced, dimmed, with
// a diagonal accent strike (RN has no CSS grayscale — we dim + strike instead).
function ChampTile({ name, ban }: { name: string; ban?: boolean }) {
  const icon = imageUrl(lolChampIcon(name)) ?? undefined;
  return (
    <View style={[styles.champTile, ban && styles.champTileBan]}>
      <View style={[styles.champPortrait, ban ? styles.champPortraitBan : styles.champPortraitPick]}>
        <LinearGradient
          colors={['rgba(24,40,89,0.5)', 'rgba(6,11,19,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {icon ? (
          <Image source={{ uri: icon }} style={[StyleSheet.absoluteFill, ban && styles.dimmed]} contentFit="cover" />
        ) : (
          <Text style={styles.champFallback} numberOfLines={2}>{name}</Text>
        )}
        {ban && <View style={styles.banStrike} />}
      </View>
      {!ban && <Text style={styles.champName} numberOfLines={1}>{name}</Text>}
    </View>
  );
}

function DraftRow({ draft }: { draft: NonNullable<ReturnType<typeof parseDraft>> }) {
  const { team1, team2 } = draft;
  if (team1.picks.length === 0 && team2.picks.length === 0 && team1.bans.length === 0 && team2.bans.length === 0) {
    return null;
  }
  return (
    <View style={styles.draftWrap}>
      <View style={styles.draftRow}>
        <View style={styles.draftSide}>
          {team1.picks.map((p, i) => <ChampTile key={`p1-${p}-${i}`} name={p} />)}
        </View>
        <View style={[styles.draftSide, styles.draftSideRight]}>
          {team2.picks.map((p, i) => <ChampTile key={`p2-${p}-${i}`} name={p} />)}
        </View>
        <View style={styles.vsOverlay} pointerEvents="none">
          <Text style={styles.vsText}>VS</Text>
        </View>
      </View>
      {(team1.bans.length > 0 || team2.bans.length > 0) && (
        <View style={styles.bansRow}>
          <View style={styles.bansSide}>
            {team1.bans.length > 0 && <Text style={styles.bansLabel}>BANS</Text>}
            {team1.bans.map((b, i) => <ChampTile key={`b1-${b}-${i}`} name={b} ban />)}
          </View>
          <View style={[styles.bansSide, styles.bansSideRight]}>
            {team2.bans.map((b, i) => <ChampTile key={`b2-${b}-${i}`} name={b} ban />)}
            {team2.bans.length > 0 && <Text style={styles.bansLabel}>BANS</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const OBJECTIVE_KEYS = ['towers', 'dragons', 'barons', 'heralds', 'grubs', 'atakhans', 'inhibitors'] as const;
const OBJECTIVE_LABELS: Record<(typeof OBJECTIVE_KEYS)[number], string> = {
  towers: 'TOURS',
  dragons: 'DRAKES',
  barons: 'BARONS',
  heralds: 'HÉRAUT',
  grubs: 'LARVES',
  atakhans: 'ATAKHAN',
  inhibitors: 'INHIB',
};

function ObjectivesStrip({ game }: { game: PandaGame }) {
  const ed = game.extradata;
  const o1 = ed?.team1objectives as Record<string, unknown> | undefined;
  const o2 = ed?.team2objectives as Record<string, unknown> | undefined;
  if (!o1 && !o2) return null;
  const c1 = sideColor(ed?.team1side) ?? BLUE;
  const c2 = sideColor(ed?.team2side) ?? RED;

  const rows = OBJECTIVE_KEYS
    .map(k => ({ key: k, v1: statNum(o1?.[k]), v2: statNum(o2?.[k]) }))
    .filter(r => r.v1 !== null || r.v2 !== null);
  if (!rows.length) return null;

  return (
    <View style={styles.objStrip}>
      {rows.map(({ key, v1, v2 }) => {
        const d1 = (v1 ?? 0) > (v2 ?? 0);
        const d2 = (v2 ?? 0) > (v1 ?? 0);
        return (
          <View key={key} style={styles.objChip}>
            <Text style={[styles.objVal, { color: c1 }, d1 ? styles.objValDom : styles.objValDim]}>{v1 ?? '-'}</Text>
            <Text style={styles.objLabel}>{OBJECTIVE_LABELS[key]}</Text>
            <Text style={[styles.objVal, { color: c2 }, d2 ? styles.objValDom : styles.objValDim]}>{v2 ?? '-'}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Item build strip under each team's scoreboard: one line per player (role
// order) = champ icon + 2 summoner spells + item icons. Graceful: any missing
// asset is skipped, never crashes.
function ItemBuilds({ game, teamIndex, itemMap }: {
  game: PandaGame;
  teamIndex: 1 | 2;
  itemMap: Record<string, string> | null;
}) {
  const rows = teamParts(game, teamIndex);
  const withBuild = rows.filter(p => {
    const items = p.extra?.items as Record<string, string> | undefined;
    return items && Object.keys(items).length > 0;
  });
  if (withBuild.length === 0) return null;

  return (
    <View style={styles.builds}>
      {rows.map((p, i) => {
        const champ = imageUrl(lolChampIcon(p.character)) ?? undefined;
        const spells = p.extra?.spells as Record<string, string> | undefined;
        const items = p.extra?.items as Record<string, string> | undefined;
        const itemNames = items ? Object.keys(items).sort().map(k => items[k]).filter(Boolean) : [];
        if (itemNames.length === 0 && !champ) return null;
        return (
          <View key={i} style={styles.buildRow}>
            <View style={styles.buildChamp}>
              {champ ? <Image source={{ uri: champ }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            {spells && (
              <View style={styles.buildSpells}>
                {[spells['1'], spells['2']].map((s, j) => {
                  const si = s ? imageUrl(lolSpellIcon(s)) ?? undefined : undefined;
                  return si ? <Image key={j} source={{ uri: si }} style={styles.spellIcon} contentFit="cover" /> : null;
                })}
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buildItems}>
              {itemNames.map((it, j) => {
                const ii = imageUrl(lolItemIcon(it, itemMap)) ?? undefined;
                return ii ? <Image key={`${it}-${j}`} source={{ uri: ii }} style={styles.itemIcon} contentFit="cover" /> : null;
              })}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

function TeamDuelSide({ team, side, winner, dim, reverse }: {
  team?: PandaTeam | null;
  side: unknown;
  winner: boolean;
  dim: boolean;
  reverse?: boolean;
}) {
  const dot = sideColor(side);
  return (
    <View style={[styles.duelSide, reverse && styles.rowReverse, dim && styles.dimmed]}>
      <TeamLogo team={team} size="sm" />
      <View style={[styles.duelNameWrap, reverse && styles.rowReverse]}>
        <Text
          style={[styles.duelName, reverse && styles.textRight, winner && styles.duelNameWin]}
          numberOfLines={1}
        >
          {team?.acronym || team?.name || '-'}
        </Text>
        {dot && <View style={[styles.sideDot, { backgroundColor: dot }]} />}
      </View>
    </View>
  );
}

function ChampionDuelHero({ game, home, away, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming }: {
  game: PandaGame;
  home?: PandaTeam | null;
  away?: PandaTeam | null;
  isHomeWin: boolean;
  isAwayWin: boolean;
  isLive: boolean;
  isFinished: boolean;
  isUpcoming: boolean;
}) {
  const leftSplash = imageUrl(lolChampSplash(keyChampion(game, 1))) ?? undefined;
  const rightSplash = imageUrl(lolChampSplash(keyChampion(game, 2))) ?? undefined;
  const homeKills = teamKills(game, 1);
  const awayKills = teamKills(game, 2);
  const hasKills = homeKills !== null && awayKills !== null;
  const ed = game.extradata;

  const halfDim = (win: boolean) => (isUpcoming ? styles.dimmed : isFinished && !win ? styles.halfLose : null);

  return (
    <View style={[styles.hero, isUpcoming ? styles.heroUpcoming : styles.heroPlayed]}>
      {leftSplash || rightSplash ? (
        <>
          <View style={styles.heroHalfLeft}>
            {leftSplash && (
              <Image source={{ uri: leftSplash }} style={[StyleSheet.absoluteFill, halfDim(isHomeWin)]} contentFit="cover" />
            )}
          </View>
          <View style={styles.heroHalfRight}>
            {rightSplash && (
              <Image source={{ uri: rightSplash }} style={[StyleSheet.absoluteFill, halfDim(isAwayWin)]} contentFit="cover" />
            )}
          </View>
        </>
      ) : (
        <LinearGradient
          colors={['#091626', 'rgba(24,40,89,0.4)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Lateral fade with a bright center seam where the two splashes meet. */}
      <LinearGradient
        colors={[
          'rgba(6,11,19,0.96)',
          'rgba(6,11,19,0.35)',
          'rgba(6,11,19,0.88)',
          'rgba(6,11,19,0.35)',
          'rgba(6,11,19,0.96)',
        ]}
        locations={[0, 0.28, 0.5, 0.72, 1]}
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
          <TeamDuelSide team={home} side={ed?.team1side} winner={isHomeWin} dim={isFinished && !isHomeWin} />
          {hasKills && (
            <View style={styles.scoreLeft}>
              <Text style={[styles.score, isHomeWin ? styles.scoreWin : styles.scoreLose]}>{homeKills}</Text>
            </View>
          )}
        </View>

        <View style={styles.heroCenter}>
          <Text style={[styles.heroLabel, isLive && styles.heroLabelLive]}>
            {isLive ? 'EN DIRECT' : `GAME ${game.position}`}
          </Text>
          {hasKills && (
            <View style={styles.killsRow}>
              <View style={styles.killsRule} />
              <Text style={styles.killsLabel}>KILLS</Text>
              <View style={styles.killsRule} />
            </View>
          )}
          {game.length != null && game.length > 0 && (
            <Text style={styles.durationText}>{formatDuration(game.length)}</Text>
          )}
          {isUpcoming && <Text style={styles.upcomingText}>À venir</Text>}
        </View>

        <View style={[styles.heroSide, styles.heroSideRight]}>
          {hasKills && (
            <View style={styles.scoreRight}>
              <Text style={[styles.score, isAwayWin ? styles.scoreWin : styles.scoreLose]}>{awayKills}</Text>
            </View>
          )}
          <TeamDuelSide team={away} side={ed?.team2side} winner={isAwayWin} dim={isFinished && !isAwayWin} reverse />
        </View>
      </View>
    </View>
  );
}

export default function LolGameCards({ match }: MatchSectionProps) {
  const games = match.games ?? [];
  const itemMap = useLolItemMap();
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

        const draft = parseDraft(game);
        const home1 = teamParts(game, 1);
        const away1 = teamParts(game, 2);
        const hasStats = home1.length > 0 || away1.length > 0;
        const hasDetails = !!draft || hasStats;

        return (
          <View key={game.id ?? idx} style={[styles.block, isLive && styles.blockLive]}>
            <ChampionDuelHero
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
                {draft && <DraftRow draft={draft} />}
                <ObjectivesStrip game={game} />
                {hasStats && (
                  <View style={styles.scoreboards}>
                    <View style={styles.teamCol}>
                      <Scoreboard
                        participants={home1}
                        columns={LOL_COLUMNS}
                        characterIcon={lolChampIcon}
                        teamLabel={home?.acronym || home?.name || '-'}
                        teamLogo={home?.image_url}
                      />
                      <ItemBuilds game={game} teamIndex={1} itemMap={itemMap} />
                    </View>
                    <View style={styles.teamCol}>
                      <Scoreboard
                        participants={away1}
                        columns={LOL_COLUMNS}
                        characterIcon={lolChampIcon}
                        teamLabel={away?.acronym || away?.name || '-'}
                        teamLogo={away?.image_url}
                      />
                      <ItemBuilds game={game} teamIndex={2} itemMap={itemMap} />
                    </View>
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
  dimmed: {
    opacity: 0.5,
  },

  // Champion duel hero
  hero: {
    justifyContent: 'center',
  },
  heroPlayed: {
    height: 120,
  },
  heroUpcoming: {
    height: 76,
  },
  heroHalfLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '50%',
    overflow: 'hidden',
  },
  heroHalfRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '50%',
    overflow: 'hidden',
  },
  halfLose: {
    opacity: 0.55,
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
  duelSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    flexShrink: 1,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  duelNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    minWidth: 0,
  },
  duelName: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  duelNameWin: {
    color: COLORS.text,
  },
  textRight: {
    textAlign: 'right',
  },
  sideDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    color: 'rgba(255,255,255,0.85)',
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
  killsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  killsRule: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  killsLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
  },
  durationText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
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

  // Draft
  draftWrap: {
    gap: spacing.sm,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  draftSide: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  draftSideRight: {
    justifyContent: 'flex-end',
  },
  vsOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: {
    color: 'rgba(107,114,128,0.4)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  bansRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bansSide: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  bansSideRight: {
    justifyContent: 'flex-end',
  },
  bansLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  champTile: {
    alignItems: 'center',
    gap: 2,
  },
  champTileBan: {
    opacity: 0.6,
  },
  champPortrait: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  champPortraitPick: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    borderColor: 'rgba(24,40,89,0.6)',
  },
  champPortraitBan: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.xs,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  banStrike: {
    position: 'absolute',
    width: '140%',
    height: 2,
    backgroundColor: 'rgba(242,46,98,0.9)',
    transform: [{ rotate: '45deg' }],
  },
  champFallback: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  champName: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 46,
  },

  // Objectives
  objStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  objChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(6,11,19,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  objVal: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  objValDom: {
    fontWeight: '800',
  },
  objValDim: {
    opacity: 0.7,
  },
  objLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Scoreboards + item builds
  scoreboards: {
    gap: spacing.md,
  },
  teamCol: {
    gap: spacing.sm,
  },
  builds: {
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  buildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buildChamp: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(24,40,89,0.5)',
  },
  buildSpells: {
    flexDirection: 'column',
    gap: 2,
  },
  spellIcon: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  buildItems: {
    gap: 3,
    alignItems: 'center',
  },
  itemIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
