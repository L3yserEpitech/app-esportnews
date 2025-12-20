import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { Button, Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setError('');

    // Validation des champs
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    // Validation format email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Format d\'email invalide');
      return;
    }

    setLoading(true);

    try {
      // Appel au service d'authentification
      await login({ email, password });

      // Redirection vers Home après succès
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Login error:', err);

      // Gestion des erreurs spécifiques
      if (err.message?.includes('401')) {
        setError('Email ou mot de passe incorrect');
      } else if (err.message?.includes('Network')) {
        setError('Erreur de connexion. Vérifiez votre réseau.');
      } else {
        setError(err.message || 'Une erreur est survenue');
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
      <View style={styles.content}>
        <Text variant="headlineMedium" style={styles.title}>
          Connexion
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Connectez-vous à votre compte Esport News
        </Text>

        <Card variant="outlined" padding="lg" style={styles.form}>
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
            autoComplete="password"
            textContentType="password"
            style={styles.input}
            disabled={loading}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
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
            onPress={handleLogin}
            disabled={loading}
            loading={loading}
            style={styles.button}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>

          <Button
            variant="text"
            onPress={() => {}}
            disabled={loading}
            style={styles.forgotButton}
          >
            Mot de passe oublié ?
          </Button>
        </Card>

        <View style={styles.footer}>
          <Text variant="bodyMedium" style={styles.footerText}>
            Pas encore de compte ?
          </Text>
          <Button
            variant="text"
            onPress={() => router.push('/auth/register')}
            disabled={loading}
          >
            Créer un compte
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
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
  },
  forgotButton: {
    marginTop: spacing.sm,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textSecondary,
    marginBottom: spacing.xs,
  },
});
