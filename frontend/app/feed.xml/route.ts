import { articleService } from '@/app/services/articleService';
import { formatDateSlug } from '@/app/lib/articleUrl';
import { authorDisplayName } from '@/app/lib/authors';
import { SITE_URL } from '@/app/lib/seoHelpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const baseUrl = SITE_URL;
  const siteTitle = 'EsportNews — Actus esport & scores en direct';
  const siteDescription = 'Actus esport et scores en direct. Résultats, classements, analyses, interviews et agenda des tournois';
  const feedUrl = `${baseUrl}/feed.xml`;

  try {
    const articles = await articleService.getAllArticles({ limit: 20 });

    // Générer le RSS feed
    const rssContent = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${baseUrl}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <description>${siteDescription}</description>
    <language>fr</language>
    <copyright>© ${new Date().getFullYear()} EsportNews. Tous droits réservés.</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${baseUrl}/logo_blanc.png</url>
      <title>${escapeXml(siteTitle)}</title>
      <link>${baseUrl}</link>
    </image>
    ${articles
      .map(
        (article) => `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${baseUrl}/article/${article.slug}/${formatDateSlug(article.created_at)}</link>
      <guid isPermaLink="true">${baseUrl}/article/${article.slug}/${formatDateSlug(article.created_at)}</guid>
      <description>${escapeXml(article.description || article.subtitle || '')}</description>
      <content:encoded><![CDATA[
        <p>${escapeXml(article.description || article.subtitle || '')}</p>
        ${article.featuredImage ? `<img src="${article.featuredImage}" alt="${escapeXml(article.title)}" />` : ''}
      ]]></content:encoded>
      <dc:creator>${escapeXml(authorDisplayName(article.author) || 'EsportNews')}</dc:creator>
      <category>${escapeXml(article.category || 'Actualité')}</category>
      <pubDate>${new Date(article.created_at).toUTCString()}</pubDate>
      ${article.tags?.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ') || ''}
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
