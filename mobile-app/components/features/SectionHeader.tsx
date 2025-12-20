import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';
import { Badge } from '@/components/ui';

interface SectionHeaderProps {
  title: string;
  onViewAll?: () => void;
  showLiveBadge?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  onViewAll,
  showLiveBadge = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text variant="titleMedium" style={styles.title}>
          {title}
        </Text>
        {showLiveBadge && (
          <Badge label="LIVE" variant="live" />
        )}
      </View>
      {onViewAll && (
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text variant="labelLarge" style={styles.viewAll}>
            View All
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  viewAll: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
