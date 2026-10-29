import { Metadata } from 'next';
import { brandTitle } from './seoTitles';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';
const siteUrl = SITE_URL;

// Every page that declares its own `openGraph` replaces the layout's object
// wholesale, so the default image has to be repeated explicitly rather than
// inherited. Generated from the logo: public/og-default.png, 1200×630.
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/og-default.png`,
  width: 1200,
  height: 630,
  alt: 'Esport News',
};

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
    title: brandTitle(title),
    description,
    keywords: keywords || title,
    openGraph: {
      title,
      description,
      type: 'website',
      url,
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_OG_IMAGE.url],
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
