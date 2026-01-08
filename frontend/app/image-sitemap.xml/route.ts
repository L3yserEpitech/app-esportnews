import { articleService } from '@/app/services/articleService';

export const revalidate = 3600; // Revalidate every hour

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const baseUrlApi = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  let images: Array<{
    loc: string;
    image: string;
    title: string;
    caption?: string;
  }> = [];

  try {
    // Fetch articles with images
    const articlesResponse = await fetch(`${baseUrlApi}/api/articles`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 3600 },
    });

    if (articlesResponse.ok) {
      const articles = await articlesResponse.json();

      images = articles
        .filter((article: any) => article.featuredImage)
        .map((article: any) => ({
          loc: `${baseUrl}/article/${article.slug}`,
          image: article.featuredImage,
          title: article.title,
          caption: article.description || article.subtitle,
        }));
    }
  } catch (error) {
    console.error('Error fetching images for sitemap:', error);
  }

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${images
  .map(
    (item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <image:image>
      <image:loc>${escapeXml(item.image)}</image:loc>
      <image:title>${escapeXml(item.title)}</image:title>
      ${item.caption ? `<image:caption>${escapeXml(item.caption)}</image:caption>` : ''}
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
