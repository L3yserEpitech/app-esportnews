'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import { Download, Search } from 'lucide-react';
import { download, errorMessage, fetcher } from '@/lib/api';
import { AUDIT_ACTIONS, AUDIT_GROUPS } from '@/lib/audit';
import { dayHeading, dayKey, time } from '@/lib/format';
import { PageHeader } from '@/components/Shell';
import { Avatar, Chip, Empty, FilterMenu, Skeleton, useToast } from '@/components/ui';

interface Entry {
  id: number;
  created_at: string;
  actor_id: number | null;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  detail: string;
  device: string;
  city: string;
}

interface Page {
  entries: Entry[];
  has_more: boolean;
  actors: { id: number; name: string }[];
}

const PERIODS = [
  { value: 1, label: "Aujourd'hui" },
  { value: 7, label: '7 derniers jours' },
  { value: 30, label: '30 derniers jours' },
  { value: 365, label: '12 derniers mois' },
];

export default function JournalPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [actor, setActor] = useState<number | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [days, setDays] = useState<number>(7);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const filters = useMemo(() => {
    const p = new URLSearchParams({ days: String(days) });
    if (query) p.set('q', query);
    if (actor) p.set('actor', String(actor));
    if (group) p.set('action', group);
    return p.toString();
  }, [days, query, actor, group]);

  const { data, error, size, setSize, isValidating } = useSWRInfinite<Page>(
    (index, previous) => {
      if (previous && !previous.has_more) return null;
      const before = previous ? `&before=${previous.entries[previous.entries.length - 1].id}` : '';
      return `/audit?${filters}${before}`;
    },
    fetcher,
    { revalidateFirstPage: false },
  );

  const entries = data?.flatMap((p) => p.entries) ?? [];
  const actors = data?.[0]?.actors ?? [];
  const hasMore = data ? data[data.length - 1].has_more : false;
  const period = PERIODS.find((p) => p.value === days)!;

  return (
    <>
      <PageHeader title="Journal d'audit">
        <button
          type="button"
          className="btn btn-s"
          onClick={() => download(`/audit/export?${filters}`, 'journal-audit.csv').catch((e) => toast.fail(errorMessage(e)))}
        >
          <Download aria-hidden="true" />
          Exporter
        </button>
      </PageHeader>
      <main className="contenu">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label className="inp" style={{ width: 280 }}>
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Rechercher une cible ou un détail"
              aria-label="Rechercher une cible ou un détail"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <FilterMenu label="Membre" value={actor} onChange={setActor} options={actors.map((a) => ({ value: a.id, label: a.name }))} />
          <FilterMenu label="Type d'action" value={group} onChange={setGroup} options={AUDIT_GROUPS} />
          <FilterMenu label="Période" value={days} onChange={(v) => setDays(v ?? 7)} options={PERIODS} />
          <span className="faible" style={{ marginLeft: 'auto' }}>
            Conservé 1 an
          </span>
        </div>

        <div className="box">
          <div className="box-scroll">
            <table className="tbl serre">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Heure</th>
                  <th>Membre</th>
                  <th>Action</th>
                  <th>Cible</th>
                  <th>Détail</th>
                  <th>Depuis</th>
                </tr>
              </thead>
              <tbody>
                {!data &&
                  !error &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td colSpan={6}>
                        <Skeleton height={18} />
                      </td>
                    </tr>
                  ))}
                {entries.map((e, i) => {
                  const meta = AUDIT_ACTIONS[e.action] || { label: e.action, tone: 'gris' as const };
                  const newDay = i === 0 || dayKey(entries[i - 1].created_at) !== dayKey(e.created_at);
                  const from = [e.city, e.device].filter(Boolean).join(' · ');
                  return (
                    <Fragment key={e.id}>
                      {newDay && (
                        <tr className="jour">
                          <td colSpan={6}>{dayHeading(e.created_at)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="mono faible">{time(e.created_at)}</td>
                        <td>
                          <span className="qui" style={{ gap: 8 }}>
                            <Avatar name={e.actor_name || '?'} size={24} />
                            {e.actor_name || 'Système'}
                          </span>
                        </td>
                        <td>
                          <Chip tone={meta.tone}>{meta.label}</Chip>
                        </td>
                        <td className={`court ${e.target_type === 'user' && !e.target_label ? 'mono' : ''}`} title={e.target_label}>
                          {e.target_label || (e.target_id ? `${e.target_type} ${e.target_id}` : '—')}
                        </td>
                        <td className="faible court" title={e.detail}>
                          {e.detail || '—'}
                        </td>
                        <td className="mono faible">{from || '—'}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error && <Empty>{errorMessage(error)}</Empty>}
          {data && entries.length === 0 && <Empty>Aucune action sur la période « {period.label.toLowerCase()} ».</Empty>}
        </div>

        {hasMore && (
          <button type="button" className="btn btn-s" style={{ alignSelf: 'center' }} disabled={isValidating} onClick={() => void setSize(size + 1)}>
            Afficher la suite
          </button>
        )}
      </main>
    </>
  );
}
