import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Linking, Alert, Dimensions, Animated } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge } from '@/components/ui';
import { SubscribeButton } from '@/components/features/SubscribeButton';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { PandaMatch } from '@/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

interface LiveMatchCardProps {
  match: PandaMatch;
  onPress?: () => void;
  fullWidth?: boolean;
}

export const LiveMatchCard: React.FC<LiveMatchCardProps> = ({ match, onPress, fullWidth }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Déterminer le statut basé sur le champ status
  const statusInfo = (() => {
    const status = match.status?.toLowerCase();

    switch (status) {
      case 'running':
        return { label: 'LIVE', variant: 'live' as const, isLive: true };
      case 'finished':
        return { label: 'TERMINÉ', variant: 'finished' as const, isLive: false };
      case 'not_started':
        return { label: 'À VENIR', variant: 'upcoming' as const, isLive: false };
      default:
        return { label: 'À VENIR', variant: 'upcoming' as const, isLive: false };
    }
  })();

  useEffect(() => {
    // N'animer que si le match est réellement LIVE
    if (!statusInfo.isLive) return;

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [statusInfo.isLive]);

  const team1 = match.opponents?.[0]?.opponent;
  const team2 = match.opponents?.[1]?.opponent;
  const score1 = match.results?.find(r => r.team_id === team1?.id)?.score;
  const score2 = match.results?.find(r => r.team_id === team2?.id)?.score;
  const streamLink = match.streams_list?.[0]?.raw_url || match.streams_list?.[0]?.embed_url || match.live?.url;

  const handleStreamPress = async () => {
    if (!streamLink) {
      Alert.alert('Stream non disponible', 'Aucun lien de stream disponible pour ce match.');
      return;
    }
    try {
      if (await Linking.canOpenURL(streamLink)) {
        await Linking.openURL(streamLink);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir le stream.');
    }
  };

  return (
    <Pressable onPress={onPress || handleStreamPress} style={({ pressed }) => [
      styles.container,
      fullWidth && { marginRight: 0 },
      pressed && styles.pressed
    ]}>
      <Surface style={[styles.card, fullWidth && { width: '100%' }]} elevation={2}>
        <LinearGradient
          colors={[COLORS.surfaceVariant, COLORS.surface]}
          style={styles.backgroundGradient}
        />
        
        <View style={styles.header}>
          <View style={styles.gameTag}>
            <Text variant="labelSmall" style={styles.gameText}>
              {match.videogame?.name || 'Live'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <SubscribeButton
              type="match"
              id={match.id}
              meta={{
                match_name: match.name || `${team1?.name || 'TBD'} vs ${team2?.name || 'TBD'}`,
                tournament_name: match.tournament?.name || '',
                game_acronym: match.videogame?.slug || '',
                begin_at: match.begin_at || undefined,
              }}
              size={18}
              hideWhenNotSubscribed
            />
            {statusInfo.isLive ? (
              <Animated.View style={{ opacity: pulseAnim }}>
                <Badge label={statusInfo.label} variant={statusInfo.variant} />
              </Animated.View>
            ) : (
              <Badge label={statusInfo.label} variant={statusInfo.variant} />
            )}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.team}>
            <Image source={{ uri: team1?.image_url ?? undefined }} style={styles.logo} contentFit="contain" />
            <Text variant="labelLarge" style={styles.teamName} numberOfLines={1}>
              {team1?.acronym || team1?.name || 'T1'}
            </Text>
          </View>

          <View style={styles.scoreContainer}>
            <View style={styles.scoreRow}>
              <Text variant="displaySmall" style={styles.scoreText}>{score1 ?? 0}</Text>
              <Text variant="titleMedium" style={styles.vsText}>-</Text>
              <Text variant="displaySmall" style={styles.scoreText}>{score2 ?? 0}</Text>
            </View>
            <Text variant="labelSmall" style={styles.tournament} numberOfLines={1}>
              {match.tournament?.name}
            </Text>
          </View>

          <View style={styles.team}>
            <Image source={{ uri: team2?.image_url ?? undefined }} style={styles.logo} contentFit="contain" />
            <Text variant="labelLarge" style={styles.teamName} numberOfLines={1}>
              {team2?.acronym || team2?.name || 'T2'}
            </Text>
          </View>
        </View>
      </Surface>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: spacing.md,
    marginVertical: spacing.sm,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  card: {
    width: CARD_WIDTH,
    minHeight: 170,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gameTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  gameText: {
    color: COLORS.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  logo: {
    width: 60,
    height: 60,
  },
  teamName: {
    color: COLORS.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreContainer: {
    flex: 1.5,
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreText: {
    color: COLORS.text,
    fontWeight: '900',
  },
  vsText: {
    color: COLORS.primary,
    fontWeight: '900',
    opacity: 0.6,
  },
  tournament: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
