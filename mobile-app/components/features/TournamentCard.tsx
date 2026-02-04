import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
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
      case 's': return COLORS.tierS;
      case 'a': return COLORS.tierA;
      case 'b': return COLORS.tierB;
      case 'c': return COLORS.tierC;
      default: return COLORS.tierD;
    }
  };

  const getStatusInfo = () => {
    const now = new Date();
    const beginAt = tournament.begin_at ? new Date(tournament.begin_at) : null;
    const endAt = tournament.end_at ? new Date(tournament.end_at) : null;

    if (beginAt && endAt) {
      if (now >= beginAt && now <= endAt) {
        return { label: 'LIVE', color: COLORS.live, bgColor: COLORS.liveTransparent };
      } else if (now > endAt) {
        return { label: 'Terminé', color: COLORS.textMuted, bgColor: 'rgba(107, 114, 128, 0.15)' };
      }
    }
    return { label: 'À venir', color: COLORS.info, bgColor: 'rgba(59, 130, 246, 0.15)' };
  };

  const tierColor = getTierColor(tournament.tier);
  const statusInfo = getStatusInfo();

  const formatPrizePool = (prize: string | null | undefined) => {
    if (!prize) return null;
    return prize
      .replace(/United States Dollar/g, '$')
      .replace(/Euro/g, '€')
      .replace(/Pound Sterling/g, '£')
      .replace(/Japanese Yen/g, '¥')
      .replace(/South Korean Won/g, '₩')
      .replace(/Chinese Yuan/g, '¥');
  };

  const prizepool = formatPrizePool(tournament.prizepool);

  return (
    <Pressable onPress={onPress} style={styles.pressable}>
      {({ pressed }) => (
        <View style={[styles.container, pressed && styles.pressed]}>
          {/* Barre tier à gauche */}
          <View style={[styles.tierBar, { backgroundColor: tierColor }]} />

          <View style={styles.content}>
            {/* Header : Game badge + Status + Tier */}
            <View style={styles.headerRow}>
              {tournament.videogame?.name && (
                <View style={styles.gameBadge}>
                  <Text style={styles.gameText}>{tournament.videogame.name}</Text>
                </View>
              )}
              <View style={styles.rightBadges}>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                  {statusInfo.label === 'LIVE' && <View style={styles.liveDot} />}
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.label}
                  </Text>
                </View>
                <View style={[styles.tierBadge, { backgroundColor: `${tierColor}20` }]}>
                  <Text style={[styles.tierText, { color: tierColor }]}>
                    {tournament.tier?.toUpperCase() || 'D'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Main content : Logo + Infos */}
            <View style={styles.mainRow}>
              <View style={styles.logoWrapper}>
                {tournament.league?.image_url ? (
                  <Image
                    source={{ uri: tournament.league?.image_url }}
                    style={styles.logo}
                    contentFit="contain"
                  />
                ) : (
                  <MaterialCommunityIcons name="trophy" size={28} color={COLORS.textMuted} />
                )}
              </View>

              <View style={styles.mainInfo}>
                <Text style={styles.leagueName} numberOfLines={1}>
                  {tournament.league?.name || 'Tournament'}
                </Text>
                <Text style={styles.tournamentName} numberOfLines={2}>
                  {tournament.name}
                </Text>
              </View>
            </View>

            {/* Footer : Date + Prizepool */}
            <View style={styles.footerRow}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="calendar-outline" size={16} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{dateRange}</Text>
              </View>
              {prizepool && (
                <View style={styles.metaItem}>
                  <MaterialCommunityIcons name="cash" size={16} color={COLORS.primary} />
                  <Text style={[styles.metaText, styles.prizeText]}>{prizepool}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
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
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  tierBar: {
    width: 5,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gameBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  gameText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoWrapper: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  logo: {
    width: 38,
    height: 38,
  },
  mainInfo: {
    flex: 1,
    gap: 4,
  },
  leagueName: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tournamentName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  tierBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.live,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  prizeText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
