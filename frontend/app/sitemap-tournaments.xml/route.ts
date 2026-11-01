import { tournamentHref } from '../lib/gameLinks';
import { pastLastmod, uniqueTournaments } from '../lib/sitemapEntries';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function fetchTournaments(endpoint: string): Promise<any[]> {
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`[sitemap-tournaments] ${endpoint} fetch error:`, error);
    return [];
  }
}

export async function GET() {
  const [running, upcoming, finished] = await Promise.all([
    fetchTournaments('/api/tournaments/all'),
    fetchTournaments('/api/tournaments/upcoming'),
    fetchTournaments('/api/tournaments/finished'),
  ]);

  // Only the end of a tournament dates its last change: the page of a running or
  // upcoming one keeps moving, so it carries no lastmod.
  const urls = uniqueTournaments([...running, ...upcoming, ...finished])
    .map((t) => {
      const lastmod = pastLastmod(t.end_at);
      return `
  <url>
    <loc>${BASE_URL}${tournamentHref(t)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    })
    .join('');

  console.log(`[sitemap-tournaments] ${running.length} running, ${upcoming.length} upcoming, ${finished.length} finished`);

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } }
  );
}
