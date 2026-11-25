'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Activity, ChevronRight, FileText, Inbox, LineChart as LineChartIcon } from 'lucide-react';
import { errorMessage, fetcher } from '@/lib/api';
import { day, dec1, num } from '@/lib/format';
import { useSession } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { LineChart, Legend, Sparkline, type ChartLine } from '@/components/charts';
import { Chip, Dot, Empty, FilterMenu, Notice, Skeleton } from '@/components/ui';

interface Kpi {
  configured: boolean;
  source?: string;
  value: number;
  prev: number | null;
  series: number[];
}

interface DayPoint {
  date: string;
  value: number;
}

interface Alert {
  level: 'important' | 'info';
  title: string;
  detail: string;
  href: string;
}

interface Dashboard {
  days: number;
  visitors: Kpi;
  gsc_clicks: Kpi;
  downloads: Kpi;
  premium: Kpi;
  traffic: { series: DayPoint[]; prev_series: DayPoint[]; source: string };
  watch: Alert[];
  articles: { id: number; title: string; author: string; created_at: string; views: number }[];
  articles_total: number;
  services?: { key: string; name: string; status: 'ok' | 'warn' | 'down' | 'unconfigured'; note?: string }[];
}

const PERIODS = [
  { value: 7, label: '7 jours' },
  { value: 28, label: '28 jours' },
  { value: 90, label: '90 jours' },
];

function KpiTile({ label, kpi, absolute }: { label: string; kpi?: Kpi; absolute?: boolean }) {
  if (!kpi) {
    return (
      <div className="kpi">
        <span className="kpi-l">{label}</span>
        <Skeleton height={28} width={120} />
      </div>
    );
  }
  let variation = null;
  if (kpi.configured && kpi.prev !== null) {
    const diff = kpi.value - kpi.prev;
    if (absolute) {
      // A handful of subscribers reads better as a count than as a percentage.
      if (diff !== 0) variation = <span className={`delta ${diff > 0 ? 'up' : 'down'}`}>{`${diff > 0 ? '↗' : '↘'} ${num(Math.abs(diff))}`}</span>;
    } else if (kpi.prev > 0) {
      const ratio = diff / kpi.prev;
      variation = <span className={`delta ${ratio >= 0 ? 'up' : 'down'}`}>{`${ratio >= 0 ? '↗' : '↘'} ${dec1(Math.abs(ratio) * 100)} %`}</span>;
    }
  }
  return (
    <div className="kpi">
      <span className="kpi-l">{label}</span>
      <div className="kpi-v">
        <span>
          <b>{kpi.configured ? num(kpi.value) : '—'}</b>
          {variation}
          {!kpi.configured && <span className="sous">non connecté</span>}
        </span>
        {kpi.configured && <Sparkline values={kpi.series} />}
      </div>
    </div>
  );
}

const STATUS_TONE = { ok: 'vert', warn: 'ambre', down: 'rouge' } as const;

export default function DashboardPage() {
  const { can } = useSession();
  const [days, setDays] = useState(28);
  const { data, error } = useSWR<Dashboard>(`/dashboard?days=${days}`, fetcher, { refreshInterval: 300_000 });

  const visitorsLabel = data?.visitors.source === 'vercel' ? 'Visiteurs uniques · Vercel' : 'Visiteurs uniques · mesure interne';
  const lines: ChartLine[] = data
    ? [
        { label: 'Visiteurs', values: data.traffic.series.map((p) => p.value), color: '#F22E62', width: 2 },
        { label: 'Période précédente', values: data.traffic.prev_series.map((p) => p.value), color: '#A1A1AA', dashed: true },
      ]
    : [];

  return (
    <>
      <PageHeader title="Tableau de bord">
        <FilterMenu label="Période" value={days} onChange={(v) => setDays(v ?? 28)} options={PERIODS} />
        <span className="faible">comparé aux {days} jours précédents</span>
      </PageHeader>
      <main className="contenu">
        {error && <Notice tone="rouge">{errorMessage(error)}</Notice>}

        <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <KpiTile label={data ? visitorsLabel : 'Visiteurs uniques'} kpi={data?.visitors} />
          <KpiTile label="Clics depuis Google · Search Console" kpi={data?.gsc_clicks} />
          <KpiTile label="Téléchargements de l'app" kpi={data?.downloads} />
          <KpiTile label="Abonnés Premium actifs" kpi={data?.premium} absolute />
        </div>

        <div className="grille-2" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
          <section className="carte">
            <div className="carte-t">
              <LineChartIcon className="ico" aria-hidden="true" />
              <h2>Trafic du site</h2>
              <div className="droite">
                <Chip>Jour</Chip>
                {can('analytics.read') && (
                  <Link className="ext" href="/analytics">
                    Analytics
                  </Link>
                )}
              </div>
            </div>
            <div className="carte-c">
              {data ? (
                <>
                  <LineChart
                    dates={data.traffic.series.map((p) => p.date)}
                    lines={lines}
                    describe={`Visiteurs par jour sur ${days} jours : ${num(data.visitors.value)}, contre ${num(data.visitors.prev ?? 0)} sur la période précédente`}
                  />
                  <Legend lines={lines} />
                </>
              ) : (
                <Skeleton height={196} />
              )}
            </div>
          </section>

          <section className="carte">
            <div className="carte-t">
              <Inbox className="ico" aria-hidden="true" />
              <h2>À regarder</h2>
            </div>
            {!data ? (
              <div className="carte-c">
                <Skeleton height={120} />
              </div>
            ) : data.watch.length === 0 ? (
              <Empty>Rien à signaler.</Empty>
            ) : (
              <ul className="liste">
                {data.watch.map((a) => (
                  <li key={a.title}>
                    <Chip tone={a.level === 'important' ? 'ambre' : 'gris'}>{a.level === 'important' ? 'Important' : 'À voir'}</Chip>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontWeight: 500 }}>{a.title}</b>
                      <span className="sous">{a.detail}</span>
                    </span>
                    <Link className="ico-btn" href={a.href} aria-label={`Ouvrir : ${a.title}`}>
                      <ChevronRight />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grille-2" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
          <section className="carte">
            <div className="carte-t">
              <FileText className="ico" aria-hidden="true" />
              <h2>Derniers articles</h2>
              <div className="droite">
                <Link className="ext" href="/articles">
                  Tous les articles{data ? ` (${num(data.articles_total)})` : ''}
                </Link>
              </div>
            </div>
            {data && data.articles.length === 0 ? (
              <Empty>Aucun article publié.</Empty>
            ) : (
              <div className="box-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Titre</th>
                      <th>Auteur</th>
                      <th>Publié</th>
                      <th className="num">Vues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!data &&
                      [0, 1, 2, 3, 4].map((i) => (
                        <tr key={i}>
                          <td colSpan={4}>
                            <Skeleton height={16} />
                          </td>
                        </tr>
                      ))}
                    {data?.articles.map((a) => (
                      <tr key={a.id}>
                        <td className="court" style={{ maxWidth: 420 }}>
                          <Link className="lien" href={`/articles/${a.id}`} style={{ color: 'var(--ink)' }} title={a.title}>
                            {a.title}
                          </Link>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{a.author || '—'}</td>
                        <td className="faible" style={{ whiteSpace: 'nowrap' }}>
                          {day(a.created_at)}
                        </td>
                        <td className="num">{num(a.views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {data?.services && (
            <section className="carte">
              <div className="carte-t">
                <Activity className="ico" aria-hidden="true" />
                <h2>Services</h2>
                <div className="droite">
                  <Link className="ext" href="/sante">
                    Santé du système
                  </Link>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {data.services.map((s, i) => (
                  <span
                    key={s.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--line-soft)',
                      borderLeft: i % 2 === 1 ? '1px solid var(--line-soft)' : undefined,
                      minWidth: 0,
                    }}
                  >
                    <Dot tone={s.status === 'unconfigured' ? undefined : STATUS_TONE[s.status]} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    {s.status === 'unconfigured' && (
                      <span className="faible" style={{ marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>
                        non connecté
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
