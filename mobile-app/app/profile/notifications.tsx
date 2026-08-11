import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Pressable, Switch, Linking, AppState, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { registerForPushNotificationsAsync } from '@/utils/notifications';
import { pushTokenService } from '@/services/pushTokenService';

type PermState = 'granted' | 'denied' | 'undetermined' | 'unknown';

export default function NotificationsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<PermState>('unknown');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const perms = await Notifications.getPermissionsAsync();
    setStatus(perms.granted ? 'granted' : (perms.canAskAgain ? 'undetermined' : 'denied'));
  }, []);

  // Le réglage se change dans les Réglages système : on relit à chaque retour
  // sur l'écran, sinon l'interrupteur mentirait après un aller-retour.
  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') refresh();
      });
      return () => sub.remove();
    }, [refresh])
  );

  const onToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Une app ne peut demander l'autorisation qu'une seule fois. Ensuite, elle
      // ne peut ni l'accorder ni la retirer : seuls les Réglages système le font.
      if (status === 'undetermined') {
        const token = await registerForPushNotificationsAsync();
        if (token) await pushTokenService.register(token, Platform.OS);
        await refresh();
      } else {
        await Linking.openSettings();
      }
    } finally {
      setBusy(false);
    }
  }, [busy, status, refresh]);

  const enabled = status === 'granted';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={[COLORS.darkBlue, COLORS.darkest]} style={StyleSheet.absoluteFillObject} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.card}>
        <Pressable style={styles.row} onPress={onToggle} disabled={busy}>
          <View style={styles.rowIcon}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Autoriser les notifications</Text>
            <Text style={styles.rowSubtitle}>
              {enabled
                ? 'Tu reçois les alertes de match'
                : status === 'denied'
                  ? 'Désactivées dans les réglages de ton téléphone'
                  : 'Aucune alerte de match pour le moment'}
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={onToggle}
            disabled={busy}
            trackColor={{ false: 'rgba(255,255,255,0.15)', true: COLORS.primary }}
            thumbColor="#FFFFFF"
          />
        </Pressable>
      </View>

      <Text style={styles.note}>
        {status === 'undetermined'
          ? "L'autorisation est demandée une seule fois par iOS."
          : 'Ce réglage appartient à ton téléphone : le modifier ouvre les Réglages système.'}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  card: {
    marginHorizontal: spacing.lg,
    backgroundColor: COLORS.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(242, 46, 98, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  rowSubtitle: { color: COLORS.textMuted, fontSize: 12 },
  note: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
});
