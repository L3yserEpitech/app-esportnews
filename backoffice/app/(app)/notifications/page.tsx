'use client';

import { useCallback, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { Plus } from 'lucide-react';
import { api, errorMessage, fetcher } from '@/lib/api';
import { ago, day, num, pct, time } from '@/lib/format';
import { useSession } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { Chip, Dot, Empty, Pager, Skeleton, Toggle, useToast, type Tone } from '@/components/ui';
import { NewPushModal } from '@/components/push/NewPushModal';
import {
  KIND_CHIP,
  devices,
  type PushEntry,
  type PushKind,
  type PushLog,
  type PushSettings,
  type PushStats,
  type PushStores,
  type StoreState,
  type StoreStatus,
} from '@/components/push/types';

const PAGE_SIZE = 20;

const FILTERS: { value: PushKind | null; label: string }[] = [
  { value: null, label: 'Tous' },
  { value: 'article', label: 'Articles' },
  { value: 'match', label: 'Matchs' },
  { value: 'manual', label: 'Manuels' },
];

const STORE_CHIP: Record<StoreState, { label: string; tone: Tone; dot?: 'vert' | 'ambre' }> = {
  received: { label: 'Reçues', tone: 'vert', dot: 'vert' },
  silent: { label: 'Silence', tone: 'ambre', dot: 'ambre' },
  idle: { label: 'Aucun abonné', tone: 'gris' },
};

function Kpi({ label, value, sub }: { label: string; value: string | undefined; sub: string }) {
  return (
    <div className="kpi">
      <span className="kpi-l">{label}</span>
      {value === undefined ? <Skeleton width={90} height={25} /> : <b>{value}</b>}
      <span className="sous">{sub}</span>
    </div>
  );
}

function lastNotification(at: string | null): string {
  if (!at) return 'aucune notification reçue';
  const when = ago(at);
  // Past a month `ago` gives a date.
  return /^(il y a|hier|à l'instant)/.test(when) ? `dernière notification ${when}` : `dernière notification le ${when}`;
}

function StoreRow({ name, status }: { name: string; status: StoreStatus | undefined }) {
  const chip = status ? STORE_CHIP[status.status] : undefined;
  return (
    <li>
      <Dot tone={chip?.dot} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 500 }}>{name}</b>
        <span className="sous">{status ? lastNotification(status.last_at) : '—'}</span>
      </span>
      {chip && <Chip tone={chip.tone}>{chip.label}</Chip>}
    </li>
  );
}

function storesNote(stores: PushStores | undefined): string {
  const apple = stores?.apple.status === 'silent';
  const google = stores?.google.status === 'silent';
  if (apple && google)
    return "Sans notification d'Apple ni de Google, un abonnement résilié reste Premium jusqu'à la vérification quotidienne.";
  if (google) return "Sans notification de Google, un abonnement Android résilié reste Premium jusqu'à la vérification quotidienne.";
  if (apple) return "Sans notification d'Apple, un abonnement iOS résilié reste Premium jusqu'à la vérification quotidienne.";
  return 'Apple et Google préviennent le serveur à chaque achat, renouvellement ou résiliation. Un silence de plus de 48 h alors que des abonnés existent est signalé ici.';
}

export default function NotificationsPage() {
  const { can } = useSession();
  const toast = useToast();
  const { mutate: mutateAll } = useSWRConfig();
  const canSend = can('push.broadcast');

  const [kind, setKind] = useState<PushKind | null>(null);
  const [offset, setOffset] = useState(0);
  const [composing, setComposing] = useState(false);
  const [saving, setSaving] = useState(false);

  const logKey = `/push/log?limit=${PAGE_SIZE}&offset=${offset}${kind ? `&kind=${kind}` : ''}`;
  const { data: stats, error: statsError } = useSWR<PushStats>('/push/stats', fetcher, { refreshInterval: 60_000 });
  const { data: log, error: logError } = useSWR<PushLog>(logKey, fetcher, { refreshInterval: 60_000, keepPreviousData: true });
  const { data: stores, error: storesError } = useSWR<PushStores>('/push/stores', fetcher);
  const { data: settings, error: settingsError, mutate: mutateSettings } = useSWR<PushSettings>('/push/settings', fetcher);

  const closeComposer = useCallback(() => setComposing(false), []);
  const afterSend = useCallback(
    (entry: PushEntry) => {
      setComposing(false);
      setKind(null);
      setOffset(0);
      toast.notify(`Notification envoyée à ${devices(entry.sent)}.`);
      void mutateAll((key) => typeof key === 'string' && key.startsWith('/push/'));
    },
    [mutateAll, toast],
  );

  const save = async (change: Partial<PushSettings>, done: string) => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await api<PushSettings>('/push/settings', { method: 'PUT', body: change });
      await mutateSettings(next, { revalidate: false });
      toast.notify(done);
    } catch (e) {
      if ((e as { code?: string }).code !== 'reauth_cancelled') toast.fail(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const reach = stats?.reachable;
  const figure = (value: string | undefined) => (statsError ? '—' : value);

  return (
    <>
      <PageHeader title="Notifications push">
        {canSend && (
          <button type="button" className="btn btn-p" onClick={() => setComposing(true)}>
            <Plus aria-hidden="true" />
            Nouvelle notification
          </button>
        )}
      </PageHeader>
      <main className="contenu">
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <Kpi
            label="Appareils joignables"
            value={figure(reach && num(reach.total))}
            sub={reach ? `${num(reach.ios)} iOS · ${num(reach.android)} Android` : '— iOS · — Android'}
          />
          <Kpi label="Envoyées · 7 j" value={figure(stats && num(stats.sent_7d))} sub="tous types confondus" />
          <Kpi label="Remises par Apple et Google" value={figure(stats && pct(stats.delivery_rate_7d))} sub="accusés de livraison d'Expo" />
          <Kpi label="Appareils désactivés · 7 j" value={figure(stats && num(stats.deactivated_7d))} sub="application désinstallée" />
        </div>

        <div className="push-grille">
          <section className="carte">
            <div className="carte-t push-entete">
              <h2>Historique des envois</h2>
              <div className="droite" role="group" aria-label="Filtrer par type">
                {FILTERS.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    className={`filtre ${kind === f.value ? 'on' : ''}`}
                    aria-pressed={kind === f.value}
                    onClick={() => {
                      setKind(f.value);
                      setOffset(0);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="box-scroll">
              <table className="tbl serre">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Titre</th>
                    <th>Destinataires</th>
                    <th className="num">Envoyées</th>
                    <th className="num">Remises</th>
                    <th className="num">Échecs</th>
                    <th>Quand</th>
                  </tr>
                </thead>
                <tbody>
                  {!log &&
                    !logError &&
                    [0, 1, 2, 3].map((i) => (
                      <tr key={i}>
                        <td colSpan={7}>
                          <Skeleton height={18} />
                        </td>
                      </tr>
                    ))}
                  {log?.entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Chip tone={KIND_CHIP[e.kind]?.tone || 'gris'}>{KIND_CHIP[e.kind]?.label || e.kind}</Chip>
                      </td>
                      {/* The title gives way first: every other column must stay readable. */}
                      <td className="court" style={{ maxWidth: 260 }} title={e.title}>
                        {e.title}
                      </td>
                      <td className="faible">{e.audience}</td>
                      <td className="num">{num(e.sent)}</td>
                      <td className="num" title={e.delivered === null ? "Les accusés d'Expo arrivent environ 15 minutes après l'envoi" : undefined}>
                        {num(e.delivered)}
                      </td>
                      <td className="num">{num(e.failed)}</td>
                      <td className="faible">
                        {day(e.created_at)} {time(e.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logError && <Empty>{errorMessage(logError)}</Empty>}
            {log && log.entries.length === 0 && (
              <Empty>{kind ? 'Aucun envoi de ce type.' : "Aucune notification n'a encore été envoyée."}</Empty>
            )}
            {log && log.total > PAGE_SIZE && (
              <div className="push-pied">
                <Pager offset={offset} limit={PAGE_SIZE} total={log.total} onChange={setOffset} />
              </div>
            )}
          </section>

          <div className="push-cote">
            <section className="carte">
              <div className="carte-t">
                <h2>Achats des stores</h2>
              </div>
              {storesError ? (
                <Empty>{errorMessage(storesError)}</Empty>
              ) : (
                <>
                  <ul className="liste">
                    <StoreRow name="Apple" status={stores?.apple} />
                    <StoreRow name="Google Play" status={stores?.google} />
                  </ul>
                  <div className="carte-c" style={{ borderTop: '1px solid var(--line-soft)' }}>
                    <p className="faible" style={{ fontSize: 12.5 }}>
                      {storesNote(stores)}
                    </p>
                  </div>
                </>
              )}
            </section>

            <section className="carte">
              <div className="carte-t">
                <h2>Réglages</h2>
              </div>
              {settingsError ? (
                <Empty>{errorMessage(settingsError)}</Empty>
              ) : (
                <div className="carte-c">
                  <div className="push-reglage">
                    <div>
                      <b>Notifier à chaque nouvel article</b>
                      <span className="sous">Valeur par défaut de la case dans l&apos;éditeur.</span>
                    </div>
                    <Toggle
                      label="Notifier à chaque nouvel article"
                      checked={settings?.notify_new_article ?? false}
                      disabled={!settings || !canSend || saving}
                      onChange={(next) =>
                        void save(
                          { notify_new_article: next },
                          next ? "La case de l'éditeur est cochée par défaut." : "La case de l'éditeur est décochée par défaut.",
                        )
                      }
                    />
                  </div>
                  <div className="push-reglage">
                    <div>
                      <b>Alerte « Match en direct »</b>
                      <span className="sous">Envoyée au début du match aux abonnés. Abandonnée 3 h après l&apos;heure prévue.</span>
                    </div>
                    <Toggle
                      label="Alerte Match en direct"
                      checked={settings?.match_live_alert ?? false}
                      disabled={!settings || !canSend || saving}
                      onChange={(next) =>
                        void save(
                          { match_live_alert: next },
                          next
                            ? 'Alertes de match réactivées pour les matchs à venir.'
                            : 'Alertes de match coupées : les matchs qui commencent entre-temps ne seront pas notifiés.',
                        )
                      }
                    />
                  </div>
                  {!canSend && <p className="aide">Seul un administrateur peut modifier ces réglages.</p>}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {composing && <NewPushModal onClose={closeComposer} onSent={afterSend} />}
    </>
  );
}
