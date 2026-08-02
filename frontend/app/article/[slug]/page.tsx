import { notFound, permanentRedirect } from 'next/navigation';
import { formatDateSlug } from '@/app/lib/articleUrl';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

// Legacy URL shape `/article/<slug>` (already indexed by Google). We now serve
// articles under `/article/<slug>/<DD-MM-YYYY>`, so this route 301-redirects to
// the dated canonical, preserving the SEO equity of the old links.
export default async function ArticleSlugRedirect(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const res = await fetch(`${BACKEND_URL}/api/articles/${slug}`, {
    next: { revalidate: 300 },
  });

  // Only a genuine 404 from the backend yields a 404 here. Transient errors
  // (5xx, network) throw and surface as a 5xx so Google retries instead of
  // de-indexing a valid article.
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Failed to resolve article '${slug}': ${res.status}`);

  const data = await res.json();
  // Redirect straight to the dated path. We never fall back to the bare slug
  // here — that would target this very route and loop — so an unparseable date
  // 404s instead.
  const dateSlug = formatDateSlug(data?.created_at);
  if (!dateSlug) notFound();

  permanentRedirect(`/article/${slug}/${dateSlug}`);
}
