import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  Dimensions, 
  ScrollView,
  StatusBar,
  TouchableOpacity
} from 'react-native';
import { Text, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { useAuth } from '@/hooks';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  Layout
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    setError('');

    if (!name || !email || !age || !password || !confirmPassword) {
      setError('Veuillez remplir tous le champs');
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
      setError('Veuillez entrer un âge valide (minimum 13 ans)');
      return;
    }

    if (name.trim().length < 2) {
      setError('Le nom doit contenir au moins 2 caractères');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Format d\'email invalide');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);

    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        age: ageNum,
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Register error:', err);
      if (err.message?.includes('already exists') || err.message?.includes('409')) {
        setError('Cet email est déjà utilisé');
      } else {
        setError(err.message || 'Erreur lors de la création du compte');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            entering={FadeInUp.delay(200).duration(800)}
            style={styles.header}
          >
            <View style={styles.navBar}>
              <TouchableOpacity 
                onPress={() => router.replace('/(tabs)')}
                activeOpacity={0.7}
              >
                <Image 
                  source={require('@/assets/logo_blanc.png')} 
                  style={styles.headerLogo} 
                  contentFit="contain" 
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.replace('/(tabs)')}
                style={styles.homeButton}
                activeOpacity={0.7}
              >
                <Ionicons name="home" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.headerTextContainer}>
              <Text variant="headlineLarge" style={styles.title}>
                Rejoignez-nous
              </Text>
              <Text variant="bodyLarge" style={styles.subtitle}>
                Vivez l'esport au plus près de l'action.
              </Text>
            </View>
          </Animated.View>

          <Animated.View 
            entering={FadeInDown.delay(400).duration(800)}
            style={styles.formContainer}
          >
            <View style={styles.formInner}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nom Complet</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  mode="flat"
                  placeholder="John Doe"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  disabled={loading}
                  left={<TextInput.Icon icon="account-outline" color={COLORS.textMuted} />}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Email</Text>
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
                  disabled={loading}
                  left={<TextInput.Icon icon="email-outline" color={COLORS.textMuted} />}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Âge</Text>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  mode="flat"
                  placeholder="Ex: 25"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="number-pad"
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  disabled={loading}
                  left={<TextInput.Icon icon="calendar-outline" color={COLORS.textMuted} />}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Mot de passe</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  mode="flat"
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  disabled={loading}
                  left={<TextInput.Icon icon="lock-outline" color={COLORS.textMuted} />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      color={COLORS.textMuted}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Confirmer le mot de passe</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  mode="flat"
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  textColor={COLORS.text}
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor={COLORS.primary}
                  disabled={loading}
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

              <Animated.View layout={Layout.springify()}>
                {error ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                    <Text style={styles.error}>{error}</Text>
                  </View>
                ) : null}
              </Animated.View>

              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
                style={{ marginTop: spacing.md }}
              >
                <LinearGradient
                  colors={[COLORS.primary, '#C2185B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loginButton}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.loginButtonText}>Créer mon compte</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <Text style={styles.termsText}>
                En vous inscrivant, vous acceptez nos{' '}
                <Text style={styles.linkText}>Conditions d'utilisation</Text> et notre{' '}
                <Text style={styles.linkText}>Politique de confidentialité</Text>
              </Text>
            </View>
          </Animated.View>

          <Animated.View 
            entering={FadeInDown.delay(600).duration(800)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>Déjà un compte ?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.registerLink}>Se connecter</Text>
            </TouchableOpacity>
          </Animated.View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  headerLogo: {
    width: 120,
    height: 32,
  },
  homeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  title: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 32,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  formContainer: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  formInner: {
    padding: spacing.xl,
  },
  inputWrapper: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: borderRadius.lg,
    height: 56,
    fontSize: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  error: {
    color: COLORS.error,
    fontSize: 14,
    flex: 1,
  },
  loginButton: {
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  termsText: {
    marginTop: spacing.xl,
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  registerLink: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
});
