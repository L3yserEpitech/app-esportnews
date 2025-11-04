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
      url: `${baseUrl}/live`,
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
    {
      url: `${baseUrl}/calendrier`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
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
  try {
    // Récupérer les articles directement pour le sitemap avec cache
    const baseUrl_api = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl_api}/api/articles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 }, // Cache pendant 1 heure
    });

    if (response.ok) {
      const articles = await response.json();
      articlePages = articles.map((article: any) => ({
        url: `${baseUrl}/article/${article.slug}`,
        lastModified: article.created_at,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch (error) {
    console.error('Error fetching articles for sitemap:', error);
  }

  // Combiner toutes les pages
  const allPages = [...staticPages, ...legalPages, ...articlePages];

  return allPages;
}
