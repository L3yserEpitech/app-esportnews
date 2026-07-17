import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { SectionHeader, TeamLogo, parseGameWinner, formatDuration, type MatchSectionProps } from './shared';
import { ValorantGameBanner, ValorantGameBlock } from './valorant/ValorantGameCards';
import LolGameCards from './leagueoflegends/LolGameCards';
import DotaGameCards from './dota2/DotaGameCards';
import CsGameCards from './counterstrike/CsGameCards';
import R6GameCards from './rainbowsix/R6GameCards';
import OwGameCards from './overwatch/OwGameCards';
import CodGameCards from './callofduty/CodGameCards';
import RlGameCards from './rocketleague/RlGameCards';
import FcGameCards from './easportsfc/FcGameCards';

// Wikis rich enough to warrant a dedicated per-game page (banner drill-down).
const RICH_WIKIS = new Set([
  'valorant', 'leagueoflegends', 'dota2', 'counterstrike', 'rainbowsix', 'overwatch',
]);

// Per-game dispatcher. Rich multi-game matches render a compact banner per game
// (tap → dedicated game page). BO1 rich matches render the full block inline.
// Non-rich (INLINE) wikis keep their existing inline cards.
export default function GameResults(props: MatchSectionProps) {
  const { match } = props;
  const router = useRouter();
  if (!match.games || match.games.length === 0) return null;

  const games = match.games;
  const played = games.filter(g => g.finished).length;
  const isRich = RICH_WIKIS.has(match.wiki ?? '');
  const isMulti = games.length > 1;

  return (
    <View style={styles.section}>
      <SectionHeader
        icon="gamepad-variant-outline"
        title="Détails des games"
        extra={match.number_of_games ? (
          <Text style={styles.countText}>{played}/{match.number_of_games}</Text>
        ) : undefined}
      />
      {(() => {
        // RICH + multi-game → banner per game (drill-down to the game page).
        if (isRich && isMulti) {
          switch (match.wiki) {
            case 'valorant':
              return (
                <View style={styles.banners}>
                  {games.map((game, idx) => (
                    <ValorantGameBanner
                      key={game.id ?? idx}
                      match={match}
                      game={game}
                      onPress={() =>
                        router.push({
                          pathname: '/match/[id]/game/[n]',
                          params: {
                            id: String(match.id),
                            n: String(game.position ?? idx + 1),
                            wiki: match.wiki ?? '',
                          },
                        })
                      }
                    />
                  ))}
                </View>
              );
            // TODO(next): banner+block for leagueoflegends/dota2/counterstrike/rainbowsix/overwatch.
            // Until then, these rich wikis keep their inline cards (no drill-down).
            case 'leagueoflegends':
              return <LolGameCards {...props} />;
            case 'dota2':
              return <DotaGameCards {...props} />;
            case 'counterstrike':
              return <CsGameCards {...props} />;
            case 'rainbowsix':
              return <R6GameCards {...props} />;
            case 'overwatch':
              return <OwGameCards {...props} />;
          }
        }

        // RICH + BO1 → single full block inline (no banner/drill for one game).
        if (isRich && !isMulti) {
          switch (match.wiki) {
            case 'valorant':
              return <ValorantGameBlock match={match} game={games[0]} />;
            case 'leagueoflegends':
              return <LolGameCards {...props} />;
            case 'dota2':
              return <DotaGameCards {...props} />;
            case 'counterstrike':
              return <CsGameCards {...props} />;
            case 'rainbowsix':
              return <R6GameCards {...props} />;
            case 'overwatch':
              return <OwGameCards {...props} />;
          }
        }

        // INLINE tier (callofduty / rocketleague / easportsfc / smash / default).
        switch (match.wiki) {
          case 'callofduty':
            return <CodGameCards {...props} />;
          case 'rocketleague':
            return <RlGameCards {...props} />;
          case 'easportsfc':
            return <FcGameCards {...props} />;
          default:
            return <GenericGameCards {...props} />;
        }
      })()}
    </View>
  );
}

function GenericGameCards({ match }: MatchSectionProps) {
  const homeTeam = match.opponents?.[0]?.opponent || match.opponents?.[0]?.team;
  const awayTeam = match.opponents?.[1]?.opponent || match.opponents?.[1]?.team;

  return (
    <View style={styles.list}>
      {match.games!.map((game, idx) => {
        const winnerData = parseGameWinner(game.winner);
        const winnerTeam = winnerData?.id
          ? (match.opponents?.find(o => (o.opponent || o.team)?.id === winnerData.id)?.opponent
            || match.opponents?.find(o => (o.opponent || o.team)?.id === winnerData.id)?.team)
          : null;
        const isHomeWin = !!winnerTeam && winnerTeam.id === homeTeam?.id;
        const isAwayWin = !!winnerTeam && winnerTeam.id === awayTeam?.id;
        const isGameLive = game.status === 'running';
        const homeMapScore = game.scores?.[0];
        const awayMapScore = game.scores?.[1];
        const hasScores = homeMapScore !== undefined && awayMapScore !== undefined;

        const statusText = isGameLive
          ? 'EN COURS'
          : game.length
            ? formatDuration(game.length)
            : game.finished
              ? 'Terminé'
              : 'À venir';

        return (
          <Surface key={game.id ?? idx} style={[styles.card, isGameLive && styles.cardLive]} elevation={0}>
            <View style={styles.cardTop}>
              <View style={[styles.gameBadge, isGameLive && styles.gameBadgeLive]}>
                <Text style={[styles.gameBadgeText, isGameLive && styles.gameBadgeTextLive]}>
                  {game.position ?? idx + 1}
                </Text>
              </View>

              <View style={styles.teamSide}>
                <TeamLogo team={homeTeam} size="sm" />
                <Text style={[styles.teamLabel, isHomeWin && styles.teamLabelWin]} numberOfLines={1}>
                  {homeTeam?.acronym || homeTeam?.name || '-'}
                </Text>
                {hasScores ? (
                  <Text style={[styles.mapScore, isHomeWin && styles.mapScoreWin]}>{homeMapScore}</Text>
                ) : null}
              </View>

              <View style={styles.mapCenter}>
                {game.map ? (
                  <Text style={styles.mapName} numberOfLines={1}>{game.map}</Text>
                ) : isGameLive ? (
                  <View style={styles.liveDot} />
                ) : winnerTeam ? (
                  <MaterialCommunityIcons name="trophy" size={14} color={COLORS.accent} />
                ) : (
                  <Text style={styles.mapDash}>—</Text>
                )}
              </View>

              <View style={[styles.teamSide, styles.teamSideRight]}>
                {hasScores ? (
                  <Text style={[styles.mapScore, isAwayWin && styles.mapScoreWin]}>{awayMapScore}</Text>
                ) : null}
                <Text style={[styles.teamLabel, isAwayWin && styles.teamLabelWin]} numberOfLines={1}>
                  {awayTeam?.acronym || awayTeam?.name || '-'}
                </Text>
                <TeamLogo team={awayTeam} size="sm" />
              </View>
            </View>

            <View style={styles.cardBottom}>
              <Text style={[styles.statusText, isGameLive && styles.statusTextLive]}>{statusText}</Text>
            </View>
          </Surface>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Horizontal inset comes from the match shell body (single source).
  section: {},
  countText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  list: {
    gap: spacing.sm,
  },
  banners: {
    gap: spacing.md,
  },
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardLive: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.live,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gameBadge: {
    width: 26,
    height: 26,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gameBadgeLive: {
    backgroundColor: `${COLORS.live}1F`,
    borderColor: `${COLORS.live}40`,
  },
  gameBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  gameBadgeTextLive: {
    color: COLORS.live,
  },
  teamSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  teamSideRight: {
    justifyContent: 'flex-end',
  },
  teamLabel: {
    flexShrink: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  teamLabelWin: {
    color: COLORS.accent,
  },
  mapScore: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  mapScoreWin: {
    color: COLORS.accent,
  },
  mapCenter: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapName: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  mapDash: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.live,
  },
  cardBottom: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusTextLive: {
    color: COLORS.live,
    fontWeight: '800',
  },
});
