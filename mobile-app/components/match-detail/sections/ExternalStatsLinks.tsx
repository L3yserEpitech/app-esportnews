import React from 'react';
import { View, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { SectionHeader, type MatchSectionProps } from './shared';

// Renders one button per entry in match.links (e.g. hltv, dotabuff, opendota).
export default function ExternalStatsLinks({ match }: MatchSectionProps) {
  const entries = Object.entries(match.links || {}).filter(([, url]) => !!url);
  if (entries.length === 0) return null;

  const open = async (url: string) => {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Lien indisponible', 'Impossible d\'ouvrir ce lien.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir ce lien.');
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader icon="link-variant" title="Stats externes" />
      <View style={styles.row}>
        {entries.map(([key, url]) => (
          <Pressable key={key} style={styles.chip} onPress={() => open(url)}>
            <Text style={styles.chipText}>{key}</Text>
            <MaterialCommunityIcons name="open-in-new" size={12} color={COLORS.textSecondary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
