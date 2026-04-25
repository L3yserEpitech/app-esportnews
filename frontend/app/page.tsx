import HomePageClient from './HomePageClient';
import {
  WebSiteSchema,
  OrganizationSchema,
} from './components/seo/StructuredData';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

export const metadata = {
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    url: SITE_URL,
  },
};

export default function HomePage() {
  return (
    <>
      <WebSiteSchema url={SITE_URL} />
      <OrganizationSchema url={SITE_URL} />
      <HomePageClient />
    </>
  );
}
