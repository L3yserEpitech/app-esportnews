import HomePageClient from './HomePageClient';
import {
  WebSiteSchema,
  OrganizationSchema,
} from './components/seo/StructuredData';
import { DEFAULT_OG_IMAGE } from './lib/seoHelpers';
import { SITE_NAME } from './lib/seoTitles';
import { fetchArticlesServer } from './lib/serverArticles';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

export const metadata = {
  alternates: {
    canonical: SITE_URL,
  },
  // Next replaces the layout's openGraph object wholesale, so the fields the
  // layout sets must be repeated here. Google reads og:site_name on the home
  // page to pick the site name shown in results.
  openGraph: {
    url: SITE_URL,
    siteName: SITE_NAME,
    type: 'website',
    locale: 'fr_FR',
    images: [DEFAULT_OG_IMAGE],
  },
};

export default async function HomePage() {
  // 7 derniers articles : 1 à la une + 6 dans la grille (comme côté navigateur).
  const latest = await fetchArticlesServer({ limit: 7 });
  return (
    <>
      <WebSiteSchema url={SITE_URL} />
      <OrganizationSchema />
      <HomePageClient initialArticles={latest?.articles} />
    </>
  );
}
