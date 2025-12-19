import React from 'react';
import { Card as PaperCard } from 'react-native-paper';
import { StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

interface CardProps {
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: keyof typeof spacing;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function Card({
  variant = 'elevated',
  padding,
  style,
  children,
}: CardProps) {
  const getMode = () => {
    switch (variant) {
      case 'elevated':
        return 'elevated';
      case 'outlined':
        return 'outlined';
      case 'filled':
        return 'contained';
      default:
        return 'elevated';
    }
  };

  const cardStyle = [
    styles.card,
    padding && { padding: spacing[padding] },
    style,
  ];

  return (
    <PaperCard mode={getMode() as any} style={cardStyle}>
      {children}
    </PaperCard>
  );
}

// Card sub-components for convenience
Card.Content = PaperCard.Content;
Card.Cover = PaperCard.Cover;
Card.Title = PaperCard.Title;
Card.Actions = PaperCard.Actions;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
  },
});
