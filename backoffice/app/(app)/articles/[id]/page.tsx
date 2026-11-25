'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArticleEditor } from '@/components/articles/ArticleEditor';
import { PageHeader } from '@/components/Shell';
import { Empty } from '@/components/ui';

export default function ArticlePage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <>
        <PageHeader title="Article introuvable" parent={{ href: '/articles', label: 'Articles' }} />
        <main className="contenu">
          <Empty>
            Cette adresse ne correspond à aucun article. <Link className="lien" href="/articles">Revenir à la liste</Link>
          </Empty>
        </main>
      </>
    );
  }
  // One editor per article: its state never leaks into the next one opened.
  return <ArticleEditor key={id} articleId={id} />;
}
