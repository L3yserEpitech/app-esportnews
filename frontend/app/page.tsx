import HomePageClient from './HomePageClient';
import {
  WebSiteSchema,
  OrganizationSchema,
} from './components/seo/StructuredData';
import { DEFAULT_OG_IMAGE } from './lib/seoHelpers';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

export const metadata = {
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    url: SITE_URL,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function HomePage() {
  return (
    <>
      <WebSiteSchema url={SITE_URL} />
      <OrganizationSchema />
      <HomePageClient />
    </>
  );
}
