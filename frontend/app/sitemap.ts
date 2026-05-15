import { MetadataRoute } from 'next';
import { articleService } from '@/app/services/articleService';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function generateSitemaps() {
  return [
    { id: 'static' },
    { id: 'articles' },
    { id: 'tournaments' },
  ];
}

export default async function sitemap({ id }: { id: string }): Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case 'static':
      return getStaticPages();
    case 'articles':
      return getArticlePages();
    case 'tournaments':
      return getTournamentPages();
    default:
      return [];
  }
}

function getStaticPages(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/match`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/articles`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/news`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/tournois`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/legal/mentions-legales`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/cookies`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];
}

async function getArticlePages(): Promise<MetadataRoute.Sitemap> {
  const allArticles: any[] = [];
  const pageSize = 100;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const articles = await articleService.getAllArticles({ limit: pageSize, offset });
      if (articles.length > 0) {
        allArticles.push(...articles);
        offset += pageSize;
        hasMore = articles.length === pageSize;
      } else {
        hasMore = false;
      }
    } catch {
      hasMore = false;
    }
  }

  console.log(`[Sitemap/articles] ${allArticles.length} articles`);

  return allArticles.map((article) => ({
    url: `${BASE_URL}/article/${article.slug}`,
    lastModified: article.created_at,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));
}

async function getTournamentPages(): Promise<MetadataRoute.Sitemap> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/tournaments/all`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];

    const tournaments = await res.json();
    const list = Array.isArray(tournaments) ? tournaments : [];

    console.log(`[Sitemap/tournaments] ${list.length} tournaments`);

    return list.map((t: any) => ({
      url: `${BASE_URL}/tournois/${t.id}`,
      lastModified: t.modified_at || t.begin_at,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    return [];
  }
}
