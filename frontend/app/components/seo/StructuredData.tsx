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
        __html: JSON.stringify(data),
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

/**
 * Schéma pour un SportsEvent (match)
 */
export function SportsEventSchema({
  name,
  description,
  startDate,
  endDate,
  location,
  image,
  url,
  teams,
}: {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  image?: string;
  url: string;
  teams?: Array<{ name: string; logo?: string }>;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name,
    description,
    startDate,
    endDate: endDate || startDate,
    image: image ? [image] : [],
    url,
    location: location ? { '@type': 'Place', name: location } : undefined,
    performer: teams?.map((team) => ({
      '@type': 'SportsTeam',
      name: team.name,
      image: team.logo,
    })),
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
  url,
  location,
  prizeMoney,
  teams,
}: {
  name: string;
  description?: string;
  image?: string;
  startDate?: string;
  endDate?: string;
  url: string;
  location?: string;
  prizeMoney?: string;
  teams?: number;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    description,
    image: image ? [image] : [],
    startDate,
    endDate,
    url,
    location: location ? { '@type': 'Place', name: location } : undefined,
    ...(prizeMoney && { offers: { '@type': 'Offer', price: prizeMoney } }),
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
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url,
    name,
    inLanguage: 'fr',
    publisher: { '@id': PUBLISHER['@id'] },
  };

  return <StructuredData data={schema} />;
}
