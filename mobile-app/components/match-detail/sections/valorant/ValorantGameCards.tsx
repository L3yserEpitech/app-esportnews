// Valorant rich per-game match-detail cards (RN port of the web
// ValorantGameCards). This is the REFERENCE implementation for game-specific
// cards: a vertical stack of per-map blocks, each = map-splash hero (scores +
// map name) + agent draft row + two vlr.gg-style ACS scoreboards.
//
// The map hero uses layered absolute-fill gradients over the splash: a lateral
// dark→center→dark fade + a light vertical veil, with the score/label content
// on top. Winner side gets a 3px accent bar and an accent-glow score; the loser
// is dimmed. A not-yet-played map is a reduced, dimmed card ("À venir").
import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { imageUrl } from '@/utils/imageUrl';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { PandaMatch, PandaGame, PandaParticipant, PandaTeam } from '@/types';
import { parseGameWinner, TeamLogo } from '../shared';
import { parseDraft } from '../draft';
import { Scoreboard } from '../Scoreboard';
import type { StatColumn } from '../statColumns';
import { valorantMapSplash, valorantAgentIcon } from './valorantAssets';

// True when a game carries drill-down worthy data (agent draft or per-player
// scoreboard). Callers gate banner tappability / game-page existence on this.
export function hasGameDetails(game: PandaGame): boolean {
  const draft = parseDraft(game);
  const hasPicks = !!draft && (draft.team1.picks.length > 0 || draft.team2.picks.length > 0);
  return hasPicks || (game.participants?.length ?? 0) > 0;
}

const BG = '#060B13';

const statNum = (v: unknown): number | null => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(+v)) return +v;
  return null;
};
const round = (v: unknown): string => {
  const n = statNum(v);
  return n === null ? '-' : String(Math.round(n));
};
const pct = (v: unknown): string => {
  const n = statNum(v);
  return n === null ? '-' : `${Math.round(n)}%`;
};

// vlr.gg columns: ACS · K · D · A · +/- (K−D, sign-colored) · KAST · ADR.
// The reusable <Scoreboard> renders the leading PLAYER + agent-icon cell.
const VALORANT_COLUMNS: StatColumn[] = [
  { key: 'acs', label: 'acs', fmt: p => round(p.extra?.acs), align: 'center' },
  { key: 'k', label: 'K', fmt: p => (p.kills != null ? String(p.kills) : '-'), align: 'center' },
  { key: 'd', label: 'D', fmt: p => (p.deaths != null ? String(p.deaths) : '-'), align: 'center' },
  { key: 'a', label: 'A', fmt: p => (p.assists != null ? String(p.assists) : '-'), align: 'center' },
  {
    key: 'diff',
    label: '+/-',
    fmt: p => {
      const d = p.kills != null && p.deaths != null ? p.kills - p.deaths : null;
      return d === null ? '-' : d > 0 ? `+${d}` : String(d);
    },
    align: 'center',
    signed: true,
  },
  { key: 'kast', label: 'kast', fmt: p => pct(p.extra?.kast), align: 'center' },
  { key: 'adr', label: 'adr', fmt: p => round(p.extra?.adr), align: 'center' },
];

const acsSort = (p: PandaParticipant): number => Number(p.extra?.acs) || 0;

// A single agent portrait tile (draft). Navy gradient bg, icon cover, tiny
// uppercase name below. Missing icon → tile shows the name text, never crashes.
function AgentTile({ name }: { name: string }) {
  const icon = imageUrl(valorantAgentIcon(name)) ?? undefined;
  return (
    <View style={styles.agentTile}>
      <View style={styles.agentPortrait}>
        <LinearGradient
          colors={['rgba(24,40,89,0.5)', 'rgba(6,11,19,0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {icon ? (
          <Image source={{ uri: icon }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.agentFallback} numberOfLines={2}>
            {name}
          </Text>
        )}
      </View>
      <Text style={styles.agentName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

// Home picks left, away picks right, discreet "VS" centered over the gap.
function DraftRow({ picks1, picks2 }: { picks1: string[]; picks2: string[] }) {
  if (picks1.length === 0 && picks2.length === 0) return null;
  return (
    <View style={styles.draftRow}>
      <View style={styles.draftSide}>
        {picks1.map((p, i) => (
          <AgentTile key={`${p}-${i}`} name={p} />
        ))}
      </View>
      <View style={[styles.draftSide, styles.draftSideRight]}>
        {picks2.map((p, i) => (
          <AgentTile key={`${p}-${i}`} name={p} />
        ))}
      </View>
      <View style={styles.vsOverlay} pointerEvents="none">
        <Text style={styles.vsText}>VS</Text>
      </View>
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
  const splash = imageUrl(valorantMapSplash(game.map)) ?? undefined;
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

      {/* Lateral fade: dark edges → lighter center. */}
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
      {/* Light vertical veil. */}
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

// Compact tappable banner for ONE game: rounded card wrapping the map hero.
// When onPress is provided AND the game has drill-down data, a chevron + faint
// "STATS" affordance appears bottom-right. Draft/scoreboards live on the game
// page, not here.
export function ValorantGameBanner({ match, game, onPress }: {
  match: PandaMatch;
  game: PandaGame;
  onPress?: () => void;
}) {
  const { home, away, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming } = useGameState(match, game);
  const drillable = !!onPress && hasGameDetails(game);

  const hero = (
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

// Full per-game block: map hero + details (draft + two scoreboards). Rendered
// inline for BO1 and on the dedicated game page for multi-game matches.
export function ValorantGameBlock({ match, game }: { match: PandaMatch; game: PandaGame }) {
  const { home, away, isHomeWin, isAwayWin, isLive, isFinished, isUpcoming } = useGameState(match, game);

  const draft = parseDraft(game);
  const parts = game.participants ?? [];
  const home1 = parts.filter(p => p.team === 1);
  const away1 = parts.filter(p => p.team === 2);
  const hasStats = home1.length > 0 || away1.length > 0;

  return (
    <View style={[styles.block, isLive && styles.blockLive]}>
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

      {(draft || hasStats) && (
        <View style={styles.details}>
          {draft && (draft.team1.picks.length > 0 || draft.team2.picks.length > 0) && (
            <DraftRow picks1={draft.team1.picks} picks2={draft.team2.picks} />
          )}
          {hasStats && (
            <View style={styles.scoreboards}>
              <Scoreboard
                participants={home1}
                columns={VALORANT_COLUMNS}
                characterIcon={valorantAgentIcon}
                teamLabel={home?.acronym || home?.name || '-'}
                teamLogo={home?.image_url}
                sortBy={acsSort}
              />
              <Scoreboard
                participants={away1}
                columns={VALORANT_COLUMNS}
                characterIcon={valorantAgentIcon}
                teamLabel={away?.acronym || away?.name || '-'}
                teamLogo={away?.image_url}
                sortBy={acsSort}
              />
            </View>
          )}
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

  // Draft
  details: {
    backgroundColor: 'rgba(9,22,38,0.4)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    padding: spacing.md,
    gap: spacing.lg,
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
  agentTile: {
    alignItems: 'center',
    gap: 2,
  },
  agentPortrait: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(31,41,55,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentFallback: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  agentName: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    maxWidth: 44,
  },

  // Scoreboards
  scoreboards: {
    gap: spacing.md,
  },
});
