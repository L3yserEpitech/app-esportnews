import { Tabs, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTheme, Text, IconButton } from 'react-native-paper';
import { Platform, View, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameSelector } from '@/components/features';
import React, { useState, useRef } from 'react';
import { useAuth } from '@/hooks';

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [isGameSelectorOpen, setIsGameSelectorOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggleGameSelector = () => {
    const toValue = isGameSelectorOpen ? 0 : 1;
    setIsGameSelectorOpen(!isGameSelectorOpen);
    
    Animated.timing(animation, {
      toValue,
      duration: 350,
      easing: Easing.bezier(0.33, 1, 0.68, 1), // Standard 'easeOut'
      useNativeDriver: false, // Height requires false
    }).start();
  };

  const headerHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 230], // Fixed height for selector
  });

  const headerOpacity = animation.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0, 1],
  });

  const internalTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#060B13' }}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: Platform.OS === 'ios' ? 88 : 70,
              elevation: 0,
            },
            tabBarBackground: () => (
              <BlurView 
                tint="dark"
                intensity={80}
                style={StyleSheet.absoluteFill}
              />
            ),
            tabBarIconStyle: {
              marginTop: Platform.OS === 'ios' ? 10 : 0,
            },
            headerStyle: {
              backgroundColor: '#060B13',
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Accueil',
              tabBarIcon: ({ color }: { color: string }) => (
                <FontAwesome6 name="house" size={22} color={color} />
              ),
              headerTitle: 'Esport News',
              header: ({ options }: { options: any }) => (
                <SafeAreaView edges={['top']} style={[styles.headerContainer, isGameSelectorOpen && styles.headerActiveContainer]}>
                  <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Image 
                        source={require('@/assets/logo_blanc.png')} 
                        style={styles.headerLogo}
                        contentFit="contain"
                      />
                    </View>
                    <IconButton
                      icon={({ size, color }) => (
                        <FontAwesome6 
                          name="gamepad" 
                          size={size} 
                          color={color} 
                        />
                      )}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={28}
                      onPress={toggleGameSelector}
                      style={styles.gamepadButton}
                    />
                  </View>
                  <Animated.View style={[styles.animWrapper, { height: headerHeight, opacity: headerOpacity }]}>
                    <Animated.View style={{ transform: [{ translateY: internalTranslateY }] }}>
                      <GameSelector />
                    </Animated.View>
                  </Animated.View>
                </SafeAreaView>
              )
            }}
          />
          <Tabs.Screen
            name="matchs"
            options={{
              headerTitle: 'Matchs',
              header: ({ options }: { options: any }) => (
                <SafeAreaView edges={['top']} style={[styles.headerContainer, isGameSelectorOpen && styles.headerActiveContainer]}>
                   <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Image
                        source={require('@/assets/logo_blanc.png')}
                        style={styles.headerLogo}
                        contentFit="contain"
                      />
                    </View>
                    <IconButton
                      icon={({ size, color }) => (
                        <FontAwesome6
                          name="gamepad"
                          size={size}
                          color={color}
                        />
                      )}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={28}
                      onPress={toggleGameSelector}
                      style={styles.gamepadButton}
                    />
                  </View>
                  <Animated.View style={[styles.animWrapper, { height: headerHeight, opacity: headerOpacity }]}>
                    <Animated.View style={{ transform: [{ translateY: internalTranslateY }] }}>
                      <GameSelector />
                    </Animated.View>
                  </Animated.View>
                </SafeAreaView>
              ),
              title: 'Matchs',
              tabBarIcon: ({ color }: { color: string }) => (
                <FontAwesome6 name="bolt" size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="tournaments"
            options={{
              headerTitle: 'Tournois',
              header: ({ options }: { options: any }) => (
                <SafeAreaView edges={['top']} style={[styles.headerContainer, isGameSelectorOpen && styles.headerActiveContainer]}>
                   <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Image 
                        source={require('@/assets/logo_blanc.png')} 
                        style={styles.headerLogo}
                        contentFit="contain"
                      />
                    </View>
                    <IconButton
                      icon={({ size, color }) => (
                        <FontAwesome6 
                          name="gamepad" 
                          size={size} 
                          color={color} 
                        />
                      )}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={28}
                      onPress={toggleGameSelector}
                      style={styles.gamepadButton}
                    />
                  </View>
                  <Animated.View style={[styles.animWrapper, { height: headerHeight, opacity: headerOpacity }]}>
                    <Animated.View style={{ transform: [{ translateY: internalTranslateY }] }}>
                      <GameSelector />
                    </Animated.View>
                  </Animated.View>
                </SafeAreaView>
              ),
              title: 'Tournois',
              tabBarIcon: ({ color }: { color: string }) => (
                <FontAwesome6 name="trophy" size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="news"
            options={{
              headerTitle: 'Actualités & Articles',
              header: ({ options }: { options: any }) => (
                <SafeAreaView edges={['top']} style={[styles.headerContainer, isGameSelectorOpen && styles.headerActiveContainer]}>
                   <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Image 
                        source={require('@/assets/logo_blanc.png')} 
                        style={styles.headerLogo}
                        contentFit="contain"
                      />
                    </View>
                    <IconButton
                      icon={({ size, color }) => (
                        <FontAwesome6 
                          name="gamepad" 
                          size={size} 
                          color={color} 
                        />
                      )}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={28}
                      onPress={toggleGameSelector}
                      style={styles.gamepadButton}
                    />
                  </View>
                  <Animated.View style={[styles.animWrapper, { height: headerHeight, opacity: headerOpacity }]}>
                    <Animated.View style={{ transform: [{ translateY: internalTranslateY }] }}>
                      <GameSelector />
                    </Animated.View>
                  </Animated.View>
                </SafeAreaView>
              ),
              title: 'Actus',
              tabBarIcon: ({ color }: { color: string }) => (
                <FontAwesome6 name="newspaper" size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              headerTitle: 'Mon Profil',
              headerTransparent: true,
              header: ({ options }: { options: any }) => (
                <SafeAreaView edges={['top']} style={[styles.headerContainer, { backgroundColor: 'transparent' }, isGameSelectorOpen && styles.headerActiveContainer]}>
                   <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Image
                        source={require('@/assets/logo_blanc.png')}
                        style={styles.headerLogo}
                        contentFit="contain"
                      />
                    </View>
                    <IconButton
                      icon={({ size, color }) => (
                        <FontAwesome6
                          name="gamepad"
                          size={size}
                          color={color}
                        />
                      )}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={28}
                      onPress={toggleGameSelector}
                      style={styles.gamepadButton}
                    />
                  </View>
                  <Animated.View style={[styles.animWrapper, { height: headerHeight, opacity: headerOpacity }]}>
                    <Animated.View style={{ transform: [{ translateY: internalTranslateY }] }}>
                      <GameSelector />
                    </Animated.View>
                  </Animated.View>
                </SafeAreaView>
              ),
              title: 'Profil',
              tabBarIcon: ({ color }: { color: string }) => (
                <FontAwesome6 name="user-large" size={22} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile/edit"
            options={{ href: null, headerShown: false }}
          />
          <Tabs.Screen
            name="profile/security"
            options={{ href: null, headerShown: false }}
          />
          <Tabs.Screen
            name="profile/teams"
            options={{ href: null, headerShown: false }}
          />
          <Tabs.Screen
            name="profile/notifications"
            options={{ href: null, headerShown: false }}
          />
          <Tabs.Screen
            name="profile/language"
            options={{ href: null, headerShown: false }}
          />
          <Tabs.Screen
            name="match/[id]"
            options={{ href: null, headerShown: false }}
          />
          <Tabs.Screen
            name="tournament/[id]"
            options={{ href: null, headerShown: false }}
          />
          <Tabs.Screen
            name="article/[slug]"
            options={{ href: null, headerShown: false }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#060B13',
  },
  headerActiveContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerLogo: {
    width: 120,
    height: 32,
  },
  animWrapper: {
    overflow: 'hidden',
    backgroundColor: '#060B13',
  },
  gamepadButton: {
    margin: 0,
  }
});
