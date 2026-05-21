export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export async function GET() {
  let urls = '';

  try {
    const res = await fetch(`${BACKEND_URL}/api/games`, { next: { revalidate: 86400 } });
    if (res.ok) {
      const games = await res.json();
      const list = Array.isArray(games) ? games.filter((g: any) => g.acronym) : [];

      urls = list
        .map(
          (g: any) => `
  <url>
    <loc>${BASE_URL}/jeux/${g.acronym}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
        )
        .join('');

      console.log(`[sitemap-jeux] ${list.length} game pages`);
    }
  } catch (error) {
    console.error('[sitemap-jeux] error:', error);
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=86400' } }
  );
}
