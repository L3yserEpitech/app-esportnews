import React from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius, shadows } from '@/constants/theme';
import { PandaMatch } from '@/types';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const { width } = Dimensions.get('window');

interface MatchCardProps {
  match: PandaMatch;
  onPress: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress }) => {
  const team1 = match.opponents?.[0]?.opponent || match.opponents?.[0]?.team;
  const team2 = match.opponents?.[1]?.opponent || match.opponents?.[1]?.team;
  
  // More reliable score mapping by team ID
  const score1 = match.results?.find(r => r.team_id === team1?.id)?.score ?? match.results?.[0]?.score ?? 0;
  const score2 = match.results?.find(r => r.team_id === team2?.id)?.score ?? match.results?.[1]?.score ?? 0;

  const matchDate = match.begin_at 
    ? format(parseISO(match.begin_at), "dd MMM · HH:mm", { locale: fr })
    : 'À définir';

  const isFinished = match.status?.toLowerCase() === 'finished';
  const isRunning = match.status?.toLowerCase() === 'running';

  const statusInfo = (() => {
    if (isRunning) return { label: 'LIVE', color: COLORS.live, glow: COLORS.live + '20' };
    if (isFinished) return { label: 'TERMINÉ', color: COLORS.textMuted, glow: 'rgba(255,255,255,0.05)' };
    return { label: 'À VENIR', color: COLORS.primary, glow: COLORS.primary + '20' };
  })();

  const formatText = match.number_of_games ? `BO${match.number_of_games}` : '';

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      {({ pressed }) => (
        <Surface style={[styles.card, pressed && styles.pressed, { backgroundColor: statusInfo.glow }]} elevation={1}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.05)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          
          {/* Header Row */}
          <View style={styles.header}>
            <View style={styles.gameInfo}>
              <MaterialCommunityIcons name="controller-classic-outline" size={14} color={COLORS.primary} />
              <Text variant="labelSmall" style={styles.gameText}>
                {match.videogame?.name || 'Match'} {formatText && `· ${formatText}`}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
              <Text variant="labelSmall" style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          {/* Main Battle Area */}
          <View style={styles.battleArea}>
            {/* Team 1 */}
            <View style={styles.teamContainer}>
              <View style={[styles.logoWrapper, isFinished && score1 > score2 && styles.winnerWrapper]}>
                {team1?.image_url ? (
                  <Image source={{ uri: team1.image_url }} style={styles.teamLogo} contentFit="contain" />
                ) : (
                  <MaterialCommunityIcons name="shield-outline" size={28} color={COLORS.textMuted} />
                )}
              </View>
              <Text variant="labelMedium" style={[styles.teamName, isFinished && score1 > score2 && styles.winnerName]} numberOfLines={1}>
                {team1?.acronym || team1?.name || 'TBD'}
              </Text>
            </View>

            {/* Score / VS Center */}
            <View style={styles.centerSection}>
              {isFinished || isRunning ? (
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreText, isFinished && score1 > score2 && styles.winnerScore]}>{score1}</Text>
                  <Text style={styles.scoreDivider}>:</Text>
                  <Text style={[styles.scoreText, isFinished && score2 > score1 && styles.winnerScore]}>{score2}</Text>
                </View>
              ) : (
                <View style={styles.vsContainer}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
              )}
              <Text style={styles.timeText}>{matchDate}</Text>
            </View>

            {/* Team 2 */}
            <View style={styles.teamContainer}>
              <View style={[styles.logoWrapper, isFinished && score2 > score1 && styles.winnerWrapper]}>
                {team2?.image_url ? (
                  <Image source={{ uri: team2.image_url }} style={styles.teamLogo} contentFit="contain" />
                ) : (
                  <MaterialCommunityIcons name="shield-outline" size={28} color={COLORS.textMuted} />
                )}
              </View>
              <Text variant="labelMedium" style={[styles.teamName, isFinished && score2 > score1 && styles.winnerName]} numberOfLines={1}>
                {team2?.acronym || team2?.name || 'TBD'}
              </Text>
            </View>
          </View>

          {/* Footer - League Info */}
          {match.league && (
            <View style={styles.footer}>
              <View style={styles.leagueInfo}>
                {match.league.image_url ? (
                  <Image source={{ uri: match.league.image_url }} style={styles.leagueLogo} contentFit="contain" />
                ) : (
                  <MaterialCommunityIcons name="trophy-outline" size={12} color={COLORS.textMuted} />
                )}
                <Text variant="labelSmall" style={styles.leagueName} numberOfLines={1}>
                  {match.league.name}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.textMuted} />
            </View>
          )}
        </Surface>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    marginBottom: spacing.md,
    width: '100%',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...shadows.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gameText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  battleArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  logoWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  winnerWrapper: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
    borderWidth: 2,
  },
  teamLogo: {
    width: 44,
    height: 44,
  },
  teamName: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
    width: '100%',
  },
  winnerName: {
    color: COLORS.primary,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  scoreText: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreDivider: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: '900',
    opacity: 0.5,
  },
  winnerScore: {
    color: COLORS.primary,
    textShadowColor: COLORS.primary + '40',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  vsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  vsText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  leagueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  leagueLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
  leagueName: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
});
