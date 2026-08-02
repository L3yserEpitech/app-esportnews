import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { LiveMatchCard } from '@/components/features';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { SectionHeader, type TournamentSectionProps } from './shared';

export default function LiveMatches({ matches }: TournamentSectionProps) {
  const liveMatches = matches.filter(m => m.status?.toLowerCase() === 'running');
  if (liveMatches.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader
        icon="access-point"
        title="En direct"
        extra={
          <View style={styles.count}>
            <Text style={styles.countText}>{liveMatches.length}</Text>
          </View>
        }
      />
      <View style={styles.list}>
        {liveMatches.map(match => (
          <LiveMatchCard key={match.match2id || match.id} match={match} fullWidth />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  count: {
    backgroundColor: COLORS.liveTransparent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  countText: {
    color: COLORS.live,
    fontSize: 11,
    fontWeight: '800',
  },
});
