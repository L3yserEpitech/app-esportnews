import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, RadioButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/contexts/LocaleContext';
import { Card } from '@/components/ui';
import { COLORS } from '@/constants/colors';
import { spacing } from '@/constants/theme';

type SupportedLocale = 'fr' | 'en' | 'es' | 'de' | 'it';

interface Language {
  code: SupportedLocale;
  label: string;
  nativeLabel: string;
}

const LANGUAGES: Language[] = [
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italiano' },
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
      }, 300);
    } catch (error) {
      console.error('Failed to change language:', error);
      setIsChanging(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          {t('profileLanguage.title')}
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          {t('profileLanguage.selectLanguage')}
        </Text>
      </View>

      {/* Language List */}
      <Card variant="outlined">
        <RadioButton.Group
          onValueChange={(value) => handleSelectLanguage(value as SupportedLocale)}
          value={locale}
        >
          {LANGUAGES.map((language, index) => (
            <View key={language.code}>
              <View style={styles.languageItem}>
                <View style={styles.languageInfo}>
                  <Text variant="titleMedium" style={styles.languageNative}>
                    {language.nativeLabel}
                  </Text>
                  <Text variant="bodySmall" style={styles.languageEnglish}>
                    {language.label}
                  </Text>
                </View>
                {isChanging && language.code === locale ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <RadioButton
                    value={language.code}
                    color={COLORS.primary}
                    disabled={isChanging}
                  />
                )}
              </View>
              {index < LANGUAGES.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </RadioButton.Group>
      </Card>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Text variant="bodySmall" style={styles.infoText}>
          ℹ️ La langue sera appliquée immédiatement à toute l'application
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    color: COLORS.text,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  subtitle: {
    color: COLORS.textSecondary,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  languageInfo: {
    flex: 1,
  },
  languageNative: {
    color: COLORS.text,
    marginBottom: spacing.xs / 2,
  },
  languageEnglish: {
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: spacing.md,
  },
  infoContainer: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  infoText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
