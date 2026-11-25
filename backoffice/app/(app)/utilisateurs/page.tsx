'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Download, Search } from 'lucide-react';
import { download, errorMessage, fetcher } from '@/lib/api';
import { ago, dayTime, dayYear, num } from '@/lib/format';
import { ROLE_LABEL, ROLE_TONE, useSession, type Role } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { Avatar, Chip, Empty, FilterMenu, Menu, Pager, Skeleton, Tabs, useToast } from '@/components/ui';
import { DeleteDialog, LogoutAllDialog, RoleDialog } from '@/components/users/dialogs';
import { PremiumCell } from '@/components/users/labels';
import type { UserPage, UserRow, UserStats } from '@/components/users/types';

type View = 'all' | 'premium' | 'team' | 'deleted';

const PAGE_SIZE = 25;

const VIEWS: { value: View; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'premium', label: 'Premium' },
  { value: 'team', label: 'Équipe' },
  { value: 'deleted', label: 'Supprimés' },
];

const ROLE_OPTIONS = (['user', 'reader', 'editor', 'admin'] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

const PREMIUM_OPTIONS = [
  { value: 'store', label: 'Payant' },
  { value: 'gifted', label: 'Offert' },
  { value: 'expiring', label: 'Expire bientôt' },
  { value: 'none', label: 'Sans Premium' },
];

const PLATFORM_OPTIONS = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'none', label: 'Aucun appareil' },
];

const SINCE_OPTIONS = [
  { value: 7, label: '7 derniers jours' },
  { value: 28, label: '28 derniers jours' },
  { value: 90, label: '90 derniers jours' },
];

type Dialog = { kind: 'logout' | 'role' | 'delete'; user: UserRow };

export default function UsersPage() {
  const toast = useToast();
  const [view, setView] = useState<View>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | null>(null);
  const [premium, setPremium] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [since, setSince] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const deleted = view === 'deleted';

  const filters = useMemo(() => {
    const p = new URLSearchParams({ view });
    if (query) p.set('q', query);
    if (since) p.set('since', String(since));
    if (!deleted) {
      if (role) p.set('role', role);
      if (premium) p.set('premium', premium);
      if (platform) p.set('platform', platform);
    }
    return p.toString();
  }, [view, query, role, premium, platform, since, deleted]);

  const { data: stats, mutate: reloadStats } = useSWR<UserStats>('/users/stats', fetcher);

  const exportList = () =>
    download(`/users/export?${filters}`, deleted ? 'comptes-supprimes.csv' : 'utilisateurs.csv').catch((e) => {
      if ((e as { code?: string }).code !== 'reauth_cancelled') toast.fail(errorMessage(e));
    });

  const filtered = Boolean(query || since || (!deleted && (role || premium || platform)));

  return (
    <>
      <PageHeader title="Utilisateurs">
        <button type="button" className="btn btn-s" onClick={() => void exportList()}>
          <Download aria-hidden="true" />
          Exporter
        </button>
      </PageHeader>
      <main className="contenu">
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <Kpi label="Comptes" value={stats?.accounts} />
          <Kpi label="Premium actifs" value={stats?.premium_active} />
          <Kpi label="Appareils joignables en push" value={stats?.reachable_devices} />
          <Kpi label="Inscriptions · 28 j" value={stats?.signups_28d} />
        </div>

        <Tabs label="Vues" value={view} onChange={setView} tabs={VIEWS} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label className="inp" style={{ width: 280 }}>
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder={deleted ? 'Identifiant du compte' : 'Adresse e-mail ou identifiant'}
              aria-label={deleted ? 'Rechercher un identifiant de compte' : 'Rechercher une adresse e-mail ou un identifiant'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {!deleted && (
            <>
              <FilterMenu label="Rôle" value={role} onChange={setRole} options={ROLE_OPTIONS} />
              <FilterMenu label="Premium" value={premium} onChange={setPremium} options={PREMIUM_OPTIONS} />
              <FilterMenu label="Plateforme" value={platform} onChange={setPlatform} options={PLATFORM_OPTIONS} />
            </>
          )}
          <FilterMenu label={deleted ? 'Supprimé' : 'Inscrit'} value={since} onChange={setSince} options={SINCE_OPTIONS} />
        </div>

        {/* Keyed by the filters: a new view or filter starts from its first page with nothing left over from the last. */}
        <UserList key={filters} filters={filters} deleted={deleted} filtered={filtered} onChanged={() => void reloadStats()} />
      </main>
    </>
  );
}

function UserList({
  filters,
  deleted,
  filtered,
  onChanged,
}: {
  filters: string;
  deleted: boolean;
  filtered: boolean;
  onChanged: () => void;
}) {
  const { me } = useSession();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { data, error, mutate } = useSWR<UserPage>(`/users?${filters}&limit=${PAGE_SIZE}&offset=${offset}`, fetcher, {
    keepPreviousData: true,
  });

  const done = (text: string) => {
    setDialog(null);
    toast.notify(text);
    void mutate();
    onChanged();
  };

  return (
    <>
      {deleted ? (
        <DeletedTable page={data} error={error} filtered={filtered} />
      ) : (
        <div className="box">
          <div className="box-scroll">
            <table className="tbl serre">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Rôle</th>
                  <th>Premium</th>
                  <th className="num">Appareils</th>
                  <th className="num">Matchs suivis</th>
                  <th className="num">Tournois suivis</th>
                  <th>Inscrit le</th>
                  <th>Dernière visite</th>
                  <th style={{ width: 44 }}>
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!data &&
                  !error &&
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i}>
                      <td colSpan={9}>
                        <Skeleton height={18} />
                      </td>
                    </tr>
                  ))}
                {data?.users.map((u) => {
                  const self = u.id === me.user.id;
                  return (
                    <tr key={u.id}>
                      {/* The address gives way first, so every column stays in view. */}
                      <td style={{ width: '100%', maxWidth: 0, minWidth: 220 }}>
                        <span className="qui">
                          <Avatar name={u.name || u.email} team={u.role !== 'user'} />
                          <Link
                            href={`/utilisateurs/${u.id}`}
                            title={u.email}
                            style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {u.email}
                          </Link>
                          {self && <span className="faible">· vous</span>}
                        </span>
                      </td>
                      <td>
                        <Chip tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Chip>
                      </td>
                      <td>
                        <PremiumCell premium={u.premium} />
                      </td>
                      <td className="num">{num(u.devices)}</td>
                      <td className="num">{num(u.matches_followed)}</td>
                      <td className="num">{num(u.tournaments_followed)}</td>
                      <td className="faible">{dayYear(u.created_at)}</td>
                      <td className="faible">{ago(u.last_seen_at)}</td>
                      <td>
                        <Menu label={`Actions pour ${u.email}`}>
                          {(close) => (
                            <>
                              <Link href={`/utilisateurs/${u.id}`} role="menuitem" onClick={close}>
                                Ouvrir la fiche
                              </Link>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  close();
                                  setDialog({ kind: 'logout', user: u });
                                }}
                              >
                                Déconnecter tous les appareils
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={self}
                                onClick={() => {
                                  close();
                                  setDialog({ kind: 'role', user: u });
                                }}
                              >
                                Changer le rôle
                              </button>
                              <hr />
                              <button
                                type="button"
                                role="menuitem"
                                className="danger"
                                disabled={self}
                                onClick={() => {
                                  close();
                                  setDialog({ kind: 'delete', user: u });
                                }}
                              >
                                Supprimer le compte
                              </button>
                            </>
                          )}
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error && <Empty>{errorMessage(error)}</Empty>}
          {data && data.users.length === 0 && (
            <Empty>{filtered ? 'Aucun compte ne correspond à ces filtres.' : 'Aucun compte dans cette vue.'}</Empty>
          )}
        </div>
      )}

      {data && <Pager offset={offset} limit={PAGE_SIZE} total={data.total} onChange={setOffset} />}

      {dialog?.kind === 'logout' && (
        <LogoutAllDialog user={dialog.user} onClose={() => setDialog(null)} onDone={() => done('Appareils déconnectés.')} />
      )}
      {dialog?.kind === 'role' && (
        <RoleDialog
          user={dialog.user}
          self={dialog.user.id === me.user.id}
          onClose={() => setDialog(null)}
          onDone={(next) => done(`${dialog.user.email} est maintenant ${ROLE_LABEL[next]}.`)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDialog
          user={dialog.user}
          self={dialog.user.id === me.user.id}
          onClose={() => setDialog(null)}
          onDone={() => done('Compte supprimé.')}
        />
      )}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="kpi">
      <span className="kpi-l">{label}</span>
      {value === undefined ? <Skeleton width={72} height={26} /> : <b>{num(value)}</b>}
    </div>
  );
}

function DeletedTable({ page, error, filtered }: { page: UserPage | undefined; error: unknown; filtered: boolean }) {
  const rows = page?.deleted;
  return (
    <div className="box">
      <div className="box-scroll">
        <table className="tbl serre">
          <thead>
            <tr>
              <th>Identifiant</th>
              <th>Inscrit le</th>
              <th>Supprimé le</th>
              <th>Supprimé par</th>
              <th>Motif</th>
            </tr>
          </thead>
          <tbody>
            {!page &&
              !error &&
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={5}>
                    <Skeleton height={18} />
                  </td>
                </tr>
              ))}
            {rows?.map((d) => (
              <tr key={`${d.user_id}-${d.deleted_at}`}>
                <td className="mono">{d.user_id}</td>
                <td className="faible">{dayYear(d.registered_at)}</td>
                <td className="faible">{dayTime(d.deleted_at)}</td>
                <td>{d.deleted_by === 'self' ? 'La personne elle-même' : d.deleted_by || '—'}</td>
                <td className="court" title={d.reason}>
                  {d.reason || <span className="faible">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Boolean(error) && <Empty>{errorMessage(error)}</Empty>}
      {page && (rows?.length ?? 0) === 0 && (
        <Empty>{filtered ? 'Aucune suppression ne correspond à ces filtres.' : 'Aucun compte supprimé.'}</Empty>
      )}
      <div className="faible" style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)' }}>
        D&apos;un compte supprimé il ne reste que son identifiant, ses dates et le motif : aucune adresse, aucun nom.
      </div>
    </div>
  );
}
