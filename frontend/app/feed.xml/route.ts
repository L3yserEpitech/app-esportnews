import { articleService } from '@/app/services/articleService';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
  const siteTitle = 'EsportNews - Actualités Esport & Scores en direct';
  const siteDescription = 'Actus esport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois';

  try {
    // Récupérer les 20 derniers articles
    const articles = await articleService.getAllArticles();
    const latestArticles = articles.slice(0, 20);

    // Générer le RSS feed
    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${siteTitle}</title>
    <link>${baseUrl}</link>
    <description>${siteDescription}</description>
    <language>fr</language>
    <copyright>© ${new Date().getFullYear()} EsportNews. Tous droits réservés.</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${baseUrl}/logo.png</url>
      <title>${siteTitle}</title>
      <link>${baseUrl}</link>
    </image>
    ${latestArticles
      .map(
        (article) => `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${baseUrl}/article/${article.slug}</link>
      <guid isPermaLink="true">${baseUrl}/article/${article.slug}</guid>
      <description>${escapeXml(article.description || article.subtitle || '')}</description>
      <content:encoded><![CDATA[
        <p>${escapeXml(article.description || article.subtitle || '')}</p>
        ${article.featuredImage ? `<img src="${article.featuredImage}" alt="${escapeXml(article.title)}" />` : ''}
      ]]></content:encoded>
      <author>${escapeXml(article.author || 'EsportNews')}</author>
      <category>${escapeXml(article.category || 'Actualité')}</category>
      <pubDate>${new Date(article.created_at).toUTCString()}</pubDate>
      ${article.tags?.map((tag) => `<tag>${escapeXml(tag)}</tag>`).join('\n      ') || ''}
    </item>
    `
      )
      .join('')}
  </channel>
</rss>`;

    return new Response(rssContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return new Response('Error generating RSS feed', { status: 500 });
  }
}

/**
 * Échappe les caractères spéciaux XML
 */
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
