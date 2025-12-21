import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Card } from 'react-native-paper';
import { Badge } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { PandaMatch } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MatchCardProps {
  match: PandaMatch;
  onPress: () => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, onPress }) => {
  // Extract teams from opponents array
  const team1 = match.opponents?.[0];
  const team2 = match.opponents?.[1];

  // Extract scores from results array
  const result1 = match.results?.[0];
  const result2 = match.results?.[1];

  // Format time
  const matchTime = match.begin_at
    ? format(new Date(match.begin_at), 'HH:mm', { locale: fr })
    : 'TBD';

  // Determine status
  const getStatusBadge = () => {
    if (match.status === 'running') {
      return <Badge variant="live">EN DIRECT</Badge>;
    }
    if (match.status === 'not_started') {
      return <Badge variant="upcoming">À VENIR</Badge>;
    }
    if (match.status === 'finished') {
      return <Badge variant="finished">TERMINÉ</Badge>;
    }
    return null;
  };

  // Determine winner styling
  const isTeam1Winner = match.winner_id === team1?.opponent?.id;
  const isTeam2Winner = match.winner_id === team2?.opponent?.id;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card
          style={[styles.card, pressed && styles.cardPressed]}
          mode="elevated"
        >
          <View style={styles.cardContent}>
            {/* Header with time and status */}
            <View style={styles.header}>
              <Text style={styles.time}>{matchTime}</Text>
              {getStatusBadge()}
            </View>

            {/* Match name */}
            {match.name && (
              <Text style={styles.matchName} numberOfLines={1}>
                {match.name}
              </Text>
            )}

            {/* Teams section */}
            <View style={styles.teamsContainer}>
              {/* Team 1 */}
              <View style={styles.teamRow}>
                <View style={styles.teamInfo}>
                  {team1?.opponent?.image_url && (
                    <Image
                      source={{ uri: team1.opponent.image_url }}
                      style={styles.teamLogo}
                      resizeMode="contain"
                    />
                  )}
                  <Text
                    style={[
                      styles.teamName,
                      isTeam1Winner && styles.teamNameWinner,
                    ]}
                    numberOfLines={1}
                  >
                    {team1?.opponent?.name || 'TBD'}
                  </Text>
                </View>
                {result1 !== undefined && (
                  <Text
                    style={[
                      styles.score,
                      isTeam1Winner && styles.scoreWinner,
                    ]}
                  >
                    {result1.score}
                  </Text>
                )}
              </View>

              {/* VS Divider */}
              <View style={styles.divider}>
                <Text style={styles.vsText}>VS</Text>
              </View>

              {/* Team 2 */}
              <View style={styles.teamRow}>
                <View style={styles.teamInfo}>
                  {team2?.opponent?.image_url && (
                    <Image
                      source={{ uri: team2.opponent.image_url }}
                      style={styles.teamLogo}
                      resizeMode="contain"
                    />
                  )}
                  <Text
                    style={[
                      styles.teamName,
                      isTeam2Winner && styles.teamNameWinner,
                    ]}
                    numberOfLines={1}
                  >
                    {team2?.opponent?.name || 'TBD'}
                  </Text>
                </View>
                {result2 !== undefined && (
                  <Text
                    style={[
                      styles.score,
                      isTeam2Winner && styles.scoreWinner,
                    ]}
                  >
                    {result2.score}
                  </Text>
                )}
              </View>
            </View>

            {/* Tournament info */}
            {match.tournament && (
              <View style={styles.footer}>
                <Text style={styles.tournamentName} numberOfLines={1}>
                  {match.tournament.name}
                </Text>
              </View>
            )}
          </View>
        </Card>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  time: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  matchName: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  teamsContainer: {
    gap: 8,
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  teamLogo: {
    width: 32,
    height: 32,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
    flex: 1,
  },
  teamNameWinner: {
    fontWeight: '700',
    color: COLORS.accent,
  },
  score: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
    minWidth: 32,
    textAlign: 'right',
  },
  scoreWinner: {
    fontWeight: '700',
    color: COLORS.accent,
  },
  divider: {
    alignItems: 'center',
    marginVertical: 4,
  },
  vsText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSecondary,
  },
  tournamentName: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
