// Dota 2 rich per-game match-detail cards (RN port of the web DotaGameCards).
// Very close to the LoL card: no map variety, so each per-game block is a "hero
// duel" — the KEY hero art of each team fused at the center, with TEAM KILLS as
// the big numbers, a Radiant/Dire side pastille per team, an objectives chip
// strip (towers/barracks/Roshan), a draft row (picks + struck-through bans as
// LANDSCAPE 16:9 tiles, vetophase-ordered when present), and a Dotabuff-style
// scoreboard per team (via the shared <Scoreboard> primitive, sorted by net
// worth) with an items/aghanim/neutral strip below. Rich data (participants /
// objectives / vetophase) only exists on imported BigMatch events — small
// events have only picks/bans/side, so every block degrades gracefully.
import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUrl } from '@/utils/imageUrl';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { PandaMatch, PandaGame, PandaParticipant, PandaTeam } from '@/types';
import { parseGameWinner, TeamLogo, formatDuration } from '../shared';
import { parseDraft } from '../draft';
import { Scoreboard } from '../Scoreboard';
import type { StatColumn } from '../statColumns';
import { useDotaAssets, dotaHeroImage, dotaItemIcon, type DotaAssetMaps } from './dotaAssets';

// True when a game carries drill-down worthy data (draft picks or a per-player
// scoreboard). Dota's real draft lives in vetophase, so pick-type veto steps
// count too. Callers gate banner tappability / game-page existence on this.
export function hasGameDetails(game: PandaGame): boolean {
  const draft = parseDraft(game);
  const hasPicks = !!draft && (draft.team1.picks.length > 0 || draft.team2.picks.length > 0);
  const veto = parseVeto(game);
  const hasVetoPicks = !!veto && veto.some(s => s.type === 'pick');
  return hasPicks || hasVetoPicks || (game.participants?.length ?? 0) > 0;
}

const RADIANT = '#34D399'; // emerald-400
const DIRE = '#F87171'; // red-400
const AMBER = '#F59E0B';

const sideColor = (side: unknown): string | null =>
  side === 'radiant' ? RADIANT : side === 'dire' ? DIRE : null;

const statNum = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null;
const kfmt = (v: unknown): string => {
  const n = statNum(v);
  return n === null ? '-' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
};

// No roles in Dota participants → Dotabuff sort by net worth desc.
const teamParts = (game: PandaGame, teamIndex: 1 | 2): PandaParticipant[] =>
  (game.participants ?? [])
    .filter(p => p.team === teamIndex)
    .slice()
    .sort((a, b) => (statNum(b.extra?.gold) ?? -1) - (statNum(a.extra?.gold) ?? -1));

// The "star" hero of a team on a game — best KDA impact, tie-broken on damage.
// Its art backs the duel. Falls back to the drafted hero 1.
function keyHero(game: PandaGame, teamIndex: 1 | 2): string | null {
  const parts = (game.participants ?? []).filter(p => p.team === teamIndex && p.character);
  if (!parts.length) {
    const ed = game.extradata;
    return ed ? ((ed[`team${teamIndex}hero1`] as string) ?? null) : null;
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

// Dotabuff columns: KDA · NW · GPM · XPM · LH/DN · DMG. The items build is
// rendered separately (see ItemsStrip) — it doesn't fit the string-cell model.
const DOTA_COLUMNS: StatColumn[] = [
  {
    key: 'kda',
    label: 'kda',
    fmt: p => ([p.kills, p.deaths, p.assists].every(x => x == null) ? '-' : `${p.kills ?? 0} / ${p.deaths ?? 0} / ${p.assists ?? 0}`),
    align: 'center',
  },
  { key: 'nw', label: 'net_worth', fmt: p => kfmt(p.extra?.gold), align: 'center' },
  { key: 'gpm', label: 'gpm', fmt: p => (statNum(p.extra?.gpm) ?? '-').toString(), align: 'center' },
  { key: 'xpm', label: 'xpm', fmt: p => (statNum(p.extra?.xpm) ?? '-').toString(), align: 'center' },
  {
    key: 'lhdn',
    label: 'lh_dn',
    fmt: p => `${statNum(p.extra?.lasthits) ?? '-'} / ${statNum(p.extra?.denies) ?? '-'}`,
    align: 'center',
  },
  { key: 'damage', label: 'damage', fmt: p => kfmt(p.extra?.damagedone), align: 'center' },
];

// The real draft order (vetophase): 24 numbered ban/pick steps interleaved.
// Present only on BigMatch-imported events.
type VetoStep = { character: string; team: number; type: string; vetoNumber: number };
type DraftTile = { name: string; order?: number };

function parseVeto(game: PandaGame): VetoStep[] | null {
  const vp = game.extradata?.vetophase;
  if (!vp || typeof vp !== 'object') return null;
  const steps = Object.values(vp as Record<string, VetoStep>)
    .filter(s => s?.character && (s.type === 'ban' || s.type === 'pick') && typeof s.vetoNumber === 'number')
    .sort((a, b) => a.vetoNumber - b.vetoNumber);
  return steps.length ? steps : null;
}

const vetoTiles = (veto: VetoStep[], teamIndex: 1 | 2, type: 'pick' | 'ban'): DraftTile[] =>
  veto.filter(s => s.team === teamIndex && s.type === type).map(s => ({ name: s.character, order: s.vetoNumber }));

// Dota hero art is landscape 256×144 → 16:9 tiles rather than square.
function HeroTile({ name, maps, ban, order }: { name: string; maps: DotaAssetMaps | null; ban?: boolean; order?: number }) {
  const img = imageUrl(dotaHeroImage(name, maps)) ?? undefined;
  return (
    <View style={[styles.heroTile, ban && styles.heroTileBan]}>
      <View style={[styles.heroTileBox, ban ? styles.heroTileBoxBan : styles.heroTileBoxPick]}>
        <LinearGradient
          colors={['rgba(24,40,89,0.5)', 'rgba(6,11,19,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {img ? (
          <Image source={{ uri: img }} style={[StyleSheet.absoluteFill, ban && styles.dimmed]} contentFit="cover" />
        ) : (
          <Text style={styles.heroFallback} numberOfLines={2}>{name}</Text>
        )}
        {ban && <View style={styles.banStrike} />}
        {order != null && !ban && (
          <View style={styles.orderBadge}>
            <Text style={styles.orderText}>{order}</Text>
          </View>
        )}
      </View>
      {!ban && <Text style={styles.heroName} numberOfLines={1}>{name}</Text>}
    </View>
  );
}

function DraftRow({ tiles, maps }: { tiles: Record<1 | 2, { picks: DraftTile[]; bans: DraftTile[] }>; maps: DotaAssetMaps | null }) {
  const has = tiles[1].picks.length > 0 || tiles[2].picks.length > 0 || tiles[1].bans.length > 0 || tiles[2].bans.length > 0;
  if (!has) return null;
  return (
    <View style={styles.draftWrap}>
      <View style={styles.draftRow}>
        <View style={styles.draftSide}>
          {tiles[1].picks.map((p, i) => <HeroTile key={`p1-${p.name}-${i}`} name={p.name} order={p.order} maps={maps} />)}
        </View>
        <View style={[styles.draftSide, styles.draftSideRight]}>
          {tiles[2].picks.map((p, i) => <HeroTile key={`p2-${p.name}-${i}`} name={p.name} order={p.order} maps={maps} />)}
        </View>
        <View style={styles.vsOverlay} pointerEvents="none">
          <Text style={styles.vsText}>VS</Text>
        </View>
      </View>
      {(tiles[1].bans.length > 0 || tiles[2].bans.length > 0) && (
        <View style={styles.bansRow}>
          <View style={styles.bansSide}>
            {tiles[1].bans.length > 0 && <Text style={styles.bansLabel}>BANS</Text>}
            {tiles[1].bans.map((b, i) => <HeroTile key={`b1-${b.name}-${i}`} name={b.name} maps={maps} ban />)}
          </View>
          <View style={[styles.bansSide, styles.bansSideRight]}>
            {tiles[2].bans.map((b, i) => <HeroTile key={`b2-${b.name}-${i}`} name={b.name} maps={maps} ban />)}
            {tiles[2].bans.length > 0 && <Text style={styles.bansLabel}>BANS</Text>}
          </View>
        </View>
      )}
    </View>
  );
}

const OBJECTIVE_KEYS = ['towers', 'barracks', 'roshans'] as const;
const OBJECTIVE_LABELS: Record<(typeof OBJECTIVE_KEYS)[number], string> = {
  towers: 'TOURS',
  barracks: 'CASERNES',
  roshans: 'ROSHAN',
};

function ObjectivesStrip({ game }: { game: PandaGame }) {
  const ed = game.extradata;
  const o1 = ed?.team1objectives as Record<string, unknown> | undefined;
  const o2 = ed?.team2objectives as Record<string, unknown> | undefined;
  if (!o1 && !o2) return null;
  const c1 = sideColor(ed?.team1side) ?? COLORS.textSecondary;
  const c2 = sideColor(ed?.team2side) ?? COLORS.textSecondary;

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

// Items/aghanim/neutral strip under each team's scoreboard: one line per player
// (net-worth order) = hero icon + level badge + 6 item icons + round neutral +
// Aghanim scepter/shard + dimmed backpack. Any missing asset is skipped.
function ItemsStrip({ rows, maps }: { rows: PandaParticipant[]; maps: DotaAssetMaps | null }) {
  const withItems = rows.some(p => {
    const items = p.extra?.items as Record<string, { name?: string }> | undefined;
    return items && Object.keys(items).length > 0;
  });
  if (!withItems) return null;

  return (
    <View style={styles.builds}>
      {rows.map((p, i) => {
        const heroImg = imageUrl(dotaHeroImage(p.character, maps)) ?? undefined;
        const level = statNum(p.extra?.level);
        const items = p.extra?.items as Record<string, { name?: string }> | undefined;
        const neutral = p.extra?.neutralitem as { name?: string } | undefined;
        const backpack = p.extra?.backpackitems as Record<string, { name?: string }> | undefined;
        const backpackNames = backpack
          ? (Object.keys(backpack).sort().map(k => backpack[k]?.name).filter(Boolean) as string[])
          : [];
        const hasScepter = p.extra?.scepter === true;
        const hasShard = p.extra?.shard === true;
        const itemNames = items ? Object.keys(items).sort().map(k => items[k]?.name).filter(Boolean) as string[] : [];
        if (itemNames.length === 0 && !heroImg) return null;
        const neutralIcon = neutral?.name ? imageUrl(dotaItemIcon(neutral.name, maps)) ?? undefined : undefined;
        const scepterIcon = hasScepter ? imageUrl(dotaItemIcon("Aghanim's Scepter", maps)) ?? undefined : undefined;
        const shardIcon = hasShard ? imageUrl(dotaItemIcon("Aghanim's Shard", maps)) ?? undefined : undefined;
        return (
          <View key={i} style={styles.buildRow}>
            <View style={styles.buildHero}>
              {heroImg ? <Image source={{ uri: heroImg }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              {level !== null && (
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>{level}</Text>
                </View>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.buildItems}>
              {itemNames.map((it, j) => {
                const ii = imageUrl(dotaItemIcon(it, maps)) ?? undefined;
                return ii ? <Image key={`${it}-${j}`} source={{ uri: ii }} style={styles.itemIcon} contentFit="cover" /> : null;
              })}
              {neutralIcon && <Image source={{ uri: neutralIcon }} style={styles.neutralIcon} contentFit="cover" />}
              {(scepterIcon || shardIcon) && (
                <View style={styles.aghanimGroup}>
                  {scepterIcon && <Image source={{ uri: scepterIcon }} style={styles.aghanimIcon} contentFit="cover" />}
                  {shardIcon && <Image source={{ uri: shardIcon }} style={styles.aghanimIcon} contentFit="cover" />}
                </View>
              )}
              {backpackNames.length > 0 && (
                <View style={[styles.buildItems, styles.backpackGroup]}>
                  {backpackNames.map((it, j) => {
                    const bi = imageUrl(dotaItemIcon(it, maps)) ?? undefined;
                    return bi ? <Image key={`bp-${it}-${j}`} source={{ uri: bi }} style={styles.itemIcon} contentFit="cover" /> : null;
                  })}
                </View>
              )}
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

function HeroDuel({ game, maps, home, away, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming }: {
  game: PandaGame;
  maps: DotaAssetMaps | null;
  home?: PandaTeam | null;
  away?: PandaTeam | null;
  isHomeWin: boolean;
  isAwayWin: boolean;
  isLive: boolean;
  isFinished: boolean;
  isUpcoming: boolean;
}) {
  const leftArt = imageUrl(dotaHeroImage(keyHero(game, 1), maps)) ?? undefined;
  const rightArt = imageUrl(dotaHeroImage(keyHero(game, 2), maps)) ?? undefined;
  const homeKills = teamKills(game, 1);
  const awayKills = teamKills(game, 2);
  const hasKills = homeKills !== null && awayKills !== null;
  const ed = game.extradata;

  const halfDim = (win: boolean) => (isUpcoming ? styles.dimmed : isFinished && !win ? styles.halfLose : null);

  return (
    <View style={[styles.hero, isUpcoming ? styles.heroUpcoming : styles.heroPlayed]}>
      {leftArt || rightArt ? (
        <>
          <View style={styles.heroHalfLeft}>
            {leftArt && (
              <Image source={{ uri: leftArt }} style={[StyleSheet.absoluteFill, halfDim(isHomeWin)]} contentFit="cover" />
            )}
          </View>
          <View style={styles.heroHalfRight}>
            {rightArt && (
              <Image source={{ uri: rightArt }} style={[StyleSheet.absoluteFill, halfDim(isAwayWin)]} contentFit="cover" />
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

function ExternalLinks({ pubId }: { pubId: string }) {
  const open = (url: string) => Linking.openURL(url).catch(() => {});
  return (
    <View style={styles.extLinks}>
      <Pressable style={styles.extLink} onPress={() => open(`https://www.dotabuff.com/matches/${pubId}`)}>
        <Text style={styles.extLinkText}>DOTABUFF</Text>
        <MaterialCommunityIcons name="open-in-new" size={11} color={COLORS.textMuted} />
      </Pressable>
      <Pressable style={styles.extLink} onPress={() => open(`https://www.opendota.com/matches/${pubId}`)}>
        <Text style={styles.extLinkText}>OPENDOTA</Text>
        <MaterialCommunityIcons name="open-in-new" size={11} color={COLORS.textMuted} />
      </Pressable>
    </View>
  );
}

// Resolve home/away teams + per-game win/live/finished flags. Shared by the
// banner (hero only) and the block (hero + details) so they stay in lockstep.
function useGameState(match: PandaMatch, game: PandaGame) {
  const home = match.opponents?.[0]?.opponent || match.opponents?.[0]?.team;
  const away = match.opponents?.[1]?.opponent || match.opponents?.[1]?.team;
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
  return { home, away, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming };
}

// Compact tappable banner for ONE game: rounded card wrapping the hero-duel.
// When onPress is set AND the game has drill-down data, a chevron + faint
// "STATS" affordance appears bottom-right. Draft/scoreboards live on the game
// page, not here.
export function DotaGameBanner({ match, game, onPress }: {
  match: PandaMatch;
  game: PandaGame;
  onPress?: () => void;
}) {
  const maps = useDotaAssets();
  const { home, away, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming } = useGameState(match, game);
  const drillable = !!onPress && hasGameDetails(game);

  const hero = (
    <HeroDuel
      game={game}
      maps={maps}
      home={home}
      away={away}
      isHomeWin={isHomeWin}
      isAwayWin={isAwayWin}
      isLive={isLive}
      isFinished={isFinished}
      isUpcoming={isUpcoming}
    />
  );

  const affordance = drillable ? (
    <View style={styles.statsAffordance} pointerEvents="none">
      <Text style={styles.statsAffordanceText}>STATS</Text>
      <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.textSecondary} />
    </View>
  ) : null;

  if (drillable) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.block, isLive && styles.blockLive, pressed && styles.blockPressed]}
      >
        {hero}
        {affordance}
      </Pressable>
    );
  }
  return <View style={[styles.block, isLive && styles.blockLive]}>{hero}</View>;
}

// Full per-game block: hero-duel + details (vetophase draft + objectives + two
// Dotabuff scoreboards + items + Dotabuff/OpenDota links). Rendered inline for
// BO1 and on the dedicated game page for multi-game matches.
export function DotaGameBlock({ match, game }: { match: PandaMatch; game: PandaGame }) {
  const maps = useDotaAssets();
  const { home, away, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming } = useGameState(match, game);
  const heroIcon = (name?: string | null) => dotaHeroImage(name, maps);

  const draft = parseDraft(game);
  const veto = parseVeto(game);
  // vetophase gives the true draft order; else fall back to flat picks/bans.
  const tiles: Record<1 | 2, { picks: DraftTile[]; bans: DraftTile[] }> = veto
    ? {
        1: { picks: vetoTiles(veto, 1, 'pick'), bans: vetoTiles(veto, 1, 'ban') },
        2: { picks: vetoTiles(veto, 2, 'pick'), bans: vetoTiles(veto, 2, 'ban') },
      }
    : {
        1: { picks: (draft?.team1.picks ?? []).map(name => ({ name })), bans: (draft?.team1.bans ?? []).map(name => ({ name })) },
        2: { picks: (draft?.team2.picks ?? []).map(name => ({ name })), bans: (draft?.team2.bans ?? []).map(name => ({ name })) },
      };
  const hasDraft = tiles[1].picks.length > 0 || tiles[2].picks.length > 0 || tiles[1].bans.length > 0 || tiles[2].bans.length > 0;

  const home1 = teamParts(game, 1);
  const away1 = teamParts(game, 2);
  const hasStats = home1.length > 0 || away1.length > 0;

  const ed = game.extradata;
  const pubId = ed?.publisherid != null && String(ed.publisherid).trim() !== '' ? String(ed.publisherid) : null;
  const hasDetails = hasDraft || hasStats || !!pubId;

  return (
    <View style={[styles.block, isLive && styles.blockLive]}>
      <HeroDuel
        game={game}
        maps={maps}
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
          {hasDraft && <DraftRow tiles={tiles} maps={maps} />}
          <ObjectivesStrip game={game} />
          {hasStats && (
            <View style={styles.scoreboards}>
              <View style={styles.teamCol}>
                <Scoreboard
                  participants={home1}
                  columns={DOTA_COLUMNS}
                  characterIcon={heroIcon}
                  teamLabel={home?.acronym || home?.name || '-'}
                  teamLogo={home?.image_url}
                />
                <ItemsStrip rows={home1} maps={maps} />
              </View>
              <View style={styles.teamCol}>
                <Scoreboard
                  participants={away1}
                  columns={DOTA_COLUMNS}
                  characterIcon={heroIcon}
                  teamLabel={away?.acronym || away?.name || '-'}
                  teamLogo={away?.image_url}
                />
                <ItemsStrip rows={away1} maps={maps} />
              </View>
            </View>
          )}
          {pubId && <ExternalLinks pubId={pubId} />}
        </View>
      )}
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
  blockPressed: {
    opacity: 0.85,
  },
  statsAffordance: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    opacity: 0.7,
  },
  statsAffordanceText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dimmed: {
    opacity: 0.5,
  },
  halfLose: {
    opacity: 0.55,
  },

  // Hero duel
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
  heroTile: {
    alignItems: 'center',
    gap: 2,
  },
  heroTileBan: {
    opacity: 0.6,
  },
  heroTileBox: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  heroTileBoxPick: {
    width: 76,
    height: 43,
    borderRadius: borderRadius.sm,
    borderColor: 'rgba(24,40,89,0.6)',
  },
  heroTileBoxBan: {
    width: 48,
    height: 27,
    borderRadius: borderRadius.xs,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  banStrike: {
    position: 'absolute',
    width: '160%',
    height: 2,
    backgroundColor: 'rgba(242,46,98,0.9)',
    transform: [{ rotate: '30deg' }],
  },
  orderBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: 3,
    backgroundColor: 'rgba(6,11,19,0.8)',
    borderBottomRightRadius: borderRadius.xs,
  },
  orderText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 8,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  heroFallback: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  heroName: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 76,
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

  // Scoreboards + items strip
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
  buildHero: {
    width: 34,
    height: 22,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(24,40,89,0.5)',
  },
  levelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    paddingHorizontal: 2,
    backgroundColor: 'rgba(6,11,19,0.85)',
    borderTopLeftRadius: borderRadius.xs,
  },
  levelText: {
    color: COLORS.text,
    fontSize: 8,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  buildItems: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  itemIcon: {
    width: 30,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  neutralIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: `${AMBER}66`,
    marginLeft: 4,
  },
  aghanimGroup: {
    flexDirection: 'row',
    gap: 3,
    marginLeft: 4,
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
  },
  aghanimIcon: {
    width: 24,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.4)',
  },
  backpackGroup: {
    marginLeft: 4,
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    opacity: 0.45,
  },

  // External links
  extLinks: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  extLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  extLinkText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
