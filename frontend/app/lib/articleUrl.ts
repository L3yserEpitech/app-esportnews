// Public URL helpers for articles/news.
//
// URLs follow the Le Monde / Le Figaro convention: the slug is suffixed with
// the publication date (`/article/<slug>/<DD-MM-YYYY>`). The slug stored in
// the database is unchanged — the date segment is derived from `created_at`
// and serves as a human-readable disambiguator.
//
// The date is computed in UTC so the URL is byte-identical whether it is built
// on the server or the client (no hydration drift, and it matches the UTC
// timestamps stored by the backend).

export function formatDateSlug(createdAt: string | null | undefined): string {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export function articleHref(article: { slug: string; created_at?: string | null }): string {
  const date = formatDateSlug(article.created_at);
  // Fall back to the bare slug when the date is unknown; that URL 301-redirects
  // to the dated canonical anyway.
  return date ? `/article/${article.slug}/${date}` : `/article/${article.slug}`;
}
