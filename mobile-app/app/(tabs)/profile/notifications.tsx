import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Text, Switch, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { Button, Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [notifiPush, setNotifiPush] = useState(user?.notifi_push || false);
  const [notifArticles, setNotifArticles] = useState(user?.notif_articles || false);
  const [notifNews, setNotifNews] = useState(user?.notif_news || false);
  const [notifMatchs, setNotifMatchs] = useState(user?.notif_matchs || false);
  const [isLoading, setIsLoading] = useState(false);

  // Sync with user data
  useEffect(() => {
    if (user) {
      setNotifiPush(user.notifi_push || false);
      setNotifArticles(user.notif_articles || false);
      setNotifNews(user.notif_news || false);
      setNotifMatchs(user.notif_matchs || false);
    }
  }, [user]);

  // Save preferences
  const handleSave = async () => {
    try {
      setIsLoading(true);

      // TODO: API call to update notification preferences
      // await userService.updateNotificationPreferences({
      //   notifi_push: notifiPush,
      //   notif_articles: notifArticles,
      //   notif_news: notifNews,
      //   notif_matchs: notifMatchs,
      // });

      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh user data
      await refreshUser();

      Alert.alert('Succès', 'Préférences mises à jour', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error updating preferences:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour les préférences');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if any changes were made
  const hasChanges = () => {
    return (
      notifiPush !== (user?.notifi_push || false) ||
      notifArticles !== (user?.notif_articles || false) ||
      notifNews !== (user?.notif_news || false) ||
      notifMatchs !== (user?.notif_matchs || false)
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Notifications
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Gérez vos préférences de notification
          </Text>
        </View>

        {/* Notification Settings */}
        <Card variant="outlined" style={styles.section}>
          {/* Push Notifications */}
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text variant="bodyLarge" style={styles.settingTitle}>
                Notifications push
              </Text>
              <Text variant="bodySmall" style={styles.settingDescription}>
                Recevoir toutes les notifications sur votre appareil
              </Text>
            </View>
            <Switch
              value={notifiPush}
              onValueChange={setNotifiPush}
              color={COLORS.primary}
            />
          </View>

          <Divider />

          {/* Articles Notifications */}
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text variant="bodyLarge" style={styles.settingTitle}>
                Nouveaux articles
              </Text>
              <Text variant="bodySmall" style={styles.settingDescription}>
                Notifications pour les nouveaux articles publiés
              </Text>
            </View>
            <Switch
              value={notifArticles}
              onValueChange={setNotifArticles}
              color={COLORS.primary}
              disabled={!notifiPush}
            />
          </View>

          <Divider />

          {/* News Notifications */}
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text variant="bodyLarge" style={styles.settingTitle}>
                Actualités
              </Text>
              <Text variant="bodySmall" style={styles.settingDescription}>
                Notifications pour les dernières actualités esport
              </Text>
            </View>
            <Switch
              value={notifNews}
              onValueChange={setNotifNews}
              color={COLORS.primary}
              disabled={!notifiPush}
            />
          </View>

          <Divider />

          {/* Matches Notifications */}
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text variant="bodyLarge" style={styles.settingTitle}>
                Matchs en direct
              </Text>
              <Text variant="bodySmall" style={styles.settingDescription}>
                Notifications quand vos matchs favoris commencent
              </Text>
            </View>
            <Switch
              value={notifMatchs}
              onValueChange={setNotifMatchs}
              color={COLORS.primary}
              disabled={!notifiPush}
            />
          </View>
        </Card>

        {/* Info Card */}
        {!notifiPush && (
          <Card variant="outlined" padding="md" style={styles.infoCard}>
            <Text variant="bodySmall" style={styles.infoText}>
              ℹ️ Activez les notifications push pour recevoir des alertes
            </Text>
          </Card>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            onPress={handleSave}
            disabled={isLoading || !hasChanges()}
            style={styles.saveButton}
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          <Button
            variant="outline"
            onPress={() => router.back()}
            disabled={isLoading}
          >
            Annuler
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    color: COLORS.text,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  infoCard: {
    marginBottom: spacing.lg,
    backgroundColor: COLORS.surface,
  },
  infoText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.md,
  },
  saveButton: {
    marginBottom: spacing.xs,
  },
});
