import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { Image } from 'expo-image';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { Badge } from '@/components/ui';
import { PandaTournament } from '@/types';

interface TournamentCardProps {
  tournament: PandaTournament;
  onPress: () => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, onPress }) => {
  const startDate = tournament.begin_at 
    ? new Date(tournament.begin_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
      })
    : 'À venir';

  const getTierVariant = (tier: string | null | undefined) => {
    switch (tier?.toLowerCase()) {
      case 's': return 'tierS';
      case 'a': return 'tierA';
      case 'b': return 'tierB';
      case 'c': return 'tierC';
      case 'd': return 'tierD';
      default: return 'default';
    }
  };

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Surface
          style={[
            styles.container,
            pressed && styles.pressed,
          ]}
          elevation={1}
        >
          <View style={styles.header}>
            <View style={styles.leagueInfo}>
              {tournament.league?.image_url && (
                <Image
                  source={{ uri: tournament.league?.image_url }}
                  style={styles.leagueLogo}
                  contentFit="contain"
                />
              )}
              <View style={styles.leagueTextContainer}>
                <Text variant="labelLarge" style={styles.leagueName} numberOfLines={1}>
                  {tournament.league?.name || 'League'}
                </Text>
                <Text variant="labelSmall" style={styles.tournamentName} numberOfLines={1}>
                  {tournament.name}
                </Text>
              </View>
            </View>
            <Badge label={tournament.tier?.toUpperCase() || 'D'} variant={getTierVariant(tournament.tier)} />
          </View>

          <View style={styles.footer}>
            <View style={styles.dateContainer}>
              <Text variant="labelSmall" style={styles.dateLabel}>DATE</Text>
              <Text variant="labelLarge" style={styles.dateValue}>{startDate}</Text>
            </View>
            {tournament.prizepool && (
              <View style={styles.prizeContainer}>
                <Text variant="labelSmall" style={styles.dateLabel}>PRIZEPOOL</Text>
                <Text variant="labelLarge" style={styles.prizeValue}>{tournament.prizepool}</Text>
              </View>
            )}
          </View>
        </Surface>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: COLORS.surface,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pressed: {
    backgroundColor: COLORS.surfaceVariant,
    opacity: 0.9,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  leagueInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leagueLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.darkBlue,
  },
  leagueTextContainer: {
    flex: 1,
  },
  leagueName: {
    color: COLORS.text,
    fontWeight: '700',
  },
  tournamentName: {
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  dateContainer: {
    gap: 2,
  },
  dateLabel: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 10,
  },
  dateValue: {
    color: COLORS.text,
    fontWeight: '700',
  },
  prizeContainer: {
    alignItems: 'flex-end',
    gap: 2,
  },
  prizeValue: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
