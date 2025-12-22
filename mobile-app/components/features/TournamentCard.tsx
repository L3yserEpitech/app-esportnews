import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius, shadows } from '@/constants/theme';
import { Badge } from '@/components/ui';
import { PandaTournament } from '@/types';

interface TournamentCardProps {
  tournament: PandaTournament;
  onPress: () => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, onPress }) => {
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const startDate = formatDate(tournament.begin_at);
  const endDate = formatDate(tournament.end_at);
  const dateRange = startDate ? (endDate && endDate !== startDate ? `${startDate} - ${endDate}` : startDate) : 'À venir';

  const getTierColor = (tier: string | null | undefined) => {
    switch (tier?.toLowerCase()) {
      case 's': return COLORS.tierS || '#FFD700';
      case 'a': return COLORS.tierA || '#FF4D4D';
      case 'b': return COLORS.tierB || '#4D79FF';
      case 'c': return COLORS.tierC || '#4DFF4D';
      default: return COLORS.textMuted;
    }
  };

  const statusInfo = (() => {
    switch (tournament.status?.toLowerCase()) {
      case 'running': return { label: 'LIVE', variant: 'live' as const };
      case 'finished': return { label: 'TERMINÉ', variant: 'finished' as const };
      default: return { label: 'UPCOMING', variant: 'upcoming' as const };
    }
  })();

  const tierColor = getTierColor(tournament.tier);

  const formatPrizePool = (prize: string | null | undefined) => {
    if (!prize) return 'TBD';
    return prize
      .replace(/United States Dollar/g, '$')
      .replace(/Euro/g, '€')
      .replace(/Pound Sterling/g, '£')
      .replace(/Japanese Yen/g, '¥')
      .replace(/South Korean Won/g, '₩')
      .replace(/Chinese Yuan/g, '¥');
  };

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      {({ pressed }) => (
        <Surface
          style={[
            styles.container,
            pressed && styles.pressed,
            { borderLeftColor: tierColor, borderLeftWidth: 4 }
          ]}
          elevation={4}
        >
          <LinearGradient
            colors={['rgba(24, 40, 89, 0.4)', 'rgba(6, 11, 19, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          />
          
          <View style={styles.contentWrapper}>
            <View style={styles.topRow}>
              <View style={styles.leagueSection}>
                <View style={styles.logoContainer}>
                  {tournament.league?.image_url ? (
                    <Image
                      source={{ uri: tournament.league?.image_url }}
                      style={styles.leagueLogo}
                      contentFit="contain"
                    />
                  ) : (
                    <MaterialCommunityIcons name="trophy-outline" size={20} color={COLORS.textMuted} />
                  )}
                </View>
                <View>
                  <Text variant="labelSmall" style={styles.leagueName} numberOfLines={1}>
                    {tournament.league?.name || 'Pro League'}
                  </Text>
                  {tournament.videogame?.name && (
                    <Text variant="labelSmall" style={styles.gameName}>
                      {tournament.videogame.name}
                    </Text>
                  )}
                </View>
              </View>
              <Badge label={statusInfo.label} variant={statusInfo.variant} />
            </View>

            <View style={styles.mainInfo}>
              <Text variant="headlineSmall" style={styles.tournamentTitle} numberOfLines={2}>
                {tournament.name}
              </Text>
              
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="calendar-month" size={14} color={COLORS.primary} />
                  <Text variant="labelMedium" style={styles.metaText}>{dateRange}</Text>
                </View>
                {tournament.region && (
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.primary} />
                    <Text variant="labelMedium" style={styles.metaText}>{tournament.region}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.separator} />

            <View style={styles.bottomRow}>
              <View style={styles.prizeBox}>
                <Text variant="labelSmall" style={styles.prizeLabel}>PRIZEPOOL</Text>
                <Text variant="titleMedium" style={styles.prizeAmount}>
                  {formatPrizePool(tournament.prizepool)}
                </Text>
              </View>
              
              <View style={[styles.tierIndicator, { backgroundColor: `${tierColor}20`, borderColor: tierColor }]}>
                <Text variant="labelMedium" style={[styles.tierText, { color: tierColor }]}>
                  TIER {tournament.tier?.toUpperCase() || 'D'}
                </Text>
              </View>
            </View>
          </View>
        </Surface>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    marginBottom: spacing.md,
    marginHorizontal: spacing.sm,
  },
  container: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.darkest,
    ...shadows.medium,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  contentWrapper: {
    padding: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  leagueSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  leagueLogo: {
    width: 24,
    height: 24,
  },
  leagueName: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gameName: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 10,
    marginTop: -2,
  },
  mainInfo: {
    marginBottom: spacing.md,
  },
  tournamentTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 20,
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: spacing.md,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  prizeBox: {
    gap: 2,
  },
  prizeLabel: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: 1,
  },
  prizeAmount: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 18,
  },
  tierIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  tierText: {
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
