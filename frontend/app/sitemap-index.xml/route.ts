import { articleService } from '@/app/services/articleService';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

const NEWS_CATEGORY = 'Actus';

// robots.txt lists each sitemap but carries no freshness signal, so a crawler
// refetches them on its own schedule. Publication here is irregular — measured
// over 79 days, no article was younger than 48 h for 40 % of the time, once for
// 19 days straight — so a crawl landing mid-gap reads an empty news sitemap and
// records it as such until the next visit. This index exposes <lastmod> so the
// news and article sitemaps get refetched when something is actually published.
export async function GET() {
  let newsLastmod: string | null = null;
  let articlesLastmod: string | null = null;

  try {
    const [latestNews] = await articleService.getAllArticles({ category: NEWS_CATEGORY, limit: 1 });
    if (latestNews?.created_at) newsLastmod = new Date(latestNews.created_at).toISOString();
  } catch {
    // Freshness is a hint, not a requirement: omit it rather than fail the index.
  }

  try {
    const [latestArticle] = await articleService.getAllArticles({ limit: 1 });
    if (latestArticle?.created_at) articlesLastmod = new Date(latestArticle.created_at).toISOString();
  } catch {
    // idem
  }

  // Match and tournament sitemaps change constantly; advertising a lastmod that
  // moves on every request would be noise, so they are listed without one.
  const children: Array<{ path: string; lastmod?: string | null }> = [
    { path: 'sitemap-news.xml', lastmod: newsLastmod },
    { path: 'sitemap-articles.xml', lastmod: articlesLastmod },
    { path: 'sitemap.xml' },
    { path: 'sitemap-jeux.xml' },
    { path: 'sitemap-matches.xml' },
    { path: 'sitemap-tournaments.xml' },
    { path: 'image-sitemap.xml' },
  ];

  const body = children
    .map(
      (c) => `
  <sitemap>
    <loc>${BASE_URL}/${c.path}</loc>${c.lastmod ? `
    <lastmod>${c.lastmod}</lastmod>` : ''}
  </sitemap>`,
    )
    .join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}\n</sitemapindex>`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
