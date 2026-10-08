import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NewsItem, SupabaseArticle } from '@/app/types';
import ArticleCard from '@/app/components/article/ArticleCard';
import { AuthorSchema, BreadcrumbSchema } from '@/app/components/seo/StructuredData';
import { authorHref, authorQueryValue, findAuthorBySlug } from '@/app/lib/authors';
import { generateBreadcrumbs } from '@/app/lib/breadcrumbHelper';
import { SITE_URL } from '@/app/lib/seoHelpers';
import { toNewsItem } from '@/app/services/articleService';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
const PAGE_SIZE = 24;

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

// Own fetch rather than articleService.getAllArticles: the total comes from the
// X-Total-Count header, which the singleton service stashes in shared mutable
// state — unsafe across concurrent server renders.
async function fetchAuthorArticles(query: string, page: number): Promise<{ items: NewsItem[]; total: number }> {
  const params = new URLSearchParams({
    author: query,
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  const res = await fetch(`${BACKEND_URL}/api/articles?${params}`, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to load author articles: ${res.status}`);
  const data: SupabaseArticle[] = await res.json();
  const total = Number(res.headers.get('X-Total-Count') || data.length);
  return { items: data.map(toNewsItem), total };
}

function pageNumber(raw: string | undefined): number {
  const n = Number.parseInt(raw || '1', 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { slug } = await params;
  const author = findAuthorBySlug(slug);
  if (!author) return { title: 'Auteur introuvable | EsportNews' };

  const page = pageNumber((await searchParams).page);
  const base = `${SITE_URL}${authorHref(author)}`;
  const url = page > 1 ? `${base}?page=${page}` : base;
  const title = page > 1 ? `${author.name} — page ${page} | EsportNews` : `${author.name} | EsportNews`;
  const description = `Tous les articles de ${author.name} sur EsportNews : actualités, analyses et interviews esport.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'profile', siteName: 'EsportNews' },
  };
}

export default async function AuthorPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const author = findAuthorBySlug(slug);
  if (!author) notFound();

  const page = pageNumber((await searchParams).page);
  const { items, total } = await fetchAuthorArticles(authorQueryValue(author), page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > totalPages) notFound();

  const url = `${SITE_URL}${authorHref(author)}`;

  return (
    <div className="min-h-screen bg-bg-primary">
      <AuthorSchema name={author.name} url={url} />
      <BreadcrumbSchema
        items={generateBreadcrumbs([
          { name: 'La rédaction', url: `${SITE_URL}/auteurs` },
          { name: author.name, url },
        ])}
      />

      <main className="container mx-auto px-4 py-8 pt-24">
        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-text-secondary">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-text-primary">Accueil</Link></li>
            <li aria-hidden="true">›</li>
            <li><Link href="/auteurs" className="hover:text-text-primary">La rédaction</Link></li>
            <li aria-hidden="true">›</li>
            <li className="text-text-primary" aria-current="page">{author.name}</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">{author.name}</h1>
          <p className="text-text-secondary">
            {total} {total > 1 ? 'articles publiés' : 'article publié'} sur EsportNews
          </p>
        </header>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {items.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="text-text-secondary">Aucun article publié pour le moment.</p>
        )}

        {totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
            {page > 1 ? (
              <Link
                href={page === 2 ? authorHref(author) : `${authorHref(author)}?page=${page - 1}`}
                className="px-6 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg font-medium transition-colors border border-border-primary"
              >
                ← Précédent
              </Link>
            ) : (
              <span className="px-6 py-2 opacity-50 text-text-primary rounded-lg font-medium border border-border-primary">← Précédent</span>
            )}
            <span className="text-text-secondary font-medium">Page {page} sur {totalPages}</span>
            {page < totalPages ? (
              <Link
                href={`${authorHref(author)}?page=${page + 1}`}
                className="px-6 py-2 bg-accent hover:bg-accent/80 text-text-inverse rounded-lg font-medium transition-colors"
              >
                Suivant →
              </Link>
            ) : (
              <span className="px-6 py-2 opacity-50 bg-accent text-text-inverse rounded-lg font-medium">Suivant →</span>
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
