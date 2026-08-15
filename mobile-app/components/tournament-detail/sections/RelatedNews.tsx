// Related articles for a tournament. The web shell pre-fetches these; on mobile
// the section fetches locally (same criterion as web: article tags matching the
// tournament or league name), then renders up to 3. Self-hides when none match.
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { articleService } from '@/services/articleService';
import { ArticleCard } from '@/components/features/ArticleCard';
import type { NewsItem } from '@/types';
import { spacing } from '@/constants/theme';
import { SectionHeader, type TournamentSectionProps } from './shared';

export default function RelatedNews({ tournament }: TournamentSectionProps) {
  const router = useRouter();
  const [articles, setArticles] = useState<NewsItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tags = [tournament.name, tournament.league?.name].filter(Boolean) as string[];
      if (tags.length === 0) return;
      const all = await articleService.getAllArticles();
      const related = all
        .filter(a => (a.tags || []).some(aTag =>
          tags.some(tag => aTag?.toLowerCase().includes(tag.toLowerCase()))))
        .slice(0, 3);
      if (!cancelled) setArticles(related);
    })();
    return () => { cancelled = true; };
  }, [tournament.name, tournament.league?.name]);

  if (articles.length === 0) return null;

  return (
    <View>
      <SectionHeader icon="newspaper-variant-outline" title="Actualités liées" />
      <View style={styles.list}>
        {articles.map(article => (
          <ArticleCard
            key={article.id}
            article={article}
            fullWidth
            onPress={() => router.push(`/article/${article.slug}`)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
});
