import { SportsEventSchema, TournamentSchema, BreadcrumbSchema, StructuredData } from './StructuredData';
import { gameByWiki } from '../../lib/gameRegistry';

// JSON-LD has to be emitted by the server page, never by the client component
// that renders the rest of the view: a crawler reads the HTML before any
// hydration runs. Match and tournament pages used to render their schema from
// inside MatchDetailPageClient / TournamentDetailPageClient, so the served HTML
// carried none at all — unlike articles, whose schema comes from a server
// component and does ship. These wrappers keep the schema on the server side.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

// Structural inputs only, so these stay decoupled from the Panda*/Live* types.
interface OpponentEntry {
  opponent?: { name?: string | null; image_url?: string | null } | null;
}

export interface MatchJsonLdInput {
  wiki?: string | null;
  opponents?: OpponentEntry[] | null;
  videogame?: { name?: string | null } | null;
  league?: { name?: string | null } | null;
  tournament?: { name?: string | null; region?: string | null } | null;
  begin_at?: string | null;
  end_at?: string | null;
}

export interface TournamentJsonLdInput {
  wiki?: string | null;
  name?: string | null;
  league?: { name?: string | null } | null;
  region?: string | null;
  prizepool?: string | null;
  begin_at?: string | null;
  end_at?: string | null;
  teams?: unknown[] | null;
}

// Absolute URLs: schema.org breadcrumb items are resolved by the crawler
// outside any page context, so a relative "/match" would be meaningless.
// The game page sits right under the home: it is the only category page of
// the site and every entity page links to it this way.
function crumbs(wiki: string | null | undefined, trail: Array<{ name: string; url: string }>) {
  const game = wiki ? gameByWiki(wiki) : undefined;
  return [
    { name: 'Accueil', url: SITE_URL },
    ...(game ? [{ name: game.name, url: `${SITE_URL}/jeux/${game.acronym}` }] : []),
    ...trail,
  ];
}

function gameName(wiki: string | null | undefined): string | undefined {
  return wiki ? gameByWiki(wiki)?.name : undefined;
}

export function MatchJsonLd({ match, url }: { match: MatchJsonLdInput; url: string }) {
  const home = match.opponents?.[0]?.opponent;
  const away = match.opponents?.[1]?.opponent;
  const name = `${home?.name || 'Match'} vs ${away?.name || 'Match'}`;

  return (
    <>
      {/* startDate is required by schema.org/SportsEvent — without it the whole
          event block would be invalid, so only the breadcrumbs are emitted. */}
      {match.begin_at && (
        <SportsEventSchema
          name={name}
          description={`${match.videogame?.name || 'Esport'} - ${match.league?.name || match.tournament?.name || ''}`}
          startDate={match.begin_at}
          endDate={match.end_at || undefined}
          url={url}
          location={match.tournament?.region || undefined}
          image={home?.image_url || undefined}
          teams={[
            ...(home?.name ? [{ name: home.name, logo: home.image_url || undefined }] : []),
            ...(away?.name ? [{ name: away.name, logo: away.image_url || undefined }] : []),
          ]}
        />
      )}
      <BreadcrumbSchema
        items={crumbs(match.wiki, [
          { name: 'Matchs', url: `${SITE_URL}/match` },
          { name, url },
        ])}
      />
    </>
  );
}

export function TournamentJsonLd({ tournament, url }: { tournament: TournamentJsonLdInput; url: string }) {
  const name = tournament.name || 'Tournoi';

  return (
    <>
      <TournamentSchema
        name={name}
        description={`Tournoi ${name} - ${tournament.league?.name || 'Esport'}`}
        startDate={tournament.begin_at || undefined}
        endDate={tournament.end_at || undefined}
        url={url}
        location={tournament.region || undefined}
        prizeMoney={tournament.prizepool || undefined}
        teams={tournament.teams?.length}
      />
      <BreadcrumbSchema
        items={crumbs(tournament.wiki, [
          { name: 'Tournois', url: `${SITE_URL}/tournois` },
          { name, url },
        ])}
      />
    </>
  );
}

// JSON.stringify drops undefined properties, so optional fields are simply
// left undefined rather than spread in conditionally.
function sameAs(links: object | null | undefined): string[] | undefined {
  const urls = Object.values(links ?? {}).filter((link): link is string => typeof link === 'string' && link !== '');
  return urls.length ? urls : undefined;
}

export interface TeamJsonLdInput {
  wiki?: string | null;
  name: string;
  acronym?: string | null;
  image_url?: string | null;
  region?: string | null;
  players?: Array<{ name: string; nationality?: string | null }> | null;
  links?: object | null;
}

export function TeamJsonLd({ team, url }: { team: TeamJsonLdInput; url: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: team.name,
    alternateName: team.acronym || undefined,
    sport: gameName(team.wiki),
    logo: team.image_url || undefined,
    image: team.image_url || undefined,
    url,
    location: team.region ? { '@type': 'Place', name: team.region } : undefined,
    athlete: team.players?.length
      ? team.players.map((player) => ({
          '@type': 'Person',
          name: player.name,
          nationality: player.nationality || undefined,
        }))
      : undefined,
    sameAs: sameAs(team.links),
  };

  return (
    <>
      <StructuredData data={schema} />
      <BreadcrumbSchema items={crumbs(team.wiki, [{ name: team.name, url }])} />
    </>
  );
}

export interface PlayerJsonLdInput {
  wiki?: string | null;
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  nationalities?: string[] | null;
  team_pagename?: string | null;
  links?: object | null;
}

export function PlayerJsonLd({ player, url }: { player: PlayerJsonLdInput; url: string }) {
  const realName = [player.first_name, player.last_name].filter(Boolean).join(' ') || player.name || undefined;
  const team = player.team_pagename?.replace(/_/g, ' ');
  const game = gameName(player.wiki);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: realName || player.id,
    alternateName: realName && realName !== player.id ? player.id : undefined,
    jobTitle: game ? `Joueur ${game}` : 'Joueur esport',
    nationality: player.nationalities?.[0] || undefined,
    memberOf: team ? { '@type': 'SportsTeam', name: team } : undefined,
    url,
    sameAs: sameAs(player.links),
  };

  return (
    <>
      <StructuredData data={schema} />
      <BreadcrumbSchema items={crumbs(player.wiki, [{ name: player.id, url }])} />
    </>
  );
}
