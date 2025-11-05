import { ReactNode } from 'react';

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
export function ArticleSchema({
  title,
  description,
  content,
  image,
  datePublished,
  dateModified,
  author,
  url,
}: {
  title: string;
  description: string;
  content: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  url: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description,
    image: image ? [image] : [],
    datePublished,
    dateModified: dateModified || datePublished,
    author: {
      '@type': 'Person',
      name: author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'EsportNews',
      logo: {
        '@type': 'ImageObject',
        url: 'https://esportnews.fr/logo.png',
        width: 250,
        height: 60,
      },
    },
    url,
    articleBody: content?.replace(/<[^>]*>/g, '') || '',
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
    organizer: {
      '@type': 'Organization',
      name: 'EsportNews',
    },
    ...(prizeMoney && { offers: { '@type': 'Offer', price: prizeMoney } }),
    ...(teams && { numberOfParticipants: teams }),
  };

  return <StructuredData data={schema} />;
}

/**
 * Schéma pour une Organisation
 */
export function OrganizationSchema({
  url = 'https://esportnews.fr',
  logo = 'https://esportnews.fr/logo.png',
  name = 'EsportNews',
  description = 'Plateforme e-sport mettant en avant les matchs en direct et actualités',
  sameAs = [],
}: {
  url?: string;
  logo?: string;
  name?: string;
  description?: string;
  sameAs?: string[];
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    url,
    name,
    logo,
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
  url = 'https://esportnews.fr',
  name = 'EsportNews',
  searchUrl = 'https://esportnews.fr/search?q={search_term_string}',
}: {
  url?: string;
  name?: string;
  searchUrl?: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url,
    name,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: searchUrl,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return <StructuredData data={schema} />;
}
