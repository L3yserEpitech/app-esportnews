'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Book, RotateCw } from 'lucide-react';
import { api, errorMessage, fetcher } from '@/lib/api';
import { num } from '@/lib/format';
import { useSession } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { Dot, Empty, Notice, Skeleton, useToast } from '@/components/ui';
import { ServiceCard, ServiceCardSkeleton } from '@/components/health/ServiceCard';
import { WikiTable } from '@/components/health/WikiTable';
import { since, useNow } from '@/components/health/time';
import type { HealthSnapshot } from '@/components/health/types';

const REFRESH_MS = 60_000;

function refreshedLabel(iso: string, now: number): string {
  return now - new Date(iso).getTime() < 60_000 ? "Actualisé à l'instant" : `Actualisé ${since(iso, now)}`;
}

// One sentence for the right of the table header, when every wiki has the same budget.
function budgetCaption(snapshot: HealthSnapshot): string {
  const limits = new Set(snapshot.wikis.map((w) => w.budget_limit));
  const [limit] = limits;
  return limits.size === 1 && limit > 0 ? `Budget de ${num(limit)} appels par wiki et par heure` : '';
}

export default function HealthPage() {
  const { can } = useSession();
  const toast = useToast();
  const now = useNow();
  const allowed = can('health.read');
  const { data, error, mutate } = useSWR<HealthSnapshot>(allowed ? '/health' : null, fetcher, { refreshInterval: REFRESH_MS });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await api<HealthSnapshot>('/health?fresh=1');
      await mutate(fresh, { revalidate: false });
    } catch (e) {
      toast.fail(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  };

  if (!allowed) {
    return (
      <>
        <PageHeader title="Santé du système" />
        <main className="contenu">
          <Empty>Votre rôle ne donne pas accès à la santé du système.</Empty>
        </main>
      </>
    );
  }

  const tiles = [
    { label: 'Opérationnels', tone: 'vert' as const, value: data?.counts.ok },
    { label: 'À surveiller', tone: 'ambre' as const, value: data?.counts.warn },
    { label: 'En panne', tone: 'rouge' as const, value: data?.counts.down },
  ];

  return (
    <>
      <PageHeader title="Santé du système">
        {data ? <span className="faible">{refreshedLabel(data.refreshed_at, now)}</span> : null}
        <button type="button" className="btn btn-s" onClick={() => void refresh()} disabled={refreshing} aria-busy={refreshing}>
          <RotateCw aria-hidden="true" />
          Actualiser
        </button>
      </PageHeader>
      <main className="contenu">
        {error ? (
          <Notice tone="rouge">
            {data ? `La dernière actualisation a échoué : ${errorMessage(error)}` : errorMessage(error)}
          </Notice>
        ) : null}

        <div className="kpis sante-kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {tiles.map((tile) => (
            <div className="kpi" key={tile.label}>
              <span className="kpi-l">
                <Dot tone={tile.tone} />
                {tile.label}
              </span>
              <div className="kpi-v">{tile.value === undefined ? <Skeleton width={28} height={26} /> : <b>{num(tile.value)}</b>}</div>
            </div>
          ))}
        </div>

        <div className="sante-grille">
          {data
            ? data.services.map((service) => <ServiceCard key={service.key} service={service} now={now} />)
            : error
              ? null
              : Array.from({ length: 8 }, (_, i) => <ServiceCardSkeleton key={i} />)}
        </div>

        {data ? (
          <section className="carte" id="wikis" aria-labelledby="wikis-titre">
            <div className="carte-t">
              <Book className="ico" strokeWidth={1.8} aria-hidden="true" />
              <h2 id="wikis-titre">Liquipedia par wiki</h2>
              <div className="droite">
                <span className="faible">{budgetCaption(data)}</span>
              </div>
            </div>
            {data.wikis.length > 0 ? <WikiTable wikis={data.wikis} now={now} /> : <Empty>Aucun wiki suivi.</Empty>}
          </section>
        ) : null}
      </main>
    </>
  );
}
