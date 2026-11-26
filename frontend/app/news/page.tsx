import { Metadata } from 'next';
import NewsPageClient from './NewsPageClient';
import { DEFAULT_OG_IMAGE } from '@/app/lib/seoHelpers';
import { fetchArticlesServer } from '@/app/lib/serverArticles';
import { StructuredData } from '@/app/components/seo/StructuredData';
import { articleHref } from '@/app/lib/articleUrl';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.esportnews.fr';

const baseMetadata: Metadata = {
  title: 'Actualités | Esport News - Dernières Actu Esport',
  description: 'Découvrez les dernières actualités esport. Toutes les infos, analyses et brèves des meilleures équipes et compétitions.',
  keywords: 'actualités esport, news esport, brèves esport',
  openGraph: {
    title: 'Actualités | Esport News',
    description: 'Découvrez les dernières actualités esport.',
    url: `${SITE_URL}/news`,
    type: 'website',
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Actualités Esport | Esport News',
    description: 'Les dernières actualités de l\'esport.',
    images: [DEFAULT_OG_IMAGE.url],
  },
  alternates: {
    canonical: `${SITE_URL}/news`,
  },
};

type SearchParams = Promise<{ page?: string }>;

const ARTICLES_PER_PAGE = 9;
const NEWS_CATEGORY = 'Actus';

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '1', 10);
  return Number.isFinite(n) && n >= 1 && n <= 500 ? n : 1;
}

// Chaque page de la liste a sa propre URL canonique : /news?page=2 n'est pas un doublon de /news.
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const page = parsePage((await searchParams).page);
  if (page === 1) return baseMetadata;
  return {
    ...baseMetadata,
    title: `Actualités esport - Page ${page} | Esport News`,
    alternates: { canonical: `${SITE_URL}/news?page=${page}` },
  };
}

export default async function NewsPage({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePage((await searchParams).page);

  // La une = article le plus récent ; la grille démarre juste après (comme côté navigateur).
  const [featured, grid] = await Promise.all([
    fetchArticlesServer({ limit: 1, category: NEWS_CATEGORY }),
    fetchArticlesServer({
      limit: ARTICLES_PER_PAGE,
      offset: 1 + (page - 1) * ARTICLES_PER_PAGE,
      category: NEWS_CATEGORY,
    }),
  ]);

  const initialData =
    featured && grid
      ? { featured: featured.articles[0] ?? null, articles: grid.articles, total: grid.total, page }
      : undefined;

  const listed = [...(page === 1 && initialData?.featured ? [initialData.featured] : []), ...(grid?.articles ?? [])];

  return (
    <>
      {listed.length > 0 && (
        <StructuredData
          data={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Actualités esport',
            url: page === 1 ? `${SITE_URL}/news` : `${SITE_URL}/news?page=${page}`,
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: listed.map((a, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${SITE_URL}${articleHref(a)}`,
                name: a.title,
              })),
            },
          }}
        />
      )}
      <NewsPageClient key={page} initialData={initialData} />
    </>
  );
}
