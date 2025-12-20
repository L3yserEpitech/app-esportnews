import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { Button, Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async () => {
    setError('');

    // Validation des champs
    if (!name || !email || !password || !confirmPassword) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    // Validation nom (minimum 2 caractères)
    if (name.trim().length < 2) {
      setError('Le nom doit contenir au moins 2 caractères');
      return;
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Format d\'email invalide');
      return;
    }

    // Validation correspondance mots de passe
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    // Validation force mot de passe (minimum 6 caractères)
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    try {
      // Appel au service d'enregistrement
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      // Redirection vers Home après succès
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Register error:', err);

      // Gestion des erreurs spécifiques
      if (err.message?.includes('email already exists') || err.message?.includes('409')) {
        setError('Cet email est déjà utilisé');
      } else if (err.message?.includes('password too weak')) {
        setError('Le mot de passe est trop faible');
      } else if (err.message?.includes('Network')) {
        setError('Erreur de connexion. Vérifiez votre réseau.');
      } else {
        setError(err.message || 'Erreur lors de la création du compte');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Créer un compte
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Rejoignez la communauté Esport News
        </Text>

        <Card variant="outlined" padding="lg" style={styles.form}>
          <TextInput
            label="Nom"
            value={name}
            onChangeText={setName}
            mode="outlined"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            style={styles.input}
            disabled={loading}
          />

          <TextInput
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            style={styles.input}
            disabled={loading}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
          />

          <TextInput
            label="Confirmer le mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            style={styles.input}
            disabled={loading}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
          />

          {error ? (
            <Text variant="bodyMedium" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <Button
            variant="primary"
            onPress={handleRegister}
            disabled={loading}
            loading={loading}
            style={styles.button}
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </Button>

          <Text variant="bodySmall" style={styles.terms}>
            En créant un compte, vous acceptez nos{' '}
            <Text style={styles.link}>Conditions d'utilisation</Text> et notre{' '}
            <Text style={styles.link}>Politique de confidentialité</Text>
          </Text>
        </Card>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            Déjà un compte ?
          </Text>
          <Button
            variant="text"
            onPress={() => router.back()}
            disabled={loading}
          >
            Se connecter
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flexGrow: 1,
    padding: spacing.md,
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  title: {
    color: COLORS.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  form: {
    marginBottom: spacing.lg,
  },
  input: {
    marginBottom: spacing.md,
    backgroundColor: COLORS.background,
  },
  error: {
    color: '#EF4444',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  terms: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  link: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textSecondary,
    marginBottom: spacing.xs,
  },
});
