import { articleService } from '@/app/services/articleService';
import { formatDateSlug } from '@/app/lib/articleUrl';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

  const images: Array<{ loc: string; image: string }> = [];

  try {
    const allArticles: any[] = [];
    const pageSize = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const articles = await articleService.getAllArticles({ limit: pageSize, offset });
      if (articles.length > 0) {
        allArticles.push(...articles);
        offset += pageSize;
        hasMore = articles.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    for (const article of allArticles) {
      if (article.featuredImage) {
        images.push({
          loc: `${baseUrl}/article/${article.slug}/${formatDateSlug(article.created_at)}`,
          image: article.featuredImage,
        });
      }
    }

    console.log(`[image-sitemap] ${images.length} images`);
  } catch (error) {
    console.error('Error fetching images for sitemap:', error);
  }

  // Google n'accepte plus que <image:loc> : caption, title, geo_location et
  // license ont été retirés de la spécification en mai 2022 et sont ignorés.
  // On les émettait en plus dans un ordre que le schéma refuse (title avant
  // caption), d'où un sitemap invalide pour des données inutilisées.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${images
  .map(
    (item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <image:image>
      <image:loc>${escapeXml(item.image)}</image:loc>
    </image:image>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
