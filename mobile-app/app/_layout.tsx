import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/contexts/AuthContext';
import { GameProvider } from '@/contexts/GameContext';
import { theme } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
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
      </PaperProvider>
    </SafeAreaProvider>
  );
}
