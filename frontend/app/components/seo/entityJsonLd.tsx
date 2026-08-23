import { SportsEventSchema, TournamentSchema, BreadcrumbSchema } from './StructuredData';

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
  opponents?: OpponentEntry[] | null;
  videogame?: { name?: string | null } | null;
  league?: { name?: string | null } | null;
  tournament?: { name?: string | null; region?: string | null } | null;
  begin_at?: string | null;
  end_at?: string | null;
}

export interface TournamentJsonLdInput {
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
function crumbs(trail: Array<{ name: string; url: string }>) {
  return [{ name: 'Accueil', url: SITE_URL }, ...trail];
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
        items={crumbs([
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
        items={crumbs([
          { name: 'Tournois', url: `${SITE_URL}/tournois` },
          { name, url },
        ])}
      />
    </>
  );
}
