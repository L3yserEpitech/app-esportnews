import { MetadataRoute } from 'next';
import { AUTHORS, authorHref } from './lib/authors';

export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

// No lastModified: stamping every static page with the build date tells Google
// nothing and makes it trust lastmod less on the rest of the site.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/match`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/articles`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/news`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/tournois`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/auteurs`, changeFrequency: 'weekly', priority: 0.4 },
    ...AUTHORS.map((author) => ({
      url: `${BASE_URL}${authorHref(author)}`,
     
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    { url: `${BASE_URL}/legal/mentions-legales`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/cookies`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/cgu`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/cgv`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/politique-confidentialite`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
