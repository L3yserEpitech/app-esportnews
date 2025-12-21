import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { GameProvider } from '@/contexts/GameContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { theme } from '@/constants/theme';
import '@/utils/i18n'; // Initialize i18n

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <LocaleProvider>
          <AuthProvider>
            <GameProvider>
              <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          {/* Bottom Tabs Navigation */}
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />

          {/* Auth Screens (Modal) */}
          <Stack.Screen
            name="auth/login"
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Connexion',
              headerStyle: {
                backgroundColor: theme.colors.surface,
              },
              headerTintColor: theme.colors.onSurface,
            }}
          />
          <Stack.Screen
            name="auth/register"
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Inscription',
              headerStyle: {
                backgroundColor: theme.colors.surface,
              },
              headerTintColor: theme.colors.onSurface,
            }}
          />

          {/* Dynamic Routes */}
          <Stack.Screen
            name="article/[slug]"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="tournament/[id]"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="match/[id]"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
            </GameProvider>
          </AuthProvider>
        </LocaleProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
