import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/auth/',
          '/profile',
          '/api/',
          '/*.json$',
          '/test-sync',
        ],
      },
      {
        userAgent: ['MJ12bot', 'AhrefsBot', 'SemrushBot', 'DotBot'],
        disallow: '/',
      },
    ],
    sitemap: [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/image-sitemap.xml`,
      `${baseUrl}/feed.xml`,
    ],
  };
}
