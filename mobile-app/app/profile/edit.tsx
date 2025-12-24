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
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks';
import { authService } from '@/services';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photo, setPhoto] = useState<string | undefined>(user?.photo);
  const [isLoading, setIsLoading] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);

  // Request permission and pick image
  const pickImage = async () => {
    try {
      setIsPickingImage(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Nous avons besoin de votre permission pour accéder à vos photos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
    } finally {
      setIsPickingImage(false);
    }
  };

  const takePhoto = async () => {
    try {
      setIsPickingImage(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Nous avons besoin de votre permission pour accéder à l\'appareil photo.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre une photo');
    } finally {
      setIsPickingImage(false);
    }
  };

  const showPhotoPicker = () => {
    Alert.alert(
      'Photo de profil',
      'Choisissez une option',
      [
        { text: 'Prendre une photo', onPress: takePhoto },
        { text: 'Choisir depuis la galerie', onPress: pickImage },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Format d\'email invalide');
      return;
    }

    try {
      setIsLoading(true);

      // Prepare update data
      const updateData: { name?: string; email?: string; avatar?: string } = {
        name: name.trim(),
        email: email.trim(),
      };

      // Upload photo if changed (local URI)
      if (photo && photo !== user?.photo && photo.startsWith('file://')) {
        try {
          const uploadResult = await authService.uploadProfilePhoto(photo);
          updateData.avatar = uploadResult.avatar_url;
        } catch (uploadError: any) {
          // Si l'upload échoue (501 Not Implemented), on continue sans la photo
          console.warn('Avatar upload not implemented:', uploadError.message);
        }
      } else if (photo && photo === user?.photo) {
        // Photo inchangée, on garde l'ancienne
        updateData.avatar = user.photo;
      }

      // Update profile with new data
      await authService.updateProfile(updateData);

      // Refresh user data from server
      await refreshUser();

      Alert.alert('Succès', 'Votre profil a été mis à jour', [
        { text: 'Parfait', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le profil');
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
            <Text style={styles.navTitle}>Modifier le profil</Text>
            <View style={{ width: 44 }} /> {/* Spacing balance */}
          </View>
          {/* Avatar Section */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity 
              onPress={showPhotoPicker} 
              activeOpacity={0.9}
              style={styles.avatarWrapper}
            >
              <LinearGradient
                colors={[COLORS.primary, '#C2185B']}
                style={styles.avatarGradient}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={50} color="white" />
                  </View>
                )}
              </LinearGradient>
              <View style={styles.editBadge}>
                {isPickingImage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="camera" size={18} color="white" />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarHint}>Touchez pour changer la photo</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={styles.sectionLabel}>Informations</Text>
            
            <BlurView intensity={10} tint="light" style={styles.glassCard}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nom d'utilisateur</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  mode="flat"
                  placeholder="Votre nom"
                  placeholderTextColor={COLORS.textMuted}
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  left={<TextInput.Icon icon="account-outline" color={COLORS.textMuted} />}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Adresse Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  mode="flat"
                  placeholder="votre@email.com"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  left={<TextInput.Icon icon="email-outline" color={COLORS.textMuted} />}
                />
              </View>
            </BlurView>
          </View>

          {/* Save Button */}
          <TouchableOpacity 
            onPress={handleSave}
            disabled={isLoading}
            activeOpacity={0.8}
            style={styles.saveAction}
          >
            <LinearGradient
              colors={[COLORS.primary, '#C2185B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                  <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    borderColor: COLORS.darkest,
  },
  avatarPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.darkest,
  },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.darkest,
  },
  avatarHint: {
    marginTop: spacing.md,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  formSection: {
    marginBottom: spacing.xxl,
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
