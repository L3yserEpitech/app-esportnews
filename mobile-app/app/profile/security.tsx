import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  TouchableOpacity, 
  Dimensions,
  StatusBar,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Text, TextInput, Switch, ActivityIndicator } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks';
import { authService } from '@/services';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function SecurityScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingBiometric, setIsCheckingBiometric] = useState(true);

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
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    } finally {
      setIsCheckingBiometric(false);
    }
  };

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

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      const success = await authenticateBiometric();
      if (success) {
        setBiometricEnabled(true);
        Alert.alert('Succès', `${biometricType} activé`);
      } else {
        Alert.alert('Échec', 'Authentification échouée');
      }
    } else {
      setBiometricEnabled(false);
      Alert.alert('Désactivé', `${biometricType} désactivé`);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
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

    try {
      setIsLoading(true);

      // Call API to change password
      await authService.changePassword(currentPassword, newPassword);

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert('Succès', 'Mot de passe modifié avec succès', [
        { text: 'Parfait', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Error changing password:', error);
      Alert.alert('Erreur', error.message || 'Impossible de modifier le mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />
      
      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            <Text style={styles.navTitle}>Sécurité</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Biometric Section */}
          {!isCheckingBiometric && biometricAvailable && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Authentification rapide</Text>
              <BlurView intensity={10} tint="light" style={styles.glassCard}>
                <View style={styles.settingItem}>
                  <View style={styles.settingInfo}>
                    <View style={styles.settingHeader}>
                      <Ionicons 
                        name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} 
                        size={22} 
                        color={COLORS.primary} 
                      />
                      <Text style={styles.settingTitle}>{biometricType}</Text>
                    </View>
                    <Text style={styles.settingDescription}>
                      Accédez plus rapidement à votre compte
                    </Text>
                  </View>
                  <Switch
                    value={biometricEnabled}
                    onValueChange={handleToggleBiometric}
                    color={COLORS.primary}
                  />
                </View>
              </BlurView>
            </View>
          )}

          {/* Password Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Changer de mot de passe</Text>
            <BlurView intensity={10} tint="light" style={styles.glassCard}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Mot de passe actuel</Text>
                <TextInput
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  mode="flat"
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showCurrentPassword}
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  left={<TextInput.Icon icon="lock-outline" color={COLORS.textMuted} />}
                  right={
                    <TextInput.Icon
                      icon={showCurrentPassword ? 'eye-off' : 'eye'}
                      color={COLORS.textMuted}
                      onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    />
                  }
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nouveau mot de passe</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  mode="flat"
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showNewPassword}
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  left={<TextInput.Icon icon="lock-reset" color={COLORS.textMuted} />}
                  right={
                    <TextInput.Icon
                      icon={showNewPassword ? 'eye-off' : 'eye'}
                      color={COLORS.textMuted}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                    />
                  }
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Confirmer le nouveau mot de passe</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  mode="flat"
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  left={<TextInput.Icon icon="lock-check-outline" color={COLORS.textMuted} />}
                  right={
                    <TextInput.Icon
                      icon={showConfirmPassword ? 'eye-off' : 'eye'}
                      color={COLORS.textMuted}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    />
                  }
                />
              </View>
            </BlurView>
          </View>

          {/* Action Buttons */}
          <TouchableOpacity 
            onPress={handleChangePassword}
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
            activeOpacity={0.8}
            style={styles.saveAction}
          >
            <LinearGradient
              colors={[COLORS.primary, '#C2185B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.saveButton,
                (isLoading || !currentPassword || !newPassword || !confirmPassword) && { opacity: 0.5 }
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={20} color="white" />
                  <Text style={styles.saveButtonText}>Mettre à jour le mot de passe</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.cancelButton}
            disabled={isLoading}
          >
            <Text style={styles.cancelButtonText}>Retour</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  inputWrapper: {
    marginBottom: spacing.xs,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 4,
    marginLeft: 12,
  },
  input: {
    backgroundColor: 'transparent',
    height: 48,
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  saveAction: {
    marginTop: spacing.md,
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
