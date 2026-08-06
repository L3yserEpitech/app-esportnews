import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MatchCard } from '@/components/features';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { SectionHeader, groupMatchesByDate, type TournamentSectionProps } from './shared';
import type { MatchDateGroup } from './shared';

// Interpolation en durée, jamais de ressort : un spring dépasse la valeur
// cible puis revient, ce qui fait rebondir toute la liste à chaque pli.
const EASE = Easing.out(Easing.cubic);
const DAY_LAYOUT = LinearTransition.duration(220).easing(EASE);

function DayGroup({
  group,
  isOpen,
  onToggle,
}: {
  group: MatchDateGroup;
  isOpen: boolean;
  onToggle: () => void;
}) {
  // Chevron pivoté plutôt qu'échangé : la rotation suit le pli au lieu de
  // sauter d'une icône à l'autre.
  const rotation = useDerivedValue(() => withTiming(isOpen ? 180 : 0, { duration: 240, easing: EASE }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View layout={DAY_LAYOUT} style={styles.day}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.dayHeader,
          isOpen ? styles.dayHeaderOpen : styles.dayHeaderClosed,
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
        <Animated.View style={chevronStyle}>
          <MaterialCommunityIcons
            name="chevron-down"
            size={22}
            color={isOpen ? COLORS.text : COLORS.textMuted}
          />
        </Animated.View>
      </Pressable>

      {isOpen ? (
        <Animated.View
          entering={FadeIn.duration(200).easing(EASE)}
          exiting={FadeOut.duration(120).easing(EASE)}
          style={styles.dayBody}
        >
          {group.matches.map(match => (
            <MatchCard key={match.match2id || match.id} match={match} />
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

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
        {groups.map(group => (
          <DayGroup
            key={group.dateKey}
            group={group}
            isOpen={group.dateKey === openDay}
            onToggle={() => setOpenDay(current => (current === group.dateKey ? null : group.dateKey))}
          />
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
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
  dayHeaderClosed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dayHeaderOpen: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
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
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
});
