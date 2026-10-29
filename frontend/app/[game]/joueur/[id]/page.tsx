import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getApiBaseUrl } from '../../../lib/apiConfig';
import { gameByWiki, slugToWiki } from '../../../lib/gameRegistry';
import { decodeRouteParam } from '../../../lib/gameLinks';
import { DEFAULT_OG_IMAGE } from '../../../lib/seoHelpers';
import { brandTitle } from '../../../lib/seoTitles';
import { PlayerJsonLd } from '../../../components/seo/entityJsonLd';
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

  const fallback = { title: 'Joueur | Esport News', description: 'Profils des joueurs esport sur Esport News' };
  const response = await fetchPlayer(game, id);
  if (!response?.ok) {
    return response?.status === 404
      ? { title: 'Joueur non trouvé | Esport News', description: 'Le joueur que vous recherchez n\'existe pas.' }
      : fallback;
  }

  try {
    const player = await response.json();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
    const url = `${siteUrl}/${game}/joueur/${encodeURIComponent(id)}`;
    const realName = [player.first_name, player.last_name].filter(Boolean).join(' ') || player.name;
    const gameName = gameByWiki(slugToWiki(game) || '')?.name;
    const team = player.team_pagename?.replace(/_/g, ' ');
    const title = `${player.id} – Joueur ${gameName || 'esport'}`;
    const description = `Profil de ${player.id}${realName && realName !== player.id ? ` (${realName})` : ''}, joueur ${gameName || 'esport'}${team ? ` chez ${team}` : ''} : équipe, carrière, gains, matchs et statistiques.`;

    return {
      title: brandTitle(title),
      description,
      keywords: `${player.id}, ${realName}, joueur esport, esports, carrière, gains`,
      openGraph: { title, description, type: 'profile', url, images: [DEFAULT_OG_IMAGE] },
      twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_OG_IMAGE.url] },
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

  return (
    <>
      {initialPlayer && (
        <PlayerJsonLd player={{ ...initialPlayer, wiki }} url={`${siteUrl}/${game}/joueur/${encodeURIComponent(id)}`} />
      )}
      <PlayerDetailPageClient pagename={id} wiki={wiki} initialPlayer={initialPlayer} />
    </>
  );
}
