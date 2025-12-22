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
import { useAuth } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  Layout
} from 'react-native-reanimated';

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

const Section = ({ title, children, delay = 0 }: any) => (
  <Animated.View 
    entering={FadeInDown.delay(delay).duration(600)}
    style={styles.section}
  >
    <Text style={styles.sectionTitle}>{title}</Text>
    <BlurView intensity={10} tint="light" style={styles.sectionCard}>
      {children}
    </BlurView>
  </Animated.View>
);

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

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
        <Animated.View 
          entering={FadeInUp.duration(800)}
          style={styles.header}
        >
          <View style={styles.profileHeaderContainer}>
            <View style={styles.avatarWrapper}>
              <LinearGradient
                colors={[COLORS.primary, '#C2185B']}
                style={styles.avatarGradient}
              >
                {user?.photo ? (
                  <Image 
                    source={{ uri: user.photo }} 
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
        </Animated.View>

        {isAuthenticated ? (
          <>
            <Section title="Mon Compte" delay={200}>
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

            <Section title="Préférences" delay={400}>
              <ProfileItem 
                icon="heart-outline" 
                title="Équipes favorites" 
                subtitle={`${user?.favorite_team?.length || 0} équipe(s) suivie(s)`}
                onPress={() => router.push('/profile/teams' as any)}
                iconBg="rgba(255, 45, 85, 0.15)"
                color="#FF2D55"
              />
              <View style={styles.divider} />
              <ProfileItem 
                icon="notifications-outline" 
                title="Notifications" 
                subtitle="Gérer vos alertes matchs et news"
                onPress={() => router.push('/profile/notifications' as any)}
                iconBg="rgba(255, 149, 0, 0.15)"
                color="#FF9500"
              />
              <View style={styles.divider} />
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
          <Section title="Général" delay={200}>
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
        )}

        <Section title="Paramètres" delay={600}>
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
            title="Mentions légales" 
            subtitle="CGU et Confidentialité"
            onPress={() => {}}
            iconBg="rgba(142, 142, 147, 0.15)"
            color="#8E8E93"
          />
        </Section>

        {isAuthenticated && (
          <Animated.View 
            entering={FadeInDown.delay(700).duration(600)}
            style={styles.logoutContainer}
          >
            <TouchableOpacity 
              style={styles.logoutButtonFull} 
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#FF453A" />
              <Text style={styles.logoutText}>Se déconnecter</Text>
            </TouchableOpacity>
          </Animated.View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
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
