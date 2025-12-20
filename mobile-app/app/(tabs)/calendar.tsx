import { View, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { Text } from 'react-native-paper';
import { Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="titleLarge" style={styles.title}>
        Calendrier des Matchs
      </Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Sélectionnez une date pour voir les matchs prévus
      </Text>

      <Card variant="outlined" padding="lg" style={styles.placeholder}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.placeholderTitle}>
            📅 Calendar Component
          </Text>
          <Text variant="bodyMedium" style={styles.placeholderText}>
            - Installer react-native-paper-dates{'\n'}
            - Date picker avec dots{'\n'}
              (marqueurs sur dates avec matchs){'\n'}
            - Fetch matchs: POST /api/matches/by-date{'\n'}
            - Liste des matchs du jour sélectionné{'\n'}
            - Filtre par jeu{'\n\n'}
            À implémenter au Palier 10
          </Text>
          <Text variant="bodySmall" style={styles.currentDate}>
            Date sélectionnée: {selectedDate.toLocaleDateString('fr-FR')}
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: COLORS.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginBottom: spacing.xl,
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
  currentDate: {
    color: COLORS.primary,
    marginTop: spacing.md,
    fontWeight: '500',
  },
});
