import React from 'react';
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
import { Text, ActivityIndicator } from 'react-native-paper';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useAuth, useSubscription } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

const ProfileItem = ({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  color = COLORS.text,
  iconBg = 'rgba(255, 255, 255, 0.05)'
}: any) => (
  <TouchableOpacity
    style={styles.profileItem}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.profileItemIcon, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <View style={styles.profileItemContent}>
      <Text style={styles.profileItemTitle}>{title}</Text>
      {subtitle && <Text style={styles.profileItemSubtitle}>{subtitle}</Text>}
    </View>
    {showChevron && (
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    )}
  </TouchableOpacity>
);

const Section = ({ title, children }: any) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <BlurView intensity={10} tint="light" style={styles.sectionCard}>
      {children}
    </BlurView>
  </View>
);

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { isSubscribed } = useSubscription();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <LinearGradient
          colors={[COLORS.darkBlue, COLORS.darkest]}
          style={StyleSheet.absoluteFillObject}
        />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.profileHeaderContainer}>
            <View style={styles.avatarWrapper}>
              <LinearGradient
                colors={[COLORS.primary, '#C2185B']}
                style={styles.avatarGradient}
              >
                {user?.avatar ? (
                  <Image
                    source={{ uri: user.avatar }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={40} color="white" />
                  </View>
                )}
              </LinearGradient>
              {isAuthenticated && (
                <TouchableOpacity
                  style={styles.editBadge}
                  onPress={() => router.push('/profile/edit' as any)}
                >
                  <Ionicons name="camera" size={16} color="white" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.userNameContainer}>
              <Text style={styles.userName}>
                {isAuthenticated ? user?.name : 'Visiteur'}
              </Text>
              <Text style={styles.userEmail}>
                {isAuthenticated ? user?.email : 'Connectez-vous pour profiter de tout'}
              </Text>

              {/* Badge Premium */}
              {isAuthenticated && isSubscribed && (
                <View style={styles.premiumBadge}>
                  <LinearGradient
                    colors={[COLORS.primary, '#C2185B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.premiumGradient}
                  >
                    <Ionicons name="star" size={14} color="white" />
                    <Text style={styles.premiumText}>Premium</Text>
                  </LinearGradient>
                </View>
              )}
            </View>

            {!isAuthenticated && (
              <TouchableOpacity
                style={styles.loginCta}
                onPress={() => router.push('/auth/login')}
              >
                <LinearGradient
                  colors={[COLORS.primary, '#C2185B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginButton}
                >
                  <Text style={styles.loginButtonText}>Se connecter</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isAuthenticated ? (
          <>
            <Section title="Mon Compte">
              <ProfileItem
                icon="star-outline"
                title="Abonnement Premium"
                subtitle="Zéro pub, soutenez l'app"
                onPress={() => router.push('/profile/subscription' as any)}
                iconBg="rgba(242, 46, 98, 0.15)"
                color={COLORS.primary}
              />
              <View style={styles.divider} />
              <ProfileItem
                icon="heart-outline"
                title="Mes abonnements"
                subtitle="Matchs et tournois suivis"
                onPress={() => router.push('/profile/subscriptions' as any)}
                iconBg="rgba(242, 46, 98, 0.15)"
                color={COLORS.primary}
              />
              <View style={styles.divider} />
              <ProfileItem
                icon="person-outline"
                title="Informations personnelles"
                subtitle="Modifier votre nom, email et avatar"
                onPress={() => router.push('/profile/edit' as any)}
                iconBg="rgba(88, 86, 214, 0.15)"
                color="#5856D6"
              />
              <View style={styles.divider} />
              <ProfileItem
                icon="shield-checkmark-outline"
                title="Sécurité"
                subtitle="Mot de passe et authentification"
                onPress={() => router.push('/profile/security' as any)}
                iconBg="rgba(52, 199, 89, 0.15)"
                color="#34C759"
              />
            </Section>

            <Section title="Préférences">
              <ProfileItem
                icon="language-outline"
                title="Langue"
                subtitle="Français"
                onPress={() => router.push('/profile/language' as any)}
                iconBg="rgba(0, 122, 255, 0.15)"
                color="#007AFF"
              />
            </Section>
          </>
        ) : (
          <>
            <Section title="Premium">
              <ProfileItem
                icon="star-outline"
                title="Abonnement Premium"
                subtitle="Zéro pub, soutenez l'app"
                onPress={() => router.push('/profile/subscription' as any)}
                iconBg="rgba(242, 46, 98, 0.15)"
                color={COLORS.primary}
              />
            </Section>

            <Section title="Général">
              <ProfileItem
                icon="log-in-outline"
                title="Se connecter"
                subtitle="Accéder à votre espace personnel"
                onPress={() => router.push('/auth/login')}
                iconBg="rgba(48, 209, 88, 0.15)"
                color="#30D158"
              />
              <View style={styles.divider} />
              <ProfileItem
                icon="person-add-outline"
                title="Créer un compte"
                subtitle="Rejoindre la communauté Esport News"
                onPress={() => router.push('/auth/register')}
                iconBg="rgba(10, 132, 255, 0.15)"
                color="#0A84FF"
              />
            </Section>
          </>
        )}

        <Section title="Suivez-nous">
          <ProfileItem
            icon="share-social-outline"
            title="Réseaux sociaux"
            subtitle="Suivez-nous sur toutes les plateformes"
            onPress={() => router.push('/profile/social-media' as any)}
            iconBg="rgba(94, 92, 230, 0.15)"
            color="#5E5CE6"
          />
        </Section>

        <Section title="Paramètres">
          <ProfileItem
            icon="information-circle-outline"
            title="À propos"
            subtitle="Version 1.0.0"
            showChevron={false}
            iconBg="rgba(142, 142, 147, 0.15)"
            color="#8E8E93"
          />
          <View style={styles.divider} />
          <ProfileItem
            icon="document-text-outline"
            title="Informations légales"
            subtitle="Mentions, CGU, CGV et Confidentialité"
            onPress={() => router.push('/legal' as any)}
            iconBg="rgba(142, 142, 147, 0.15)"
            color="#8E8E93"
          />
        </Section>

        {isAuthenticated && (
          <View style={styles.logoutContainer}>
            <TouchableOpacity
              style={styles.logoutButtonFull}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#FF453A" />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footerSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  profileHeaderContainer: {
    alignItems: 'center',
    width: '100%',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 3,
    borderColor: COLORS.darkest,
  },
  avatarPlaceholder: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.darkest,
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.darkest,
  },
  userNameContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  premiumBadge: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  premiumText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loginCta: {
    width: '60%',
    marginTop: spacing.md,
  },
  loginButton: {
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  profileItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  profileItemContent: {
    flex: 1,
  },
  profileItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  profileItemSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: spacing.xl * 2,
  },
  logoutContainer: {
    marginTop: spacing.sm,
  },
  logoutButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    height: 56,
    borderRadius: borderRadius.xl,
    gap: spacing.sm,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.2)',
  },
  logoutText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: spacing.md,
    fontSize: 16,
  },
  footerSpacing: {
    height: 40,
  }
});
