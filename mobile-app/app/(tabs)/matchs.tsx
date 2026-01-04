import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp
} from 'react-native-reanimated';
import { LiveMatchCard } from '@/components/features';
import { useGame } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LiveMatch } from '@/types';
import { matchService } from '@/services';

// Utility functions for date manipulation
const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDayName = (date: Date): string => {
  const dayNames = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  return dayNames[date.getDay()];
};

const getMonthName = (date: Date): string => {
  const monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  return monthNames[date.getMonth()];
};

const isToday = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

// Generate array of 5 dates centered on current date (mobile optimized)
const generateDateRange = (centerDate: Date, offset: number = 0): Date[] => {
  const dates: Date[] = [];
  const adjustedCenter = new Date(centerDate);
  adjustedCenter.setDate(adjustedCenter.getDate() + offset * 5);

  for (let i = -2; i <= 2; i++) {
    const date = new Date(adjustedCenter);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }
  return dates;
};

const EmptyState = ({ isLoading, error, selectedGame }: any) => {
  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="bodyLarge" style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(200)}
      style={styles.emptyContainer}
    >
      <View style={styles.emptyIconContainer}>
        <MaterialCommunityIcons
          name={error ? "alert-circle-outline" : "calendar-blank"}
          size={80}
          color={error ? COLORS.live : COLORS.textMuted}
        />
        <LinearGradient
          colors={['transparent', COLORS.primary + '10', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <Text variant="headlineSmall" style={styles.emptyTitle}>
        {error ? 'Oups !' : 'Aucun match trouvé'}
      </Text>

      <Text variant="bodyMedium" style={styles.emptyDescription}>
        {error ? error : (selectedGame
          ? `Aucun match prévu pour ${selectedGame.name} ce jour.`
          : 'Aucun match prévu pour cette date.')}
      </Text>
    </Animated.View>
  );
};

export default function MatchsScreen() {
  const router = useRouter();
  const { selectedGame } = useGame();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRangeOffset, setDateRangeOffset] = useState(0);
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Generate date range
  const dateRange = useMemo(() => generateDateRange(new Date(), dateRangeOffset), [dateRangeOffset]);

  // Load matches for selected date
  const loadMatches = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const gameAcronym = selectedGame?.acronym;
      const dateStr = formatDateToYYYYMMDD(selectedDate);

      const fetchedMatches = await matchService.getMatchesByDate(dateStr, gameAcronym);

      // Filter matches to only show those with both teams defined
      const validMatches = Array.isArray(fetchedMatches)
        ? fetchedMatches.filter(match => {
            return match.opponents &&
                   match.opponents.length >= 2 &&
                   match.opponents[0]?.opponent?.name &&
                   match.opponents[1]?.opponent?.name;
          })
        : [];

      setMatches(validMatches);
    } catch (err) {
      console.error('Error loading matches:', err);
      setError('Erreur lors du chargement des matchs');
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load matches when date or game changes
  useEffect(() => {
    loadMatches();
  }, [selectedDate, selectedGame]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handlePrevRange = () => {
    setDateRangeOffset((prev) => prev - 1);
  };

  const handleNextRange = () => {
    setDateRangeOffset((prev) => prev + 1);
  };

  const renderItem = ({ item }: { item: LiveMatch }) => (
    <View style={styles.cardWrapper}>
      <LiveMatchCard
        match={item}
        onPress={() => router.push(`/match/${item.id}`)}
        fullWidth={true}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Date Calendar */}
      <View style={styles.calendarContainer}>
        <View style={styles.calendarRow}>
          {/* Previous button */}
          <TouchableOpacity
            onPress={handlePrevRange}
            style={styles.arrowButton}
          >
            <MaterialCommunityIcons name="chevron-left" size={24} color={COLORS.text} />
          </TouchableOpacity>

          {/* Date buttons */}
          <View style={styles.datesContainer}>
            {dateRange.map((date, index) => {
              const isSelected =
                date.getDate() === selectedDate.getDate() &&
                date.getMonth() === selectedDate.getMonth() &&
                date.getFullYear() === selectedDate.getFullYear();
              const isTodayDate = isToday(date);

              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleDateSelect(date)}
                  style={[
                    styles.dateButton,
                    isSelected && styles.dateButtonSelected,
                    isTodayDate && !isSelected && styles.dateButtonToday,
                  ]}
                >
                  <Text style={[
                    styles.dayText,
                    isSelected && styles.dayTextSelected,
                  ]}>
                    {getDayName(date)}
                  </Text>
                  <Text style={[
                    styles.dateNumber,
                    isSelected && styles.dateNumberSelected,
                  ]}>
                    {date.getDate()}
                  </Text>
                  <Text style={[
                    styles.monthText,
                    isSelected && styles.monthTextSelected,
                  ]}>
                    {getMonthName(date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Next button */}
          <TouchableOpacity
            onPress={handleNextRange}
            style={styles.arrowButton}
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Matches List */}
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            isLoading={isLoading}
            error={error}
            selectedGame={selectedGame}
          />
        }
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  calendarContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  datesContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginHorizontal: spacing.sm,
  },
  dateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    minWidth: 60,
  },
  dateButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateButtonToday: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: COLORS.primary,
  },
  dayText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: COLORS.text,
  },
  dateNumber: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  dateNumberSelected: {
    color: '#FFFFFF',
  },
  monthText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  monthTextSelected: {
    color: COLORS.text,
  },
  scrollContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cardWrapper: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    width: '100%',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  emptyTitle: {
    color: COLORS.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDescription: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: spacing.md,
    fontWeight: '600',
  },
});
