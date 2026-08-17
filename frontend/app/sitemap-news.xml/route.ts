import { articleService } from '@/app/services/articleService';
import { articleHref } from '@/app/lib/articleUrl';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

// Google News Publisher Center: <news:name> must EXACTLY match the publication
// name displayed on news.google.com (omitting anything in parentheses).
// Article bodies are French, so the whole feed is declared as `fr`.
const PUBLICATION_NAME = 'EsportNews';
const PUBLICATION_LANGUAGE = 'fr';

const NEWS_CATEGORY = 'Actus';
const WINDOW_MS = 48 * 60 * 60 * 1000; // Google News only accepts articles < 2 days old
const MAX_URLS = 1000; // Google News sitemap hard cap

type NewsEntry = { slug: string; title: string; created_at: string };

export async function GET() {
  const cutoff = Date.now() - WINDOW_MS;
  const recent: NewsEntry[] = [];
  const pageSize = 100;
  let offset = 0;
  let keepGoing = true;
  let newestDate: string | null = null;

  // Backend returns newest-first, so once we cross the 48h boundary every
  // remaining article is older too — we can stop paging.
  while (keepGoing && recent.length < MAX_URLS) {
    let batch;
    try {
      batch = await articleService.getAllArticles({ category: NEWS_CATEGORY, limit: pageSize, offset });
    } catch {
      break;
    }
    if (!batch.length) break;

    for (const a of batch) {
      const ts = new Date(a.created_at).getTime();
      if (Number.isNaN(ts)) continue;
      if (!newestDate) newestDate = a.created_at;
      if (ts < cutoff) {
        keepGoing = false;
        break;
      }
      recent.push({ slug: a.slug, title: a.title, created_at: a.created_at });
      if (recent.length >= MAX_URLS) {
        keepGoing = false;
        break;
      }
    }

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  const urls = recent.length ? recent.map(newsUrl).join('') : indexUrl(newestDate);

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}\n</urlset>`,
    {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        // Short CDN cache so freshly published news propagates fast while
        // shielding the backend from every crawler hit.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    }
  );
}

function newsUrl(a: NewsEntry): string {
  return `
  <url>
    <loc>${escapeXml(`${BASE_URL}${articleHref(a)}`)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>
        <news:language>${PUBLICATION_LANGUAGE}</news:language>
      </news:publication>
      <news:publication_date>${new Date(a.created_at).toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`;
}

// A `<urlset>` with no `<url>` child violates the sitemaps.org schema, and
// Search Console reports it as a red "missing XML tag" error that then masks
// real sitemap problems. When nothing was published for two days we therefore
// keep exactly one entry — the news section index, without any `<news:news>`
// block. Listing stale articles here instead would advertise them as news
// while they are past the 48h window Google News accepts.
function indexUrl(newestDate: string | null): string {
  const lastmod = newestDate ? new Date(newestDate) : new Date();
  return `
  <url>
    <loc>${escapeXml(`${BASE_URL}/news`)}</loc>
    <lastmod>${(Number.isNaN(lastmod.getTime()) ? new Date() : lastmod).toISOString()}</lastmod>
  </url>`;
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
