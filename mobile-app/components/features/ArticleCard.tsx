import React from 'react';
import { StyleSheet, View, Pressable, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';
import { NewsItem } from '@/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75;
const CARD_HEIGHT = 200;

interface ArticleCardProps {
  article: NewsItem;
  onPress: () => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onPress }) => {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [
      styles.container,
      pressed && styles.pressed
    ]}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: article.featuredImage }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={['transparent', 'rgba(6, 11, 19, 0.9)']}
          style={styles.gradient}
        />
        <View style={styles.content}>
          <View style={styles.categoryContainer}>
            <Text variant="labelSmall" style={styles.category}>
              {article.category || 'News'}
            </Text>
          </View>
          <Text variant="titleMedium" style={styles.title} numberOfLines={2}>
            {article.title}
          </Text>
          <Text variant="labelSmall" style={styles.date}>
            {article.author ? `${article.author} • ` : ''}
            {new Date(article.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  categoryContainer: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
    marginBottom: spacing.xs,
  },
  category: {
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  date: {
    color: COLORS.textSecondary,
  },
});
