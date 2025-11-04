import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/auth/',
          '/profile',
          '/api/',
          '/*.json$',
          '/test-sync',
        ],
      },
      // Règles spécifiques pour Google
      {
        userAgent: 'Googlebot',
        allow: '/',
        crawlDelay: 0,
      },
      // Bloquer les mauvais bots
      {
        userAgent: ['MJ12bot', 'AhrefsBot', 'SemrushBot', 'DotBot'],
        disallow: '/',
      },
    ],
    sitemap: [`${baseUrl}/sitemap.xml`],
    host: baseUrl,
  };
}
