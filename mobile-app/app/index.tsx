import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { Button, Card, Badge, Chip } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineLarge" style={styles.title}>
        Welcome to Esport News
      </Text>
      <Text variant="bodyLarge" style={styles.subtitle}>
        Mobile App - Palier 2 Complete!
      </Text>

      {/* Buttons showcase */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Buttons
        </Text>
        <Button variant="primary" onPress={() => {}}>
          Primary Button
        </Button>
        <Button variant="secondary" onPress={() => {}} style={styles.button}>
          Secondary Button
        </Button>
        <Button variant="outline" onPress={() => {}} style={styles.button}>
          Outline Button
        </Button>
        <Button variant="text" onPress={() => {}} style={styles.button}>
          Text Button
        </Button>
      </View>

      {/* Badges showcase */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Badges
        </Text>
        <View style={styles.badgeRow}>
          <Badge label="LIVE" variant="live" style={styles.badgeItem} />
          <Badge label="UPCOMING" variant="upcoming" style={styles.badgeItem} />
          <Badge label="FINISHED" variant="finished" style={styles.badgeItem} />
        </View>
        <View style={styles.badgeRow}>
          <Badge label="S" variant="tierS" style={styles.badgeItem} />
          <Badge label="A" variant="tierA" style={styles.badgeItem} />
          <Badge label="B" variant="tierB" style={styles.badgeItem} />
          <Badge label="C" variant="tierC" style={styles.badgeItem} />
        </View>
      </View>

      {/* Chips showcase */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Chips
        </Text>
        <View style={styles.badgeRow}>
          <Chip variant="filled" style={styles.badgeItem}>
            Valorant
          </Chip>
          <Chip variant="outlined" style={styles.badgeItem}>
            CS2
          </Chip>
          <Chip variant="filled" selected style={styles.badgeItem}>
            LOL
          </Chip>
        </View>
      </View>

      {/* Card showcase */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Cards
        </Text>
        <Card variant="elevated" padding="md">
          <Card.Title
            title="Match Card Example"
            subtitle="Team A vs Team B"
            left={(props) => <Badge label="LIVE" variant="live" />}
          />
          <Card.Content>
            <Text variant="bodyMedium">This is an example of a card component with Material Design 3 styling.</Text>
          </Card.Content>
          <Card.Actions>
            <Button variant="text">Cancel</Button>
            <Button variant="primary">Watch</Button>
          </Card.Actions>
        </Card>
      </View>
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
  },
  title: {
    color: COLORS.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: COLORS.text,
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeItem: {
    marginRight: spacing.xs,
  },
});
