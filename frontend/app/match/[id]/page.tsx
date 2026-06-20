import { notFound, permanentRedirect } from 'next/navigation';
import { getApiBaseUrl } from '../../lib/apiConfig';
import { wikiToSlug, isValidSlug } from '../../lib/gameRegistry';

interface LegacyMatchProps {
  params: Promise<{ id: string }>;
}

// Legacy resolver for old single-segment /match/<id> URLs (pre game-first
// routing, possibly still indexed). Resolves the match's wiki and 308-redirects
// to the canonical /[game]/match/<id>. A bare valid game slug goes to the list.
export default async function LegacyMatchRedirect({ params }: LegacyMatchProps) {
  const { id } = await params;

  if (isValidSlug(id)) {
    permanentRedirect('/match');
  }

  let response: Response | undefined;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/matches/${encodeURIComponent(id)}`, {
      next: { revalidate: 60 },
    });
  } catch {
    notFound();
  }

  if (!response || response.status === 404 || !response.ok) {
    notFound();
  }

  let match: { wiki?: string; match2id?: string; id?: number | string } | null = null;
  try {
    match = await response.json();
  } catch {
    notFound();
  }

  const slug = match?.wiki ? wikiToSlug(match.wiki) : undefined;
  if (!slug) {
    notFound();
  }

  const canonicalId = match?.match2id || id;
  permanentRedirect(`/${slug}/match/${canonicalId}`);
}
