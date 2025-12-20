import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Linking, Alert, Animated, Dimensions } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LiveMatch } from '@/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;

interface LiveMatchCardProps {
  match: LiveMatch;
  onPress?: () => void;
}

export const LiveMatchCard: React.FC<LiveMatchCardProps> = ({ match, onPress }) => {
  const pulseOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseOpacity, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseOpacity]);

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
      const canOpen = await Linking.canOpenURL(streamLink);
      if (canOpen) {
        await Linking.openURL(streamLink);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir le lien de stream.');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'ouverture du stream.');
    }
  };

  return (
    <Pressable onPress={onPress || handleStreamPress} style={styles.pressable}>
      {({ pressed }) => (
        <Surface style={[styles.card, pressed && styles.cardPressed]} elevation={4}>
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
            <Animated.View style={{ opacity: pulseOpacity }}>
              <Badge label="LIVE" variant="live" />
            </Animated.View>
          </View>

          <View style={styles.teamsRow}>
            {/* Team 1 */}
            <View style={styles.teamSide}>
              <Image
                source={{ uri: team1?.image_url }}
                style={styles.teamLogo}
                contentFit="contain"
                transition={200}
              />
              <Text variant="labelLarge" style={styles.teamName} numberOfLines={1}>
                {team1?.acronym || team1?.name || 'T1'}
              </Text>
            </View>

            {/* Score Center */}
            <View style={styles.scoreCenter}>
              <View style={styles.scoreBox}>
                <Text variant="displaySmall" style={styles.scoreText}>
                  {score1 ?? 0}
                </Text>
                <Text variant="titleMedium" style={styles.vsText}>:</Text>
                <Text variant="displaySmall" style={styles.scoreText}>
                  {score2 ?? 0}
                </Text>
              </View>
              <Text variant="labelSmall" style={styles.tournamentName} numberOfLines={1}>
                {match.tournament?.name || 'Tournament'}
              </Text>
            </View>

            {/* Team 2 */}
            <View style={styles.teamSide}>
              <Image
                source={{ uri: team2?.image_url }}
                style={styles.teamLogo}
                contentFit="contain"
                transition={200}
              />
              <Text variant="labelLarge" style={styles.teamName} numberOfLines={1}>
                {team2?.acronym || team2?.name || 'T2'}
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.line} />
            <Text variant="labelSmall" style={styles.watchPrompt}>
              {streamLink ? 'タップしてストリームを見る' : 'スコアの更新中'}
            </Text>
            <View style={styles.line} />
          </View>
        </Surface>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    marginRight: spacing.md,
    marginVertical: spacing.sm,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamSide: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamLogo: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 30,
  },
  teamName: {
    color: COLORS.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreCenter: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 32,
  },
  vsText: {
    color: COLORS.primary,
    fontWeight: '900',
    opacity: 0.8,
  },
  tournamentName: {
    color: COLORS.textSecondary,
    marginTop: spacing.xs,
    fontSize: 10,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  watchPrompt: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontStyle: 'italic',
  },
});

