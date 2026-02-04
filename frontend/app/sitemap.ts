import { MetadataRoute } from 'next';
import { articleService } from '@/app/services/articleService';

// Configuration pour permettre la génération dynamique du sitemap
export const revalidate = 3600; // Revalider toutes les heures

// Type pour les URLs du sitemap
interface SitemapEntry {
  url: string;
  lastModified?: Date | string;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';

  // Pages statiques
  const staticPages: SitemapEntry[] = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/match`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/articles`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/tournois`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Pages légales
  const legalPages: SitemapEntry[] = [
    {
      url: `${baseUrl}/legal/mentions-legales`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/legal/cookies`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Articles dynamiques
  let articlePages: SitemapEntry[] = [];
  let tournamentPages: SitemapEntry[] = [];

  try {
    // Récupérer TOUS les articles via pagination (le backend limite à 100 par requête)
    try {
      const allArticles: any[] = [];
      const pageSize = 100; // Max autorisé par le backend
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const articles = await articleService.getAllArticles({ limit: pageSize, offset });
        if (articles.length > 0) {
          allArticles.push(...articles);
          offset += pageSize;
          // Continuer si on a reçu exactement pageSize articles (il y en a peut-être plus)
          hasMore = articles.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`[Sitemap] Total articles fetched: ${allArticles.length}`);

      articlePages = allArticles.map((article) => ({
        url: `${baseUrl}/article/${article.slug}`,
        lastModified: article.created_at,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    } catch (error) {
      console.error('Error fetching articles for sitemap:', error);
    }

    // Récupérer les tournois (tous les tournois en cours)
    try {
      const baseUrl_api = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const tournamentsResponse = await fetch(`${baseUrl_api}/api/tournaments/all`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        next: { revalidate: 3600 },
      });

      if (tournamentsResponse.ok) {
        const tournaments = await tournamentsResponse.json();
        const tournamentsArray = Array.isArray(tournaments) ? tournaments : [];
        tournamentPages = tournamentsArray.slice(0, 100).map((tournament: any) => ({
          url: `${baseUrl}/tournois/${tournament.id}`,
          lastModified: tournament.modified_at || tournament.begin_at,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }));
      }
    } catch (error) {
      console.error('Error fetching tournaments for sitemap:', error);
    }
  } catch (error) {
    console.error('Error in sitemap generation:', error);
  }

  // Combiner toutes les pages
  const allPages = [...staticPages, ...legalPages, ...articlePages, ...tournamentPages];

  return allPages;
}
