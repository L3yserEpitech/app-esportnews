import React from 'react';
import { View, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius, shadows } from '@/constants/theme';
import { SectionHeader, type MatchSectionProps } from './shared';

// Mobile: no iframe embed — a prominent button opens the live stream externally.
export default function StreamPlayer({ match, isLive }: MatchSectionProps) {
  const sorted = [...(match.streams_list || [])].sort((a, b) => {
    if (a.official && !b.official) return -1;
    if (!a.official && b.official) return 1;
    if (a.main && !b.main) return -1;
    if (!a.main && b.main) return 1;
    return 0;
  });
  const streamUrl = sorted[0]?.raw_url || sorted[0]?.embed_url || match.live?.url;
  if (!streamUrl) return null;

  const handleWatch = async () => {
    try {
      if (await Linking.canOpenURL(streamUrl)) {
        await Linking.openURL(streamUrl);
      } else {
        Alert.alert('Stream indisponible', 'Impossible d\'ouvrir ce lien.');
      }
    } catch {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le stream.');
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader
        icon="television-play"
        title="Streaming"
        extra={isLive ? (
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTagText}>EN DIRECT</Text>
          </View>
        ) : undefined}
      />
      <Pressable style={styles.watchButton} onPress={handleWatch}>
        <MaterialCommunityIcons name="play-circle" size={22} color="#FFF" />
        <Text style={styles.watchButtonText}>Regarder le stream</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: COLORS.primary,
    ...shadows.medium,
  },
  watchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.live,
  },
  liveTagText: {
    color: COLORS.live,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
