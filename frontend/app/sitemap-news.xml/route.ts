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

// A `<urlset>` with no `<url>` child violates the sitemap schema, and Search
// Console reports it as a red "missing XML tag" error — which then masks real
// sitemap problems. Whenever the 48h window is empty (no article published for
// two days), fall back to the latest articles carrying no `<news:news>` block.
// That is exactly how Google says to age an article out of a news sitemap:
// keep the URL, drop the news metadata.
const FALLBACK_URLS = 10;

type NewsEntry = { slug: string; title: string; created_at: string; isNews: boolean };

export async function GET() {
  const cutoff = Date.now() - WINDOW_MS;
  const recent: NewsEntry[] = [];
  const fallback: NewsEntry[] = [];
  const pageSize = 100;
  let offset = 0;
  let keepGoing = true;

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
      if (ts < cutoff) {
        // Newest-first: this is the head of the "too old" tail, so it is also
        // the best fallback material. Collected on the first page only.
        if (fallback.length < FALLBACK_URLS) {
          fallback.push({ slug: a.slug, title: a.title, created_at: a.created_at, isNews: false });
          continue;
        }
        keepGoing = false;
        break;
      }
      recent.push({ slug: a.slug, title: a.title, created_at: a.created_at, isNews: true });
      if (recent.length >= MAX_URLS) {
        keepGoing = false;
        break;
      }
    }

    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  const entries = recent.length ? recent : fallback;

  const urls = entries
    .map((a) => {
      const news = a.isNews
        ? `
    <news:news>
      <news:publication>
        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>
        <news:language>${PUBLICATION_LANGUAGE}</news:language>
      </news:publication>
      <news:publication_date>${new Date(a.created_at).toISOString()}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>`
        : `
    <lastmod>${new Date(a.created_at).toISOString()}</lastmod>`;

      return `
  <url>
    <loc>${escapeXml(`${BASE_URL}${articleHref(a)}`)}</loc>${news}
  </url>`;
    })
    .join('');

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

function escapeXml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
