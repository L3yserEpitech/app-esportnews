import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';

interface SocialMediaItemProps {
  icon: keyof typeof Ionicons.glyphMap | 'custom-x';
  name: string;
  handle: string;
  url: string;
  color: string;
  gradient: [string, string, ...string[]];
}

const XLogo = ({ size = 24, color = 'white' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </Svg>
);

const SocialMediaItem = ({ icon, name, handle, url, color, gradient }: SocialMediaItemProps) => {
  const handlePress = async () => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir ce lien');
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  return (
    <TouchableOpacity
      style={styles.socialItem}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={gradient}
        style={styles.iconGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {icon === 'custom-x' ? (
          <XLogo size={24} color="white" />
        ) : (
          <Ionicons name={icon} size={24} color="white" />
        )}
      </LinearGradient>
      <View style={styles.socialContent}>
        <Text style={styles.socialName}>{name}</Text>
        <Text style={styles.socialHandle}>{handle}</Text>
      </View>
      <Ionicons name="open-outline" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
};

export default function SocialMediaScreen() {
  const router = useRouter();

  const socialMediaAccounts: SocialMediaItemProps[] = [
    {
      icon: 'logo-instagram',
      name: 'Instagram',
      handle: '@esportnewsfr',
      url: 'https://www.instagram.com/esportnewsfr?igsh=MXU3emV0cjZ6ZG9tMg%3D%3D&utm_source=qr',
      color: '#E4405F',
      gradient: ['#833AB4', '#FD1D1D', '#FCB045'],
    },
    {
      icon: 'custom-x',
      name: 'X (Twitter)',
      handle: '@esportnews_off',
      url: 'https://x.com/esportnews_off?s=21&t=TUQ72qaoDYyvK9Drw0iIXg',
      color: '#000000',
      gradient: ['#000000', '#14171A'],
    },
    {
      icon: 'logo-linkedin',
      name: 'LinkedIn',
      handle: 'Esport News',
      url: 'https://www.linkedin.com/company/esportnews',
      color: '#0A66C2',
      gradient: ['#0A66C2', '#004182'],
    },
    {
      icon: 'logo-tiktok',
      name: 'TikTok',
      handle: '@esport_news',
      url: 'https://www.tiktok.com/@esport_news?_r=1&_t=ZN-919p4b96KV5',
      color: '#000000',
      gradient: ['#000000', '#69C9D0'],
    },
    {
      icon: 'logo-facebook',
      name: 'Facebook',
      handle: 'Esport News',
      url: 'https://www.facebook.com/share/1AVNMfAiZt/?mibextid=wwXIfr',
      color: '#1877F2',
      gradient: ['#1877F2', '#0D5DBD'],
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Custom Header/Navbar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>Réseaux sociaux</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Header Info */}
        <View style={styles.headerInfo}>
          <View style={styles.headerIconContainer}>
            <LinearGradient
              colors={[COLORS.primary, '#C2185B']}
              style={styles.headerIcon}
            >
              <Ionicons name="share-social" size={32} color="white" />
            </LinearGradient>
          </View>
          <Text style={styles.headerTitle}>Suivez-nous</Text>
          <Text style={styles.headerSubtitle}>
            Restez connecté avec Esport News sur toutes les plateformes
          </Text>
        </View>

        {/* Social Media List */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Nos réseaux</Text>
          <BlurView intensity={10} tint="light" style={styles.glassCard}>
            {socialMediaAccounts.map((account, index) => (
              <React.Fragment key={account.url}>
                <SocialMediaItem {...account} />
                {index < socialMediaAccounts.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </BlurView>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            Retrouvez toutes nos actualités, analyses et lives sur nos réseaux sociaux.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  navTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIconContainer: {
    marginBottom: spacing.md,
  },
  headerIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: spacing.sm,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  socialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  socialContent: {
    flex: 1,
  },
  socialName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  socialHandle: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginLeft: spacing.xl * 2.5,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 46, 98, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(242, 46, 98, 0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
});
