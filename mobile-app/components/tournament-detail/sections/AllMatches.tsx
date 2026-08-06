import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { MatchCard } from '@/components/features';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { SectionHeader, groupMatchesByDate, type TournamentSectionProps } from './shared';

export default function AllMatches({ matches }: TournamentSectionProps) {
  const groups = useMemo(() => {
    // Most recent first, mirroring the web ordering.
    const sorted = [...matches].sort((a, b) => {
      const dateA = a.begin_at || a.scheduled_at || '';
      const dateB = b.begin_at || b.scheduled_at || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    return groupMatchesByDate(sorted);
  }, [matches]);

  // Un seul jour ouvert à la fois ; le plus récent l'est au premier rendu.
  // Retaper sur le jour ouvert le referme, d'où le null possible.
  const [openDay, setOpenDay] = useState<string | null>(() => groups[0]?.dateKey ?? null);

  if (matches.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader
        icon="gamepad-variant"
        title="Tous les matchs"
        extra={<Text style={styles.total}>{matches.length}</Text>}
      />
      <View style={styles.groups}>
        {groups.map(group => {
          const isOpen = group.dateKey === openDay;
          return (
            <Animated.View
              key={group.dateKey}
              layout={LinearTransition.duration(180)}
              style={[styles.day, isOpen && styles.dayOpen]}
            >
              <Pressable
                onPress={() =>
                  setOpenDay(current => (current === group.dateKey ? null : group.dateKey))
                }
                style={({ pressed }) => [
                  styles.dayHeader,
                  isOpen && styles.dayHeaderOpen,
                  pressed && styles.dayHeaderPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={14}
                  color={isOpen ? COLORS.text : COLORS.textMuted}
                />
                <Text style={[styles.dateLabel, isOpen && styles.dateLabelOpen]} numberOfLines={1}>
                  {group.label}
                </Text>
                <Text style={[styles.dateCount, isOpen && styles.dateCountOpen]}>
                  {group.matches.length} match{group.matches.length > 1 ? 's' : ''}
                </Text>
                <MaterialCommunityIcons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={isOpen ? COLORS.text : COLORS.textMuted}
                />
              </Pressable>

              {isOpen ? (
                <View style={styles.dayBody}>
                  {group.matches.map(match => (
                    <MatchCard key={match.match2id || match.id} match={match} />
                  ))}
                </View>
              ) : null}
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
  },
  groups: {
    gap: spacing.sm,
  },
  total: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  day: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayOpen: {
    borderColor: COLORS.primary,
    // Teinte plutôt qu'aplat : les cartes de match restent lisibles par-dessus.
    backgroundColor: 'rgba(242, 46, 98, 0.08)',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dayHeaderOpen: {
    backgroundColor: COLORS.primary,
  },
  dayHeaderPressed: {
    opacity: 0.85,
  },
  dateLabel: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  dateLabelOpen: {
    color: COLORS.text,
  },
  dateCount: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  dateCountOpen: {
    color: 'rgba(255,255,255,0.85)',
  },
  dayBody: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
});
