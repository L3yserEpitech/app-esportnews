import { SITE_URL } from '@/app/lib/seoHelpers';


interface StructuredDataProps {
  data: Record<string, any>;
}

/**
 * Composant pour injecter du JSON-LD structuré dans le document
 * Utilisé pour les rich snippets et les featured snippets
 */
export function StructuredData({ data }: StructuredDataProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        // Names come from Liquipedia, a wiki anyone edits: `</script>` in one would
        // end this tag. \\u003c reads back as `<` for a JSON-LD parser.
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

/**
 * Schéma pour un article (NewsArticle ou Article)
 */
const SITE_NAME = 'Esport News';

// Shared publisher node: a news site is a NewsMediaOrganization, not a bare
// Organization. Logo dimensions are the real ones of public/logo_blanc.png.
export const PUBLISHER = {
  '@type': 'NewsMediaOrganization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  url: SITE_URL,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/logo_blanc.png`,
    width: 527,
    height: 190,
  },
};

export function ArticleSchema({
  title,
  description,
  image,
  datePublished,
  dateModified,
  author,
  authorUrl,
  section,
  keywords,
  url,
}: {
  title: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  authorUrl?: string;
  section?: string;
  keywords?: string[];
  url: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description,
    image: image
      ? [
          {
            '@type': 'ImageObject',
            url: image,
            width: 1200,
            height: 630,
          },
        ]
      : [],
    datePublished,
    dateModified: dateModified || datePublished,
    inLanguage: 'fr',
    isAccessibleForFree: true,
    ...(section && { articleSection: section }),
    ...(keywords?.length && { keywords: keywords.join(', ') }),
    author: {
      '@type': 'Person',
      name: author,
      ...(authorUrl && { url: authorUrl }),
    },
    publisher: PUBLISHER,
    url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  return <StructuredData data={schema} />;
}

/**
 * Schéma pour une page auteur (ProfilePage + Person)
 */
export function AuthorSchema({
  name,
  url,
}: {
  name: string;
  url: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    mainEntity: {
      '@type': 'Person',
      '@id': `${url}#person`,
      name,
      url,
      worksFor: PUBLISHER,
    },
  };

  return <StructuredData data={schema} />;
}

export type EventStatus = 'EventScheduled' | 'EventCancelled' | 'EventPostponed' | 'EventRescheduled';

// Google refuses an Event without a location (1 466 items on 2026-11-11), and
// Liquipedia gives us no venue. What we do know is where the event is followed:
// the page itself, which carries the stream and the scores. `onSite` marks an
// event also held in a venue we cannot name.
export function eventPlace(url: string, onSite = false) {
  return {
    eventAttendanceMode: `https://schema.org/${onSite ? 'Mixed' : 'Online'}EventAttendanceMode`,
    location: { '@type': 'VirtualLocation', url },
  };
}

/**
 * Schéma pour un SportsEvent (match)
 */
export function SportsEventSchema({
  name,
  description,
  startDate,
  endDate,
  previousStartDate,
  status = 'EventScheduled',
  image,
  url,
  tournament,
  teams,
}: {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  previousStartDate?: string;
  status?: EventStatus;
  image?: string;
  url: string;
  tournament?: string;
  teams?: Array<{ name: string; logo?: string }>;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name,
    description,
    startDate,
    endDate,
    previousStartDate,
    eventStatus: `https://schema.org/${status}`,
    ...eventPlace(url),
    image: image ? [image] : undefined,
    url,
    superEvent: tournament ? { '@type': 'SportsEvent', name: tournament } : undefined,
    performer: teams?.length
      ? teams.map((team) => ({ '@type': 'SportsTeam', name: team.name, image: team.logo }))
      : undefined,
  };

  return <StructuredData data={schema} />;
}

/**
 * Schéma pour un Tournament
 */
export function TournamentSchema({
  name,
  description,
  image,
  startDate,
  endDate,
  status = 'EventScheduled',
  onSite,
  url,
  teams,
}: {
  name: string;
  description?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  status?: EventStatus;
  onSite?: boolean;
  url: string;
  teams?: number;
}) {
  // No `offers`: it is a ticket price, and the prize pool we used to put there
  // was reported as an invalid price.
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    image: image ? [image] : undefined,
    startDate,
    endDate,
    eventStatus: `https://schema.org/${status}`,
    ...eventPlace(url, onSite),
    url,
    ...(teams && { numberOfParticipants: teams }),
  };

  return <StructuredData data={schema} />;
}

/**
 * Schéma pour une Organisation
 */
export function OrganizationSchema({
  description = 'Média esport : actualités, analyses, interviews et scores en direct',
  sameAs = [],
}: {
  description?: string;
  sameAs?: string[];
} = {}) {
  const schema = {
    '@context': 'https://schema.org',
    ...PUBLISHER,
    description,
    sameAs,
  };

  return <StructuredData data={schema} />;
}

/**
 * Schéma pour un BreadcrumbList
 */
export function BreadcrumbSchema({
  items,
}: {
  items: Array<{ name: string; url: string }>;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return <StructuredData data={schema} />;
}

/**
 * Schéma pour un WebSite (homepage)
 */
export function WebSiteSchema({
  url = SITE_URL,
  name = SITE_NAME,
}: {
  url?: string;
  name?: string;
} = {}) {
  // Google builds the site name from this node. The former one-word brand and
  // the bare domain go in alternateName (domain last, as Google recommends when
  // results still show the domain instead of the name); url is the home page
  // in the form Google documents, with its trailing slash.
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: url.endsWith('/') ? url : `${url}/`,
    name,
    alternateName: ['EsportNews', 'esportnews.fr'],
    inLanguage: 'fr',
    publisher: { '@id': PUBLISHER['@id'] },
  };

  return <StructuredData data={schema} />;
}
