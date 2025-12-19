import React from 'react';
import { Button as PaperButton, ButtonProps as PaperButtonProps } from 'react-native-paper';
import { StyleSheet } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text';

interface ButtonProps extends Omit<PaperButtonProps, 'mode'> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  style,
  ...props
}: ButtonProps) {
  const getMode = (): PaperButtonProps['mode'] => {
    switch (variant) {
      case 'primary':
        return 'contained';
      case 'secondary':
        return 'contained-tonal';
      case 'outline':
        return 'outlined';
      case 'text':
        return 'text';
      default:
        return 'contained';
    }
  };

  return (
    <PaperButton
      mode={getMode()}
      style={[fullWidth && styles.fullWidth, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
});
