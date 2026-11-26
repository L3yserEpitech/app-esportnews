import { getApiBaseUrl } from './apiConfig';
import { toNewsItem } from '../services/articleService';
import type { NewsItem, SupabaseArticle } from '../types';

// Lecture des listes d'articles côté serveur (pages /news, accueil) : le HTML
// envoyé aux robots contient déjà les articles. Résultat mis en cache 5 min.
const REVALIDATE_SECONDS = 300;

interface ServerArticlesOptions {
  limit: number;
  offset?: number;
  category?: string;
  excludeNews?: boolean;
}

export async function fetchArticlesServer(
  options: ServerArticlesOptions,
): Promise<{ articles: NewsItem[]; total: number } | null> {
  const params = new URLSearchParams({ limit: String(options.limit) });
  if (options.offset) params.set('offset', String(options.offset));
  if (options.category) params.set('category', options.category);
  if (options.excludeNews) params.set('excludeNews', 'true');

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/articles?${params}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const data: SupabaseArticle[] = await res.json();
    if (!Array.isArray(data)) return null;
    return {
      articles: data.map(toNewsItem),
      total: Number(res.headers.get('X-Total-Count')) || 0,
    };
  } catch {
    // Backend indisponible : la page se rabat sur le chargement côté navigateur.
    return null;
  }
}
