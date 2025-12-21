import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DatePickerModal } from 'react-native-paper-dates';
import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MatchCard } from '@/components/features';
import { useMatches, useGame } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function CalendarScreen() {
  const router = useRouter();
  const { selectedGame } = useGame();

  // Date picker state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Fetch matches for selected date
  const { matches, isLoading, isRefreshing, error, refetch } = useMatches({
    date: selectedDate,
    gameFilter: selectedGame?.acronym || null,
  });

  // Handle date selection
  const onConfirmDate = (params: any) => {
    // DatePickerModal passes { date: Date } for single mode
    if (params.date) {
      setSelectedDate(params.date);
    }
    setIsDatePickerOpen(false);
  };

  // Handle date picker dismiss
  const onDismissDate = () => {
    setIsDatePickerOpen(false);
  };

  // Handle match press
  const handleMatchPress = (matchId: number) => {
    router.push(`/match/${matchId}`);
  };

  // Render header
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Date selector button */}
      <Button
        mode="outlined"
        onPress={() => setIsDatePickerOpen(true)}
        icon="calendar"
        style={styles.dateButton}
        contentStyle={styles.dateButtonContent}
        labelStyle={styles.dateButtonLabel}
      >
        {format(selectedDate, 'dd MMMM yyyy', { locale: fr })}
      </Button>

      {/* Results count */}
      <View style={styles.countSection}>
        <Text style={styles.countText}>
          {matches.length} match{matches.length !== 1 ? 's' : ''}
          {selectedGame && ` · ${selectedGame.name}`}
        </Text>
      </View>
    </View>
  );

  // Render empty state
  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.emptyText}>Chargement des matchs...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={48}
            color={COLORS.error}
          />
          <Text style={styles.emptyTitle}>Erreur</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Button
            mode="contained"
            onPress={refetch}
            style={styles.retryButton}
          >
            Réessayer
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="calendar-blank"
          size={64}
          color={COLORS.textMuted}
        />
        <Text style={styles.emptyTitle}>Aucun match</Text>
        <Text style={styles.emptyText}>
          {selectedGame
            ? `Aucun match ${selectedGame.name} ce jour-là.`
            : 'Aucun match prévu pour cette date.'}
        </Text>
        <Text style={styles.emptyHint}>
          Essayez de sélectionner une autre date ou de changer de jeu.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            onPress={() => handleMatchPress(item.id)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      />

      {/* Date picker modal */}
      <DatePickerModal
        locale="fr"
        mode="single"
        visible={isDatePickerOpen}
        onDismiss={onDismissDate}
        date={selectedDate}
        onConfirm={onConfirmDate}
        validRange={{
          startDate: new Date(2020, 0, 1),
          endDate: new Date(2030, 11, 31),
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  dateButton: {
    marginBottom: 16,
    borderColor: COLORS.borderPrimary,
  },
  dateButtonContent: {
    height: 48,
  },
  dateButtonLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  countSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderPrimary,
    marginBottom: 16,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.accent,
  },
});
