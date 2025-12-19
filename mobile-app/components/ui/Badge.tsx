import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '@/constants/colors';
import { borderRadius, spacing } from '@/constants/theme';

type BadgeVariant = 'live' | 'upcoming' | 'finished' | 'tierS' | 'tierA' | 'tierB' | 'tierC' | 'tierD' | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({ label, variant = 'default', style, textStyle }: BadgeProps) {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'live':
        return COLORS.live;
      case 'upcoming':
        return COLORS.info;
      case 'finished':
        return COLORS.success;
      case 'tierS':
        return COLORS.tierS;
      case 'tierA':
        return COLORS.tierA;
      case 'tierB':
        return COLORS.tierB;
      case 'tierC':
        return COLORS.tierC;
      case 'tierD':
        return COLORS.tierD;
      default:
        return COLORS.primary;
    }
  };

  const getTextColor = () => {
    // Dark text for light backgrounds (tier S, A)
    if (variant === 'tierS' || variant === 'tierA') {
      return '#000000';
    }
    return '#FFFFFF';
  };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: getTextColor() },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xs,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
