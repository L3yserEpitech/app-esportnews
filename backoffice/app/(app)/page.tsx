'use client';

import { PageHeader } from '@/components/Shell';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Tableau de bord" />
      <main className="contenu">
        <p className="faible">Chargement…</p>
      </main>
    </>
  );
}
