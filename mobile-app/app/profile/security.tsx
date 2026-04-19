import React, { useState } from 'react';
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
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
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
  const { refreshUser, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteAccount = () => {
    if (!deletePassword.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe pour confirmer la suppression');
      return;
    }

    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes vos données seront définitivement supprimées. Êtes-vous sûr ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await authService.deleteAccount(deletePassword);
              await logout();
              Alert.alert(
                'Compte supprimé',
                'Votre compte a été supprimé avec succès.',
                [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
              );
            } catch (error: any) {
              Alert.alert('Erreur', error.message || 'Impossible de supprimer le compte');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
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

          {/* Delete Account Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: '#FF453A' }]}>Zone de danger</Text>
            <BlurView intensity={10} tint="light" style={[styles.glassCard, { borderColor: 'rgba(255, 69, 58, 0.2)' }]}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Confirmez votre mot de passe</Text>
                <TextInput
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  mode="flat"
                  placeholder="Entrez votre mot de passe"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showDeletePassword}
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="#FF453A"
                  left={<TextInput.Icon icon="lock-outline" color={COLORS.textMuted} />}
                  right={
                    <TextInput.Icon
                      icon={showDeletePassword ? 'eye-off' : 'eye'}
                      color={COLORS.textMuted}
                      onPress={() => setShowDeletePassword(!showDeletePassword)}
                    />
                  }
                />
              </View>
            </BlurView>
          </View>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={isDeleting || !deletePassword}
            activeOpacity={0.8}
            style={{ marginBottom: spacing.md }}
          >
            <View style={[styles.deleteButton, (isDeleting || !deletePassword) && { opacity: 0.5 }]}>
              {isDeleting ? (
                <ActivityIndicator color="#FF453A" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#FF453A" />
                  <Text style={styles.deleteButtonText}>Supprimer mon compte</Text>
                </>
              )}
            </View>
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
  },
  deleteButton: {
    height: 56,
    borderRadius: borderRadius.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  deleteButtonText: {
    color: '#FF453A',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
