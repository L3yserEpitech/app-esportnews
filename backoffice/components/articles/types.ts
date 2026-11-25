import type { Tone } from '@/components/ui';

export type ArticleStatus = 'draft' | 'scheduled' | 'published';

export interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  status: ArticleStatus;
  category: string;
  game_id: number | null;
  author: string;
  author_id: number | null;
  created_at: string;
  scheduled_at: string | null;
  updated_at: string;
  views: number;
  notified_at: string | null;
  notify_on_publish: boolean;
  can_edit: boolean;
}

export interface ArticleList {
  articles: ArticleRow[];
  total: number;
  counts: { all: number; published: number; scheduled: number; draft: number };
}

export interface ArticleMeta {
  categories: string[];
  authors: { id: number; name: string }[];
  bylines: string[];
  games: { id: number; name: string; acronym: string }[];
  notify_default: boolean;
}

export interface ArticlePush {
  status: 'sent' | 'none';
  sent_at: string | null;
  sent: number | null;
  delivered: number | null;
  failed: number | null;
}

export interface ArticleDetail {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  seo_title: string;
  description: string;
  article_content: string;
  category: string;
  tags: string[];
  featuredImage: string;
  videoUrl: string;
  videoType: string;
  credit: string;
  game_id: number | null;
  author: string;
  author_id: number | null;
  status: ArticleStatus;
  scheduled_at: string | null;
  notify_on_publish: boolean;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
  views: number;
  push: ArticlePush;
  can_edit: boolean;
  public_path: string;
  public_url?: string;
}

export interface ArticleVersion {
  id: number;
  created_at: string;
  actor_id: number | null;
  actor_name: string;
  label: string;
}

// Search Console figures come from the analytics module; both answers may be
// missing or say `configured: false`.
export interface GscFigures {
  clicks: number;
  impressions: number;
  position: number;
}

export interface GscArticles {
  configured: boolean;
  clicks?: Record<string, GscFigures>;
}

export interface GscArticle extends Partial<GscFigures> {
  configured: boolean;
  queries?: { query: string; clicks: number }[];
}

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: 'Brouillon',
  scheduled: 'Programmé',
  published: 'Publié',
};

export const STATUS_TONE: Record<ArticleStatus, Tone> = {
  draft: 'gris',
  scheduled: 'bleu',
  published: 'vert',
};
