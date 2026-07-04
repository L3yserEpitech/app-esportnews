import { wikiToSlug } from '../lib/gameRegistry';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// Game-first URL when the wiki is resolvable, legacy /tournois/<id> otherwise.
const tournamentLoc = (t: any) => {
  const slug = t.wiki ? wikiToSlug(t.wiki) : undefined;
  return slug ? `${BASE_URL}/${slug}/tournois/${t.id}` : `${BASE_URL}/tournois/${t.id}`;
};

export async function GET() {
  let urls = '';

  try {
    const res = await fetch(`${BACKEND_URL}/api/tournaments/all`, {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const tournaments = await res.json();
      const list = Array.isArray(tournaments) ? tournaments : [];

      urls = list
        .map(
          (t: any) => `
  <url>
    <loc>${tournamentLoc(t)}</loc>
    <lastmod>${new Date(t.modified_at || t.begin_at || Date.now()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`
        )
        .join('');
    }
  } catch (error) {
    console.error('[sitemap-tournaments] fetch error:', error);
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=3600' } }
  );
}
