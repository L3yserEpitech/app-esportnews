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
      // Crawlers sans trafic utile pour un site francophone, mais qui rendent le
      // JavaScript et déclenchent donc tous les appels API d'une page (Baidu et
      // Meta = 60 % des GET backend le 2026-10-27, cf. rapport perf pages détail).
      // facebookexternalhit n'est PAS bloqué : il sert les aperçus de liens.
      {
        userAgent: ['Baiduspider', 'meta-externalagent', 'Bytespider', 'PetalBot', 'Amazonbot', 'GPTBot', 'CCBot'],
        disallow: '/',
      },
    ],
    sitemap: [
      // L'index en tête : il porte les <lastmod> qui disent au robot
      // quand un sitemap a réellement changé.
      `${baseUrl}/sitemap-index.xml`,
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap-news.xml`,
      `${baseUrl}/sitemap-articles.xml`,
      `${baseUrl}/sitemap-tournaments.xml`,
      `${baseUrl}/sitemap-matches.xml`,
      `${baseUrl}/sitemap-jeux.xml`,
      `${baseUrl}/image-sitemap.xml`,
      `${baseUrl}/feed.xml`,
    ],
  };
}
