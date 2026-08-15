'use client';

import { useTranslations } from 'next-intl';
import { Newspaper } from 'lucide-react';
import ArticleCard from '../../../components/article/ArticleCard';
import type { TournamentSectionProps } from './shared';

export default function RelatedNews({ relatedArticles }: TournamentSectionProps) {
  const t = useTranslations('pages_detail.tournament_detail');
  if (relatedArticles.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <Newspaper className="w-5 h-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('related_news')}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {relatedArticles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
