import { articleService } from '@/app/services/articleService';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

export async function GET() {
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

  const urls = allArticles
    .map(
      (a) => `
  <url>
    <loc>${BASE_URL}/article/${escapeXml(a.slug)}</loc>
    <lastmod>${new Date(a.created_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } }
  );
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
