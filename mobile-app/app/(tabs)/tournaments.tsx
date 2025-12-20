import { View, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { Text, SegmentedButtons } from 'react-native-paper';
import { Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

type TournamentStatus = 'running' | 'upcoming' | 'finished';

export default function TournamentsScreen() {
  const [status, setStatus] = useState<TournamentStatus>('running');

  return (
    <View style={styles.container}>
      {/* Segmented Control for status filter */}
      <View style={styles.filterContainer}>
        <SegmentedButtons
          value={status}
          onValueChange={(value) => setStatus(value as TournamentStatus)}
          buttons={[
            { value: 'running', label: 'En Cours' },
            { value: 'upcoming', label: 'À Venir' },
            { value: 'finished', label: 'Terminés' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Statut: {status === 'running' ? 'En Cours' : status === 'upcoming' ? 'À Venir' : 'Terminés'}
        </Text>

        <Card variant="outlined" padding="lg" style={styles.placeholder}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.placeholderTitle}>
              🏆 Tournaments List
            </Text>
            <Text variant="bodyMedium" style={styles.placeholderText}>
              - Fetch PandaScore API{'\n'}
              - FlatList avec pagination{'\n'}
              - Filtres: status, tier, game{'\n'}
              - Infinite scroll{'\n'}
              - TournamentCard avec tier badges{'\n\n'}
              À implémenter au Palier 9
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterContainer: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  segmentedButtons: {
    backgroundColor: COLORS.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginBottom: spacing.lg,
  },
  placeholder: {
    marginTop: spacing.lg,
  },
  placeholderTitle: {
    color: COLORS.text,
    marginBottom: spacing.md,
  },
  placeholderText: {
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});
