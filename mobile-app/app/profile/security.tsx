import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Text, TextInput, Switch, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks';
import { Button, Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function SecurityScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Biometric authentication
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(true);

  // Check biometric availability
  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;

      setBiometricAvailable(available);

      if (available) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else {
          setBiometricType('Biométrie');
        }
      }

      // TODO: Load biometric preference from AsyncStorage
      // const enabled = await AsyncStorage.getItem('biometric_enabled');
      // setBiometricEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    } finally {
      setIsCheckingBiometric(false);
    }
  };

  // Authenticate with biometric
  const authenticateBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authentification requise',
        fallbackLabel: 'Utiliser le mot de passe',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch (error) {
      console.error('Error authenticating:', error);
      return false;
    }
  };

  // Toggle biometric authentication
  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      // Enable biometric - require authentication first
      const success = await authenticateBiometric();
      if (success) {
        setBiometricEnabled(true);
        // TODO: Save to AsyncStorage
        // await AsyncStorage.setItem('biometric_enabled', 'true');
        Alert.alert('Succès', `${biometricType} activé`);
      } else {
        Alert.alert('Échec', 'Authentification échouée');
      }
    } else {
      // Disable biometric
      setBiometricEnabled(false);
      // TODO: Remove from AsyncStorage
      // await AsyncStorage.removeItem('biometric_enabled');
      Alert.alert('Désactivé', `${biometricType} désactivé`);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword.trim()) {
      Alert.alert('Erreur', 'Le mot de passe actuel est requis');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Erreur', 'Le nouveau mot de passe est requis');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit être différent de l\'ancien');
      return;
    }

    try {
      setIsLoading(true);

      // TODO: API call to change password
      // await authService.changePassword({
      //   currentPassword,
      //   newPassword,
      // });

      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Clear fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert('Succès', 'Mot de passe modifié avec succès');
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert(
        'Erreur',
        error.message || 'Impossible de modifier le mot de passe'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Sécurité
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Gérez votre mot de passe et l'authentification
          </Text>
        </View>

        {/* Biometric Authentication */}
        {isCheckingBiometric ? (
          <Card variant="outlined" padding="md" style={styles.section}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </Card>
        ) : biometricAvailable ? (
          <Card variant="outlined" style={styles.section}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <View style={styles.settingTitleRow}>
                  <MaterialCommunityIcons
                    name="fingerprint"
                    size={24}
                    color={COLORS.primary}
                    style={styles.biometricIcon}
                  />
                  <Text variant="bodyLarge" style={styles.settingTitle}>
                    {biometricType}
                  </Text>
                </View>
                <Text variant="bodySmall" style={styles.settingDescription}>
                  Utilisez {biometricType} pour vous connecter rapidement
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                color={COLORS.primary}
              />
            </View>
          </Card>
        ) : null}

        {/* Change Password */}
        <View style={styles.section}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Changer de mot de passe
          </Text>
          <Card variant="outlined" padding="md">
            {/* Current Password */}
            <View style={styles.formGroup}>
              <Text variant="labelLarge" style={styles.label}>
                Mot de passe actuel
              </Text>
              <TextInput
                mode="outlined"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                autoComplete="password"
                style={styles.input}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.primary}
                textColor={COLORS.text}
                right={
                  <TextInput.Icon
                    icon={showCurrentPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  />
                }
              />
            </View>

            {/* New Password */}
            <View style={styles.formGroup}>
              <Text variant="labelLarge" style={styles.label}>
                Nouveau mot de passe
              </Text>
              <TextInput
                mode="outlined"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                style={styles.input}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.primary}
                textColor={COLORS.text}
                right={
                  <TextInput.Icon
                    icon={showNewPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  />
                }
              />
              <Text variant="bodySmall" style={styles.hint}>
                Au moins 6 caractères
              </Text>
            </View>

            {/* Confirm Password */}
            <View style={styles.formGroup}>
              <Text variant="labelLarge" style={styles.label}>
                Confirmer le mot de passe
              </Text>
              <TextInput
                mode="outlined"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                style={styles.input}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.primary}
                textColor={COLORS.text}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
              />
            </View>

            {/* Submit Button */}
            <Button
              variant="primary"
              onPress={handleChangePassword}
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              style={styles.changePasswordButton}
            >
              {isLoading ? 'Modification...' : 'Modifier le mot de passe'}
            </Button>
          </Card>
        </View>

        {/* Back Button */}
        <Button
          variant="outline"
          onPress={() => router.back()}
          disabled={isLoading}
        >
          Retour
        </Button>
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
  sectionTitle: {
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: spacing.md,
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
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  biometricIcon: {
    marginRight: spacing.xs,
  },
  settingTitle: {
    color: COLORS.text,
  },
  settingDescription: {
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    color: COLORS.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
  },
  hint: {
    color: COLORS.textMuted,
    marginTop: spacing.xs,
  },
  changePasswordButton: {
    marginTop: spacing.sm,
  },
});
