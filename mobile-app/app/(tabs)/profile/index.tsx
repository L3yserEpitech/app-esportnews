import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Divider, List, ActivityIndicator, Avatar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { Card, Button } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
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

  // Loading state pendant vérification token
  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text variant="bodyMedium" style={styles.loadingText}>
          Chargement...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Header */}
      <Card variant="outlined" padding="md" style={styles.userCard}>
        <View style={styles.userHeader}>
          {user?.photo ? (
            <Avatar.Image size={64} source={{ uri: user.photo }} />
          ) : (
            <Avatar.Icon size={64} icon="account" color={COLORS.primary} style={styles.avatarIcon} />
          )}
          <View style={styles.userInfo}>
            <Text variant="titleLarge" style={styles.userName}>
              {isAuthenticated ? user?.name : 'Visiteur'}
            </Text>
            <Text variant="bodyMedium" style={styles.userEmail}>
              {isAuthenticated ? user?.email : 'Non connecté'}
            </Text>
            {isAuthenticated && (
              <Button
                variant="text"
                onPress={() => router.push('/profile/edit' as any)}
                style={styles.editButton}
              >
                Modifier le profil
              </Button>
            )}
          </View>
        </View>
      </Card>

      {/* Authentication Section (si non connecté) */}
      {!isAuthenticated && (
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Compte
          </Text>
          <Card variant="outlined">
            <List.Item
              title="Se connecter"
              description="Accédez à votre compte"
              left={(props) => <List.Icon {...props} icon="login" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/auth/login')}
            />
            <Divider />
            <List.Item
              title="Créer un compte"
              description="Rejoignez Esport News"
              left={(props) => <List.Icon {...props} icon="account-plus" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => router.push('/auth/register')}
            />
          </Card>
        </View>
      )}

      {/* Account Section (si connecté) */}
      {isAuthenticated && (
        <>
          {/* Informations */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Mon Compte
            </Text>
            <Card variant="outlined">
              <List.Item
                title="Informations personnelles"
                description="Nom, email, avatar"
                left={(props) => <List.Icon {...props} icon="account-edit" color={COLORS.primary} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push('/profile/edit' as any)}
              />
              <Divider />
              <List.Item
                title="Sécurité"
                description="Mot de passe, biométrie"
                left={(props) => <List.Icon {...props} icon="shield-lock" color={COLORS.primary} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push('/profile/security' as any)}
              />
            </Card>
          </View>

          {/* Préférences */}
          <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Préférences
            </Text>
            <Card variant="outlined">
              <List.Item
                title="Équipes favorites"
                description={`${user?.favorite_team?.length || 0} équipe(s)`}
                left={(props) => <List.Icon {...props} icon="heart" color={COLORS.primary} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push('/profile/teams' as any)}
              />
              <Divider />
              <List.Item
                title="Notifications"
                description="Push, articles, news, matchs"
                left={(props) => <List.Icon {...props} icon="bell" color={COLORS.primary} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push('/profile/notifications' as any)}
              />
              <Divider />
              <List.Item
                title="Langue"
                description="Français"
                left={(props) => <List.Icon {...props} icon="translate" color={COLORS.primary} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                onPress={() => router.push('/profile/language' as any)}
              />
            </Card>
          </View>
        </>
      )}

      {/* Settings Section (pour tous) */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Paramètres
        </Text>
        <Card variant="outlined">
          <List.Item
            title="À propos"
            description="Version 1.0.0"
            left={(props) => <List.Icon {...props} icon="information" color={COLORS.textSecondary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            disabled
          />
          <Divider />
          <List.Item
            title="Mentions légales"
            description="CGU, Politique de confidentialité"
            left={(props) => <List.Icon {...props} icon="file-document" color={COLORS.textSecondary} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            disabled
          />
        </Card>
      </View>

      {/* Logout Button (si connecté) */}
      {isAuthenticated && (
        <View style={styles.section}>
          <Button variant="outline" onPress={handleLogout} style={styles.logoutButton}>
            Se déconnecter
          </Button>
        </View>
      )}

      {/* Info Section */}
      {!isAuthenticated && (
        <View style={styles.section}>
          <Text variant="bodySmall" style={styles.infoText}>
            ℹ️ Connectez-vous pour accéder à toutes les fonctionnalités
          </Text>
        </View>
      )}
    </ScrollView>
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
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  userCard: {
    marginBottom: spacing.xl,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarIcon: {
    backgroundColor: COLORS.surface,
    marginRight: spacing.md,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  userName: {
    color: COLORS.text,
    marginBottom: spacing.xs,
  },
  userEmail: {
    color: COLORS.textSecondary,
    marginBottom: spacing.xs,
  },
  editButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: COLORS.text,
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: spacing.md,
  },
  logoutButton: {
    borderColor: '#EF4444',
  },
  infoText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
