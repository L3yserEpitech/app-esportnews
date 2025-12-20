import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Badge } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const handleWatchStream = async () => {
    // TODO: Récupérer l'URL du stream depuis l'API
    const streamUrl = 'https://twitch.tv/valorant'; // Exemple
    const canOpen = await Linking.canOpenURL(streamUrl);
    if (canOpen) {
      await Linking.openURL(streamUrl);
    }
  };

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
          Match #{id}
        </Text>

        <View style={styles.meta}>
          <Badge label="LIVE" variant="live" />
          <Text variant="bodyMedium" style={styles.time}>
            En cours
          </Text>
        </View>

        {/* Teams Score Card */}
        <Card variant="elevated" padding="lg" style={styles.scoreCard}>
          <View style={styles.teamsContainer}>
            {/* Team 1 */}
            <View style={styles.team}>
              <View style={styles.teamLogo}>
                <MaterialCommunityIcons name="shield" size={40} color={COLORS.primary} />
              </View>
              <Text variant="titleMedium" style={styles.teamName}>
                Team A
              </Text>
              <Text variant="displaySmall" style={styles.score}>
                2
              </Text>
            </View>

            <Text variant="headlineLarge" style={styles.vs}>
              VS
            </Text>

            {/* Team 2 */}
            <View style={styles.team}>
              <View style={styles.teamLogo}>
                <MaterialCommunityIcons name="shield" size={40} color={COLORS.textSecondary} />
              </View>
              <Text variant="titleMedium" style={styles.teamName}>
                Team B
              </Text>
              <Text variant="displaySmall" style={styles.score}>
                1
              </Text>
            </View>
          </View>

          <Button
            variant="primary"
            onPress={handleWatchStream}
            style={styles.watchButton}
          >
            <MaterialCommunityIcons name="play-circle" size={20} color="#FFF" />
            {' '}Regarder le Stream
          </Button>
        </Card>

        {/* Match Info */}
        <Card variant="outlined" padding="lg" style={styles.infoCard}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Informations du Match
          </Text>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>Jeu:</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>Valorant</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>Format:</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>BO3</Text>
          </View>
          <View style={styles.infoRow}>
            <Text variant="bodyMedium" style={styles.infoLabel}>Tournoi:</Text>
            <Text variant="bodyMedium" style={styles.infoValue}>VCT Masters</Text>
          </View>
        </Card>

        {/* Placeholder */}
        <Card variant="outlined" padding="lg" style={styles.placeholder}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.placeholderTitle}>
              🎮 Match Details
            </Text>
            <Text variant="bodyMedium" style={styles.placeholderText}>
              - Fetch GET /api/matches/:id{'\n'}
              - Teams logos et noms{'\n'}
              - Scores en temps réel{'\n'}
              - Statut (live, upcoming, finished){'\n'}
              - Stream URL (Linking.openURL){'\n'}
              - Maps jouées (games_pandascore){'\n'}
              - Statistiques des joueurs{'\n'}
              - Lien vers tournoi parent{'\n\n'}
              À implémenter au Palier 7-8
            </Text>
            <Text variant="bodySmall" style={styles.idInfo}>
              Match ID: {id}
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
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  time: {
    color: COLORS.textSecondary,
  },
  scoreCard: {
    marginBottom: spacing.lg,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  team: {
    alignItems: 'center',
    flex: 1,
  },
  teamLogo: {
    marginBottom: spacing.sm,
  },
  teamName: {
    color: COLORS.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  score: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  vs: {
    color: COLORS.textSecondary,
    marginHorizontal: spacing.md,
  },
  watchButton: {
    marginTop: spacing.md,
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
});
