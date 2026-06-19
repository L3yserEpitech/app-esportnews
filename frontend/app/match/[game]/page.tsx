import { notFound, permanentRedirect } from 'next/navigation';
import { getApiBaseUrl } from '../../lib/apiConfig';
import { wikiToSlug, isValidSlug } from '../../lib/gameRegistry';

interface LegacyMatchProps {
  params: Promise<{ game: string }>;
}

// Legacy resolver. Old indexed URLs were single-segment /match/<id>; Next.js
// requires one slug name per level, so that id arrives here in the `game` param.
// We resolve the match's wiki and 308-redirect to the canonical
// /match/<slug>/<id>. A bare valid game slug (no id) goes to the matches list.
export default async function LegacyMatchRedirect({ params }: LegacyMatchProps) {
  const { game } = await params;

  // /match/valorant (a game, no id) → matches list.
  if (isValidSlug(game)) {
    permanentRedirect('/match');
  }

  const id = game; // legacy match id
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
  permanentRedirect(`/match/${slug}/${canonicalId}`);
}
