import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  TouchableOpacity, 
  Dimensions,
  StatusBar,
  Platform
} from 'react-native';
import { Text, Switch, ActivityIndicator } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function NotificationsScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [notifiPush, setNotifiPush] = useState(user?.notifi_push || false);
  const [notifArticles, setNotifArticles] = useState(user?.notif_articles || false);
  const [notifNews, setNotifNews] = useState(user?.notif_news || false);
  const [notifMatchs, setNotifMatchs] = useState(user?.notif_matchs || false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setNotifiPush(user.notifi_push || false);
      setNotifArticles(user.notif_articles || false);
      setNotifNews(user.notif_news || false);
      setNotifMatchs(user.notif_matchs || false);
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      await refreshUser();
      Alert.alert('Succès', 'Vos préférences ont été mises à jour', [
        { text: 'Parfait', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error updating preferences:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour les préférences');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = () => (
    notifiPush !== (user?.notifi_push || false) ||
    notifArticles !== (user?.notif_articles || false) ||
    notifNews !== (user?.notif_news || false) ||
    notifMatchs !== (user?.notif_matchs || false)
  );

  const NotificationItem = ({ title, subtitle, value, onValueChange, icon, disabled = false }: any) => (
    <View style={[styles.settingItem, disabled && { opacity: 0.5 }]}>
      <View style={styles.settingInfo}>
        <View style={styles.settingHeader}>
          <Ionicons name={icon} size={22} color={COLORS.primary} />
          <Text style={styles.settingTitle}>{title}</Text>
        </View>
        <Text style={styles.settingDescription}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        color={COLORS.primary}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Custom Header/Navbar */}
        <View style={styles.navBar}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Notifications</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* General Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Général</Text>
          <BlurView intensity={10} tint="light" style={styles.glassCard}>
            <NotificationItem
              icon="notifications-outline"
              title="Notifications Push"
              subtitle="Recevoir les alertes sur cet appareil"
              value={notifiPush}
              onValueChange={setNotifiPush}
            />
          </BlurView>
        </View>

        {/* Categories Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Catégories</Text>
          <BlurView intensity={10} tint="light" style={styles.glassCard}>
            <NotificationItem
              icon="document-text-outline"
              title="Nouveaux articles"
              subtitle="Alertes pour chaque publication"
              value={notifArticles}
              onValueChange={setNotifArticles}
              disabled={!notifiPush}
            />
            <View style={styles.divider} />
            <NotificationItem
              icon="newspaper-outline"
              title="Actualités"
              subtitle="Les dernières news de l'esport"
              value={notifNews}
              onValueChange={setNotifNews}
              disabled={!notifiPush}
            />
            <View style={styles.divider} />
            <NotificationItem
              icon="game-controller-outline"
              title="Matchs en direct"
              subtitle="Quand vos matchs favoris débutent"
              value={notifMatchs}
              onValueChange={setNotifMatchs}
              disabled={!notifiPush}
            />
          </BlurView>
        </View>

        {!notifiPush && (
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.textMuted} />
            <Text style={styles.infoText}>
              Activez les notifications push pour configurer les catégories.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity 
          onPress={handleSave}
          disabled={isLoading || !hasChanges()}
          activeOpacity={0.8}
          style={styles.saveAction}
        >
          <LinearGradient
            colors={[COLORS.primary, '#C2185B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.saveButton,
              (isLoading || !hasChanges()) && { opacity: 0.5 }
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="white" />
                <Text style={styles.saveButtonText}>Enregistrer les préférences</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.cancelButton}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>Annuler</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  navTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    padding: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  settingInfo: {
    flex: 1,
    paddingRight: spacing.md,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: spacing.sm,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  settingDescription: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: spacing.md,
    marginHorizontal: spacing.sm,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  saveAction: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  saveButton: {
    height: 56,
    borderRadius: borderRadius.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    height: 56,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '600',
  }
});
