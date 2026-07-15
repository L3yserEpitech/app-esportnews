import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatchCard } from '@/components/features';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import { SectionHeader, groupMatchesByDate, type TournamentSectionProps } from './shared';

export default function AllMatches({ matches, isLoadingMatches }: TournamentSectionProps) {
  if (matches.length === 0) {
    if (isLoadingMatches) {
      return (
        <View style={styles.container}>
          <SectionHeader icon="gamepad-variant" title="Tous les matchs" />
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        </View>
      );
    }
    return null;
  }

  // Most recent first, mirroring the web ordering.
  const sorted = [...matches].sort((a, b) => {
    const dateA = a.begin_at || a.scheduled_at || '';
    const dateB = b.begin_at || b.scheduled_at || '';
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
  const groups = groupMatchesByDate(sorted);

  return (
    <View style={styles.container}>
      <SectionHeader
        icon="gamepad-variant"
        title="Tous les matchs"
        extra={<Text style={styles.total}>{matches.length}</Text>}
      />
      <View style={styles.groups}>
        {groups.map(group => (
          <View key={group.dateKey}>
            <View style={styles.dateHeader}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.dateLabel}>{group.label}</Text>
              <View style={styles.dateLine} />
              <Text style={styles.dateCount}>
                {group.matches.length} match{group.matches.length > 1 ? 's' : ''}
              </Text>
            </View>
            {group.matches.map(match => (
              <MatchCard key={match.match2id || match.id} match={match} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
  },
  groups: {
    gap: spacing.lg,
  },
  loading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  total: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  dateLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dateCount: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
});
