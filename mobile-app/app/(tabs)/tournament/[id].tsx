import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Badge } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Button
          variant="text"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.text} />
        </Button>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Tournament #{id}
        </Text>

        <View style={styles.meta}>
          <Badge label="S" variant="tierS" />
          <Badge label="EN COURS" variant="live" />
        </View>

        {/* Tournament Info Card */}
        <Card variant="elevated" padding="lg" style={styles.infoCard}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Informations du Tournoi
          </Text>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>Dates:</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              01/01/2025 - 15/01/2025
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>Prize Pool:</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              $100,000
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>Jeu:</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>
              Valorant
            </Text>
          </View>
        </Card>

        {/* Placeholder for upcoming features */}
        <Card variant="outlined" padding="lg" style={styles.placeholder}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.placeholderTitle}>
              🏆 Tournament Details
            </Text>
            <Text variant="bodyMedium" style={styles.placeholderText}>
              - Fetch GET /api/tournaments/:id{'\n'}
              - Nom, tier, prize pool{'\n'}
              - Dates début/fin{'\n'}
              - Statut (running, upcoming, finished){'\n'}
              - Logo du tournoi{'\n'}
              - Liste des matchs{'\n'}
              - Bracket visualization (SVG){'\n'}
              - Teams rosters{'\n\n'}
              À implémenter au Palier 9
            </Text>
            <Text variant="bodySmall" style={styles.idInfo}>
              Tournament ID: {id}
            </Text>
          </Card.Content>
        </Card>

        {/* Matches Section */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Matchs du Tournoi
          </Text>
          <Card variant="outlined" padding="md">
            <Text variant="bodyMedium" style={styles.placeholderText}>
              Liste des matchs à afficher ici
            </Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  backButton: {
    minWidth: 40,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    color: COLORS.text,
    marginBottom: spacing.md,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoCard: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: COLORS.text,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    color: COLORS.text,
  },
  placeholder: {
    marginBottom: spacing.lg,
  },
  placeholderTitle: {
    color: COLORS.text,
    marginBottom: spacing.md,
  },
  placeholderText: {
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  idInfo: {
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: spacing.md,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: COLORS.text,
    marginBottom: spacing.md,
  },
});
