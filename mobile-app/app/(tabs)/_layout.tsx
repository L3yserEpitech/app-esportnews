import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, Text, IconButton } from 'react-native-paper';
import { Platform, View, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameSelector } from '@/components/features';
import React, { useState, useRef } from 'react';

export default function TabsLayout() {
  const theme = useTheme();
  const [isGameSelectorOpen, setIsGameSelectorOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggleGameSelector = () => {
    const toValue = isGameSelectorOpen ? 0 : 1;
    setIsGameSelectorOpen(!isGameSelectorOpen);
    
    Animated.spring(animation, {
      toValue,
      useNativeDriver: false,
      friction: 8,
      tension: 40
    }).start();
  };

  const headerHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 240], // More space for scale + shadow
  });

  const headerOpacity = animation.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#060B13' }} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
            tabBarStyle: {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.surfaceVariant,
              borderTopWidth: 1,
              height: Platform.OS === 'ios' ? 88 : 60,
              paddingBottom: Platform.OS === 'ios' ? 24 : 8,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500',
            },
            headerStyle: {
              backgroundColor: theme.colors.surface,
              elevation: 0,
              shadowOpacity: 0,
            },
            headerTintColor: theme.colors.onSurface,
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
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="home" size={size} color={color} />
              ),
              headerTitle: 'Esport News',
              header: ({ options }) => (
                <View style={styles.headerContainer}>
                  <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Text style={styles.headerTitle}>{options.headerTitle as string}</Text>
                    </View>
                    <IconButton
                      icon={isGameSelectorOpen ? "controller-classic" : "controller-classic-outline"}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={24}
                      onPress={toggleGameSelector}
                    />
                  </View>
                  <Animated.View style={{ height: headerHeight, opacity: headerOpacity }}>
                    <GameSelector />
                  </Animated.View>
                </View>
              )
            }}
          />
          <Tabs.Screen
            name="live"
            options={{
              headerTitle: 'Matchs en Direct',
              header: ({ options }) => (
                <View style={styles.headerContainer}>
                   <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Text style={styles.headerTitle}>{options.headerTitle as string}</Text>
                    </View>
                    <IconButton
                      icon={isGameSelectorOpen ? "controller-classic" : "controller-classic-outline"}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={24}
                      onPress={toggleGameSelector}
                    />
                  </View>
                  <Animated.View style={{ height: headerHeight, opacity: headerOpacity }}>
                    <GameSelector />
                  </Animated.View>
                </View>
              ),
              title: 'Live',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="access-point" size={size} color={color} />
              ),
              tabBarBadge: undefined,
            }}
          />
          <Tabs.Screen
            name="tournaments"
            options={{
              headerTitle: 'Tournois',
              header: ({ options }) => (
                <View style={styles.headerContainer}>
                   <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Text style={styles.headerTitle}>{options.headerTitle as string}</Text>
                    </View>
                    <IconButton
                      icon={isGameSelectorOpen ? "controller-classic" : "controller-classic-outline"}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={24}
                      onPress={toggleGameSelector}
                    />
                  </View>
                  <Animated.View style={{ height: headerHeight, opacity: headerOpacity }}>
                    <GameSelector />
                  </Animated.View>
                </View>
              ),
              title: 'Tournois',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="trophy" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              headerTitle: 'Calendrier des Matchs',
              header: ({ options }) => (
                <View style={styles.headerContainer}>
                   <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Text style={styles.headerTitle}>{options.headerTitle as string}</Text>
                    </View>
                    <IconButton
                      icon={isGameSelectorOpen ? "controller-classic" : "controller-classic-outline"}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={24}
                      onPress={toggleGameSelector}
                    />
                  </View>
                  <Animated.View style={{ height: headerHeight, opacity: headerOpacity }}>
                    <GameSelector />
                  </Animated.View>
                </View>
              ),
              title: 'Calendrier',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="calendar" size={size} color={color} />
              ),
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              headerTitle: 'Mon Profil',
              header: ({ options }) => (
                <View style={styles.headerContainer}>
                   <View style={styles.headerTop}>
                    <View style={styles.headerTitleContainer}>
                      <Text style={styles.headerTitle}>{options.headerTitle as string}</Text>
                    </View>
                    <IconButton
                      icon={isGameSelectorOpen ? "controller-classic" : "controller-classic-outline"}
                      iconColor={isGameSelectorOpen ? theme.colors.primary : "#FFFFFF"}
                      size={24}
                      onPress={toggleGameSelector}
                    />
                  </View>
                  <Animated.View style={{ height: headerHeight, opacity: headerOpacity }}>
                    <GameSelector />
                  </Animated.View>
                </View>
              ),
              title: 'Profil',
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="account" size={size} color={color} />
              ),
            }}
          />
        </Tabs>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#060B13',
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  }
});
