import React from 'react';
import { Chip as PaperChip, ChipProps as PaperChipProps } from 'react-native-paper';
import { COLORS } from '@/constants/colors';

interface ChipProps extends PaperChipProps {
  variant?: 'filled' | 'outlined';
}

export function Chip({ variant = 'filled', style, ...props }: ChipProps) {
  const mode = variant === 'outlined' ? 'outlined' : 'flat';

  return (
    <PaperChip
      mode={mode}
      style={[
        {
          backgroundColor: variant === 'filled' ? COLORS.surfaceVariant : 'transparent',
        },
        style,
      ]}
      {...props}
    />
  );
}
