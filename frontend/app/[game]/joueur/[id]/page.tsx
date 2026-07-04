import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApiBaseUrl } from '../../../lib/apiConfig';
import { slugToWiki } from '../../../lib/gameRegistry';
import { decodeRouteParam } from '../../../lib/gameLinks';
import PlayerDetailPageClient from '../../../joueur/_components/PlayerDetailPageClient';

interface PlayerPageProps {
  params: Promise<{ game: string; id: string }>;
}

async function fetchPlayer(game: string, id: string): Promise<Response | undefined> {
  const wiki = slugToWiki(game);
  if (!wiki) return undefined;
  try {
    return await fetch(
      `${getApiBaseUrl()}/api/players/${encodeURIComponent(id)}?wiki=${encodeURIComponent(wiki)}`,
      { next: { revalidate: 1800 } }
    );
  } catch {
    return undefined;
  }
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);

  const fallback = { title: 'Joueur | EsportNews', description: 'Profils des joueurs esport sur EsportNews' };
  const response = await fetchPlayer(game, id);
  if (!response?.ok) {
    return response?.status === 404
      ? { title: 'Joueur non trouvé | EsportNews', description: 'Le joueur que vous recherchez n\'existe pas.' }
      : fallback;
  }

  try {
    const player = await response.json();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://esportnews.fr';
    const url = `${siteUrl}/${game}/joueur/${encodeURIComponent(id)}`;
    const realName = [player.first_name, player.last_name].filter(Boolean).join(' ') || player.name;
    const description = `Profil de ${player.id} (${realName}) : équipe, carrière, gains, matchs et statistiques.`;

    return {
      title: `${player.id} | Joueur Esport | EsportNews`,
      description,
      keywords: `${player.id}, ${realName}, joueur esport, esports, carrière, gains`,
      openGraph: { title: player.id, description, type: 'profile', url },
      twitter: { card: 'summary', title: player.id, description },
      alternates: { canonical: url },
    };
  } catch {
    return fallback;
  }
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { game, id: rawId } = await params;
  const id = decodeRouteParam(rawId);
  // [game] validity is enforced by app/[game]/layout.tsx.
  const wiki = slugToWiki(game);
  if (!wiki) {
    notFound();
  }

  const response = await fetchPlayer(game, id);

  // 404 only on an explicit backend 404 — transient errors (503) let the
  // client retry so a valid player isn't de-indexed.
  if (response?.status === 404) {
    notFound();
  }

  let initialPlayer = null;
  if (response?.ok) {
    try {
      initialPlayer = await response.json();
    } catch {
      // Malformed body — client handles the error state.
    }
  }

  return <PlayerDetailPageClient pagename={id} wiki={wiki} initialPlayer={initialPlayer} />;
}
