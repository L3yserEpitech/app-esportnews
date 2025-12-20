import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Divider, List, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
          <View style={styles.avatar}>
            <MaterialCommunityIcons
              name={isAuthenticated ? 'account-circle' : 'account'}
              size={48}
              color={isAuthenticated ? COLORS.primary : COLORS.textSecondary}
            />
          </View>
          <View style={styles.userInfo}>
            <Text variant="titleLarge" style={styles.userName}>
              {isAuthenticated ? user?.name : 'Guest User'}
            </Text>
            <Text variant="bodyMedium" style={styles.userEmail}>
              {isAuthenticated ? user?.email : 'Non connecté'}
            </Text>
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

      {/* Settings Section */}
      <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Paramètres
        </Text>
        <Card variant="outlined">
          <List.Item
            title="Équipes favorites"
            description="Gérer vos équipes"
            left={(props) => <List.Icon {...props} icon="heart" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            disabled={!isAuthenticated}
          />
          <Divider />
          <List.Item
            title="Notifications"
            description="Préférences de notification"
            left={(props) => <List.Icon {...props} icon="bell" />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            disabled={!isAuthenticated}
          />
          <Divider />
          <List.Item
            title="Langue"
            description="Français"
            left={(props) => <List.Icon {...props} icon="translate" />}
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
      <View style={styles.section}>
        {!isAuthenticated && (
          <Text variant="bodySmall" style={styles.infoText}>
            ℹ️ Connectez-vous pour accéder à toutes les fonctionnalités
          </Text>
        )}
        <Text variant="bodySmall" style={styles.versionText}>
          Version 1.0.0 - Palier 5
        </Text>
      </View>
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
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: COLORS.text,
    marginBottom: spacing.xs,
  },
  userEmail: {
    color: COLORS.textSecondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: COLORS.text,
    marginBottom: spacing.md,
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
    marginBottom: spacing.sm,
  },
  versionText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
