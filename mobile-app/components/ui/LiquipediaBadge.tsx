import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

interface LiquipediaBadgeProps {
  style?: StyleProp<ViewStyle>;
  align?: 'center' | 'left';
}

export function LiquipediaBadge({ style, align = 'center' }: LiquipediaBadgeProps) {
  return (
    <View style={[styles.wrapper, align === 'left' && styles.wrapperLeft, style]}>
      <Pressable
        onPress={() => Linking.openURL('https://liquipedia.net')}
        hitSlop={10}
        style={({ pressed }) => [styles.badge, pressed && styles.badgePressed]}
      >
        <MaterialCommunityIcons name="open-in-new" size={11} color={COLORS.textMuted} />
        <Text style={styles.label}>Données Liquipedia</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  wrapperLeft: {
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgePressed: {
    opacity: 0.6,
  },
  label: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
});
