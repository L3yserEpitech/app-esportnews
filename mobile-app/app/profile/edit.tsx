import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Text, TextInput, ActivityIndicator, Avatar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks';
import { Button, Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

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

      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Nous avons besoin de votre permission pour accéder à vos photos.'
        );
        return;
      }

      // Launch image picker
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

  // Take photo with camera
  const takePhoto = async () => {
    try {
      setIsPickingImage(true);

      // Request permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Nous avons besoin de votre permission pour accéder à l\'appareil photo.'
        );
        return;
      }

      // Launch camera
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

  // Show photo picker options
  const showPhotoPicker = () => {
    Alert.alert(
      'Photo de profil',
      'Choisissez une option',
      [
        {
          text: 'Prendre une photo',
          onPress: takePhoto,
        },
        {
          text: 'Choisir depuis la galerie',
          onPress: pickImage,
        },
        {
          text: 'Annuler',
          style: 'cancel',
        },
      ]
    );
  };

  // Save profile
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Erreur', 'L\'email est requis');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Erreur', 'Format d\'email invalide');
      return;
    }

    try {
      setIsLoading(true);

      // TODO: API call to update profile
      // await userService.updateProfile({ name, email, photo });

      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Refresh user data
      await refreshUser();

      Alert.alert('Succès', 'Profil mis à jour', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le profil');
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
            Modifier le profil
          </Text>
        </View>

        {/* Avatar Section */}
        <Card variant="outlined" padding="md" style={styles.section}>
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={showPhotoPicker} disabled={isPickingImage}>
              {photo ? (
                <Avatar.Image size={100} source={{ uri: photo }} />
              ) : (
                <Avatar.Icon size={100} icon="account" color={COLORS.primary} />
              )}
              <View style={styles.avatarBadge}>
                {isPickingImage ? (
                  <ActivityIndicator size="small" color={COLORS.background} />
                ) : (
                  <MaterialCommunityIcons name="camera" size={20} color={COLORS.background} />
                )}
              </View>
            </TouchableOpacity>
            <Text variant="bodySmall" style={styles.avatarHint}>
              Touchez pour modifier
            </Text>
          </View>
        </Card>

        {/* Form Section */}
        <Card variant="outlined" padding="md" style={styles.section}>
          <View style={styles.formGroup}>
            <Text variant="labelLarge" style={styles.label}>
              Nom
            </Text>
            <TextInput
              mode="outlined"
              value={name}
              onChangeText={setName}
              placeholder="Votre nom"
              autoCapitalize="words"
              style={styles.input}
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
            />
          </View>

          <View style={styles.formGroup}>
            <Text variant="labelLarge" style={styles.label}>
              Email
            </Text>
            <TextInput
              mode="outlined"
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={styles.input}
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
            />
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            onPress={handleSave}
            disabled={isLoading}
            style={styles.saveButton}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              'Enregistrer'
            )}
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
  },
  section: {
    marginBottom: spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  avatarHint: {
    marginTop: spacing.sm,
    color: COLORS.textMuted,
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
  actions: {
    gap: spacing.md,
  },
  saveButton: {
    marginBottom: spacing.xs,
  },
});
