import React, { useState, useCallback } from 'react';
import { Pressable, StyleSheet, Alert, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, useMatchSubscriptions } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { SubscribeMatchMeta, SubscribeTournamentMeta } from '@/services/matchSubscriptionService';

interface SubscribeButtonProps {
  type: 'match' | 'tournament';
  id: number;
  meta: SubscribeMatchMeta | SubscribeTournamentMeta;
  size?: number;
  style?: ViewStyle;
  hideWhenNotSubscribed?: boolean;
}

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  type,
  id,
  meta,
  size = 22,
  style,
  hideWhenNotSubscribed = false,
}) => {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const {
    subscribedMatchIds,
    subscribedTournamentIds,
    subscribeToMatch,
    unsubscribeFromMatch,
    subscribeToTournament,
    unsubscribeFromTournament,
    canSubscribeMatch,
    canSubscribeTournament,
  } = useMatchSubscriptions();

  const [isLoading, setIsLoading] = useState(false);

  const isSubscribed = type === 'match'
    ? subscribedMatchIds.has(id)
    : subscribedTournamentIds.has(id);

  const handlePress = useCallback(async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Connexion requise',
        'Connecte-toi pour suivre des matchs et tournois.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/auth/login' as any) },
        ]
      );
      return;
    }

    if (isLoading) return;

    try {
      setIsLoading(true);

      if (isSubscribed) {
        // Unsubscribe
        if (type === 'match') {
          await unsubscribeFromMatch(id);
        } else {
          await unsubscribeFromTournament(id);
        }
      } else {
        // Check limits before subscribing
        if (type === 'match' && !canSubscribeMatch) {
          Alert.alert(
            'Limite atteinte',
            'Les utilisateurs gratuits sont limités à 5 abonnements matchs. Passe en Premium pour un accès illimité !',
            [
              { text: 'OK', style: 'cancel' },
              { text: 'Premium', onPress: () => router.push('/profile/subscription' as any) },
            ]
          );
          return;
        }
        if (type === 'tournament' && !canSubscribeTournament) {
          Alert.alert(
            'Limite atteinte',
            'Les utilisateurs gratuits sont limités à 3 abonnements tournois. Passe en Premium pour un accès illimité !',
            [
              { text: 'OK', style: 'cancel' },
              { text: 'Premium', onPress: () => router.push('/profile/subscription' as any) },
            ]
          );
          return;
        }

        // Subscribe
        if (type === 'match') {
          await subscribeToMatch(id, meta as SubscribeMatchMeta);
        } else {
          await subscribeToTournament(id, meta as SubscribeTournamentMeta);
        }
      }
    } catch (error) {
      console.error(`[SubscribeButton] Failed to ${isSubscribed ? 'unsubscribe' : 'subscribe'}:`, error);
      Alert.alert('Erreur', 'Une erreur est survenue. Réessaie.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isSubscribed, isLoading, type, id, meta, canSubscribeMatch, canSubscribeTournament, subscribeToMatch, unsubscribeFromMatch, subscribeToTournament, unsubscribeFromTournament, router]);

  if (hideWhenNotSubscribed && !isSubscribed) return null;

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={12}
      style={[styles.button, style]}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={isSubscribed ? 'Se désabonner' : "S'abonner"}
      accessibilityState={{ selected: isSubscribed, disabled: isLoading }}
    >
      <Ionicons
        name={isSubscribed ? 'heart' : 'heart-outline'}
        size={size}
        color={isSubscribed ? COLORS.primary : COLORS.textMuted}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});
