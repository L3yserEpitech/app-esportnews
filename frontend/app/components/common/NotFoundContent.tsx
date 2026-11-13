'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function NotFoundContent() {
  const t = useTranslations();

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4 text-center text-text-primary">
      <h1 className="text-7xl font-black tabular-nums text-[#F22E62]">404</h1>
      <Link href="/" className="text-sm font-medium text-text-secondary hover:text-[#F22E62] transition-colors">
        {t('pages.login.retour_accueil')}
      </Link>
    </main>
  );
}
