import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { decodeRouteParam, tournamentHref } from '../../lib/gameLinks';
import { failForCrawlers } from '../../lib/crawlerFailure';
import { SITE_URL, unavailablePageMetadata } from '../../lib/seoHelpers';
import TournamentDetailPageClient from '../_components/TournamentDetailPageClient';

// Legacy /tournois/<id>. The canonical lives at /<game>/tournois/<id>, so a
// tournament that resolves is sent there with a 308 instead of being served a
// second time under this URL. Only a transient backend error (5xx, network)
// still renders here, leaving the client to retry; a backend 404 is a real 404.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: rawId } = await params;
  return unavailablePageMetadata(
    'Tournoi | Esport News',
    'Consultez les tournois esport sur Esport News',
    `${SITE_URL}/tournois/${encodeURIComponent(decodeRouteParam(rawId))}`,
  );
}

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  const baseUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  let response: Response | undefined;
  try {
    response = await fetch(`${baseUrl}/api/tournaments/${encodeURIComponent(id)}`, { next: { revalidate: 3600 } });
  } catch {
    // Network/transient error — leave it to the client component.
  }

  if (response?.status === 404) {
    notFound();
  }

  const tournament = response?.ok ? await response.json().catch(() => null) : null;
  if (tournament?.wiki) {
    permanentRedirect(tournamentHref(tournament));
  }
  if (!tournament) {
    await failForCrawlers();
  }

  return <TournamentDetailPageClient tournamentId={id} />;
}
