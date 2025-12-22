import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';

interface LegalItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  route: string;
  color: string;
}

const LegalItem = ({ icon, title, description, route, color }: LegalItemProps) => {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.legalItem}
      onPress={() => router.push(route as any)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.legalContent}>
        <Text style={styles.legalTitle}>{title}</Text>
        <Text style={styles.legalDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
};

export default function LegalIndexScreen() {
  const router = useRouter();

  const legalDocuments = [
    {
      icon: 'document-text-outline' as const,
      title: 'Mentions légales',
      description: 'Informations sur l\'éditeur et l\'hébergeur',
      route: '/legal/mentions-legales',
      color: '#5856D6',
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: 'Politique de confidentialité',
      description: 'Comment nous protégeons vos données',
      route: '/legal/politique-confidentialite',
      color: '#34C759',
    },
    {
      icon: 'reader-outline' as const,
      title: 'CGU',
      description: 'Conditions générales d\'utilisation',
      route: '/legal/cgu',
      color: '#007AFF',
    },
    {
      icon: 'card-outline' as const,
      title: 'CGV',
      description: 'Conditions de vente Premium',
      route: '/legal/cgv',
      color: '#FF9500',
    },
    {
      icon: 'analytics-outline' as const,
      title: 'Cookies',
      description: 'Gestion des cookies et traceurs',
      route: '/legal/cookies',
      color: '#FF453A',
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <LinearGradient
        colors={[COLORS.darkBlue, COLORS.darkest]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informations légales</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BlurView intensity={10} tint="light" style={styles.card}>
          {legalDocuments.map((doc, index) => (
            <React.Fragment key={doc.route}>
              <LegalItem {...doc} />
              {index < legalDocuments.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </BlurView>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            Ces documents sont conformes au RGPD et au droit français
          </Text>
        </View>

        <View style={styles.footerSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  legalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  legalContent: {
    flex: 1,
  },
  legalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  legalDescription: {
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
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  footerSpacing: {
    height: 40,
  },
});
