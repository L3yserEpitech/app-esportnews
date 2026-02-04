import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, ActivityIndicator } from 'react-native-paper';
import { Image } from 'expo-image';
import RenderHtml from 'react-native-render-html';
import * as WebBrowser from 'expo-web-browser';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { articleService } from '@/services';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import type { Article } from '@/types';

export default function ArticleDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await articleService.getArticleBySlug(slug);
        setArticle(data);
      } catch (err) {
        console.error('Error fetching article:', err);
        setError(err instanceof Error ? err.message : 'Failed to load article');
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [slug]);

  const handleShare = async () => {
    if (!article) return;

    try {
      await Share.share({
        message: `${article.title}\n\nRead on Esport News`,
        url: `esportnews://article/${slug}`,
      });
    } catch (err) {
      console.error('Error sharing article:', err);
    }
  };

  const handleVideoPress = async (videoUrl: string) => {
    try {
      await WebBrowser.openBrowserAsync(videoUrl);
    } catch (err) {
      Alert.alert('Error', 'Unable to open video');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom', 'left', 'right']}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text variant="bodyLarge" style={styles.loadingText}>
            Loading article...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !article) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom', 'left', 'right']}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="alert-circle" size={64} color={COLORS.error} />
          <Text variant="titleLarge" style={styles.errorTitle}>
            Error
          </Text>
          <Text variant="bodyMedium" style={styles.errorMessage}>
            {error || 'Article not found'}
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header avec bouton retour et partage */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable onPress={handleShare} style={styles.shareButton}>
          <MaterialCommunityIcons name="share-variant" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Image */}
        {article.featuredImage && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: article.featuredImage }}
              style={styles.featuredImage}
              contentFit="cover"
              transition={300}
            />
          </View>
        )}

        {/* Content */}
        <View style={styles.contentContainer}>
          {/* Category Badge */}
          {article.category && (
            <View style={styles.categoryBadge}>
              <Text variant="labelSmall" style={styles.categoryText}>
                {article.category.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Title */}
          <Text variant="headlineMedium" style={styles.title}>
            {article.title}
          </Text>

          {/* Subtitle */}
          {article.subtitle && (
            <Text variant="bodyLarge" style={styles.subtitle}>
              {article.subtitle}
            </Text>
          )}

          {/* Meta info */}
          <View style={styles.metaContainer}>
            {article.author && (
              <Text variant="labelMedium" style={styles.author}>
                {article.author}
              </Text>
            )}
            <Text variant="labelMedium" style={styles.date}>
              {format(new Date(article.created_at), 'dd MMMM yyyy', { locale: fr })}
            </Text>
          </View>

          {/* Video (if exists) */}
          {article.videoUrl && (
            <Pressable
              style={styles.videoContainer}
              onPress={() => handleVideoPress(article.videoUrl!)}
            >
              <View style={styles.videoOverlay}>
                <MaterialCommunityIcons name="play-circle" size={64} color="#FFFFFF" />
                <Text variant="labelMedium" style={styles.videoLabel}>
                  Watch Video
                </Text>
              </View>
              {/* Thumbnail (can use featured image as fallback) */}
              {article.featuredImage && (
                <Image
                  source={{ uri: article.featuredImage }}
                  style={styles.videoThumbnail}
                  contentFit="cover"
                />
              )}
            </Pressable>
          )}

          {/* Article Content (HTML) */}
          {(article.content ?? article.content_black) && (
            <View style={styles.htmlContainer}>
              <RenderHtml
                contentWidth={width - spacing.lg * 2}
                source={{ html: article.content ?? article.content_black ?? '' }}
                tagsStyles={htmlStyles}
                systemFonts={['System']}
              />
            </View>
          )}

          {/* Credit */}
          {article.credit && (
            <View style={styles.creditContainer}>
              <Text variant="labelSmall" style={styles.credit}>
                Credit: {article.credit}
              </Text>
            </View>
          )}

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              <Text variant="labelMedium" style={styles.tagsLabel}>
                Tags:
              </Text>
              <View style={styles.tagsList}>
                {article.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text variant="labelSmall" style={styles.tagText}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: COLORS.surface,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
    marginBottom: spacing.md,
  },
  categoryText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  title: {
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
    lineHeight: 32,
  },
  subtitle: {
    color: COLORS.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 24,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  author: {
    color: COLORS.text,
    fontWeight: '600',
  },
  date: {
    color: COLORS.textSecondary,
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  views: {
    color: COLORS.textSecondary,
  },
  videoContainer: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    backgroundColor: COLORS.surface,
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  videoLabel: {
    color: '#FFFFFF',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  htmlContainer: {
    marginBottom: spacing.lg,
  },
  creditContainer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSecondary,
    marginBottom: spacing.md,
  },
  credit: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  tagsContainer: {
    marginTop: spacing.md,
  },
  tagsLabel: {
    color: COLORS.text,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
    borderWidth: 1,
    borderColor: COLORS.borderPrimary,
  },
  tagText: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: spacing.md,
  },
  errorTitle: {
    color: COLORS.error,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  errorMessage: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

// Styles pour le rendu HTML
const htmlStyles = {
  p: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  h1: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700' as const,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  h2: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700' as const,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  h3: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  a: {
    color: COLORS.primary,
    textDecorationLine: 'underline' as const,
  },
  ul: {
    marginBottom: spacing.md,
  },
  ol: {
    marginBottom: spacing.md,
  },
  li: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  blockquote: {
    backgroundColor: COLORS.surface,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    fontStyle: 'italic' as const,
  },
  code: {
    backgroundColor: COLORS.surface,
    color: COLORS.primary,
    fontFamily: 'monospace' as const,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pre: {
    backgroundColor: COLORS.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  img: {
    marginBottom: spacing.md,
  },
  strong: {
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  em: {
    fontStyle: 'italic' as const,
    color: COLORS.text,
  },
};
