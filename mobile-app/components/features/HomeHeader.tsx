import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import { Game } from '@/types';

const { width } = Dimensions.get('window');

interface HomeHeaderProps {
  selectedGame: Game | null;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ selectedGame }) => {
  if (!selectedGame) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <Text variant="displaySmall" style={styles.title}>
          {selectedGame.full_name || selectedGame.name}
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Your daily source for {selectedGame.name} esport news and live results.
        </Text>
        <View style={styles.divider} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  content: {
    paddingHorizontal: spacing.md,
  },
  title: {
    color: COLORS.primary,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: COLORS.textSecondary,
    lineHeight: 22,
    maxWidth: '90%',
  },
  divider: {
    height: 2,
    width: 60,
    backgroundColor: COLORS.primary,
    marginTop: spacing.md,
    borderRadius: 1,
  },
});
