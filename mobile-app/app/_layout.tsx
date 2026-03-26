import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider } from '@/contexts/AuthContext';
import { GameProvider } from '@/contexts/GameContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AdProvider } from '@/contexts/AdContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { theme } from '@/constants/theme';
import mobileAds from 'react-native-google-mobile-ads';
import '@/utils/i18n'; // Initialize i18n

export default function RootLayout() {
  const router = useRouter();

  // Initialize Google Mobile Ads SDK
  useEffect(() => {
    mobileAds()
      .initialize()
      .then((adapterStatuses) => {
        console.log('[AdMob] SDK initialized successfully');
        console.log('[AdMob] Adapter statuses:', adapterStatuses);
      })
      .catch((error) => {
        console.error('[AdMob] SDK initialization failed:', error);
      });
  }, []);

  // Handle notification tap — deep link to match detail
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'match_start' && data?.match_id) {
        router.push(`/match/${data.match_id}` as any);
      }
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <LocaleProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <GameProvider>
                <AdProvider>
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
                </AdProvider>
              </GameProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </LocaleProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
