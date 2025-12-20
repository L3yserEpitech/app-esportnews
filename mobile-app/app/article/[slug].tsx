import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Badge } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header avec back button */}
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
          Article: {slug}
        </Text>

        <View style={styles.meta}>
          <Badge label="News" variant="upcoming" />
          <Text variant="bodySmall" style={styles.date}>
            19 décembre 2025
          </Text>
          <Text variant="bodySmall" style={styles.author}>
            Par Admin
          </Text>
        </View>

        <Card variant="outlined" padding="lg" style={styles.placeholder}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.placeholderTitle}>
              📰 Article Content
            </Text>
            <Text variant="bodyMedium" style={styles.placeholderText}>
              - Fetch GET /api/articles/:slug{'\n'}
              - Featured image (Expo Image){'\n'}
              - Titre, sous-titre, description{'\n'}
              - HTML content rendering{'\n'}
                (react-native-render-html){'\n'}
              - Support vidéo (WebView YouTube/Vimeo){'\n'}
              - Crédit source{'\n'}
              - Bouton partage{'\n'}
              - Articles similaires{'\n\n'}
              À implémenter au Palier 11
            </Text>
            <Text variant="bodySmall" style={styles.slugInfo}>
              Slug: {slug}
            </Text>
          </Card.Content>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button variant="outline" onPress={() => {}} style={styles.actionButton}>
            <MaterialCommunityIcons name="share-variant" size={20} color={COLORS.primary} />
            {' '}Partager
          </Button>
          <Button variant="outline" onPress={() => {}} style={styles.actionButton}>
            <MaterialCommunityIcons name="bookmark-outline" size={20} color={COLORS.primary} />
            {' '}Sauvegarder
          </Button>
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
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  date: {
    color: COLORS.textSecondary,
  },
  author: {
    color: COLORS.textSecondary,
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
    marginBottom: spacing.md,
  },
  slugInfo: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
