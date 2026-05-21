export const revalidate = 1800;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

async function fetchMatches(endpoint: string): Promise<any[]> {
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const [running, upcoming, past] = await Promise.all([
    fetchMatches('/api/matches/running'),
    fetchMatches('/api/matches/upcoming'),
    fetchMatches('/api/matches/past'),
  ]);

  const seen = new Set<string>();
  const allMatches: any[] = [];

  for (const match of [...running, ...upcoming, ...past]) {
    if (match.id && !seen.has(String(match.id))) {
      seen.add(String(match.id));
      allMatches.push(match);
    }
  }

  const urls = allMatches
    .map(
      (m) => `
  <url>
    <loc>${BASE_URL}/match/${m.id}</loc>
    <lastmod>${new Date(m.end_at || m.begin_at || Date.now()).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join('');

  console.log(`[sitemap-matches] ${allMatches.length} matches (${running.length} live, ${upcoming.length} upcoming, ${past.length} past)`);

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=1800' } }
  );
}
