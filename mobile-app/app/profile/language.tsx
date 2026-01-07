import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions,
  StatusBar,
  Platform
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useRouter, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/contexts/LocaleContext';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

type SupportedLocale = 'fr' | 'en' | 'es' | 'de' | 'it';

interface Language {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano', flag: '🇮🇹' },
];

export default function LanguageScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const [isChanging, setIsChanging] = useState(false);

  const handleSelectLanguage = async (newLocale: SupportedLocale) => {
    if (newLocale === locale) return;

    setIsChanging(true);
    try {
      await setLocale(newLocale);
      // Navigate back after a short delay to show the change
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error) {
      console.error('Failed to change language:', error);
      setIsChanging(false);
    }
  };

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
          <Text style={styles.navTitle}>Langue</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Warning Banner - Translation in progress */}
        <View style={styles.warningBanner}>
          <Ionicons name="construct-outline" size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            La traduction est actuellement en cours de développement.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Sélectionnez votre langue</Text>
          <BlurView intensity={10} tint="light" style={styles.glassCard}>
            {LANGUAGES.map((language, index) => {
              const isSelected = locale === language.code;
              return (
                <View key={language.code}>
                  <TouchableOpacity
                    style={styles.languageItem}
                    onPress={() => handleSelectLanguage(language.code)}
                    disabled={isChanging}
                    activeOpacity={0.7}
                  >
                    <View style={styles.languageFlag}>
                       <Text style={styles.flagText}>{language.flag}</Text>
                    </View>
                    <View style={styles.languageInfo}>
                      <Text style={styles.languageNative}>
                        {language.nativeLabel}
                      </Text>
                      <Text style={styles.languageEnglish}>
                        {language.label}
                      </Text>
                    </View>
                    <View style={styles.selectionIndicator}>
                      {isChanging && isSelected ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : isSelected ? (
                        <View style={styles.checkCircle}>
                          <Ionicons name="checkmark" size={16} color="white" />
                        </View>
                      ) : (
                        <View style={styles.uncheckCircle} />
                      )}
                    </View>
                  </TouchableOpacity>
                  {index < LANGUAGES.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </BlurView>
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.textMuted} />
          <Text style={styles.infoText}>
            La langue choisie sera appliquée immédiatement à l'ensemble des textes de l'application.
          </Text>
        </View>
        
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.cancelButton}
          disabled={isChanging}
        >
          <Text style={styles.cancelButtonText}>Retour</Text>
        </TouchableOpacity>

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
    marginBottom: spacing.xxl,
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
    padding: spacing.md,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  languageFlag: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  flagText: {
    fontSize: 20,
  },
  languageInfo: {
    flex: 1,
  },
  languageNative: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  languageEnglish: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginHorizontal: spacing.xs,
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#F59E0B',
    lineHeight: 18,
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  cancelButton: {
    height: 56,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelButtonText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '600',
  }
});
