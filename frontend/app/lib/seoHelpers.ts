import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

/**
 * Générer des métadonnées cohérentes pour les pages listing
 */
export function generateListingMetadata(
  title: string,
  description: string,
  path: string,
  keywords?: string
): Metadata {
  const url = `${siteUrl}${path}`;

  return {
    title: `${title} | EsportNews`,
    description,
    keywords: keywords || title,
    openGraph: {
      title,
      description,
      type: 'website',
      url,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

/**
 * Slugifier un string pour URL-friendly
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-');
}

/**
 * Extraire le contenu textuel d'un HTML sans balises
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Générer une description courte à partir d'un texte long
 */
export function generateDescription(
  text: string,
  maxLength: number = 155
): string {
  const clean = stripHtml(text);
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength - 3) + '...';
}
