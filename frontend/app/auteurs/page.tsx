import { Metadata } from 'next';
import Link from 'next/link';
import { AUTHORS, authorHref } from '@/app/lib/authors';
import { BreadcrumbSchema } from '@/app/components/seo/StructuredData';
import { generateBreadcrumbs } from '@/app/lib/breadcrumbHelper';
import { SITE_URL } from '@/app/lib/seoHelpers';


export const metadata: Metadata = {
  title: 'La rédaction | Esport News',
  description: "Les journalistes et rédacteurs d'Esport News : actualités, analyses, interviews et tests produits esport.",
  alternates: { canonical: `${SITE_URL}/auteurs` },
  openGraph: {
    title: 'La rédaction | Esport News',
    description: "Les journalistes et rédacteurs d'Esport News.",
    url: `${SITE_URL}/auteurs`,
    type: 'website',
  },
};

export default function AuthorsPage() {
  const authors = [...AUTHORS].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const breadcrumbs = generateBreadcrumbs([{ name: 'La rédaction', url: `${SITE_URL}/auteurs` }]);

  return (
    <div className="min-h-screen bg-bg-primary">
      <BreadcrumbSchema items={breadcrumbs} />
      <main className="container mx-auto px-4 py-8 pt-24">
        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-text-secondary">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-text-primary">Accueil</Link></li>
            <li aria-hidden="true">›</li>
            <li className="text-text-primary" aria-current="page">La rédaction</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">La rédaction</h1>
        <p className="text-text-secondary mb-8">
          Les journalistes et rédacteurs qui signent les actualités, analyses et interviews d&apos;Esport News.
        </p>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {authors.map((author) => (
            <li key={author.slug}>
              <Link
                href={authorHref(author)}
                className="block bg-bg-secondary border border-border-primary rounded-xl px-5 py-4 text-text-primary font-medium hover:border-[#F22E62] hover:text-[#F22E62] transition-colors"
              >
                {author.name}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
