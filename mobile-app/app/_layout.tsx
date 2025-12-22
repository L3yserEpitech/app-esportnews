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
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="auth/register"
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
