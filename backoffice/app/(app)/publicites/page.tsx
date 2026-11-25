'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { CalendarClock, Info, Plus } from 'lucide-react';
import { api, errorMessage, fetcher } from '@/lib/api';
import { ago } from '@/lib/format';
import { useSession } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { Chip, ConfirmModal, Empty, Menu, Skeleton, useToast } from '@/components/ui';
import { NewSpotModal } from '@/components/ads/NewSpotModal';
import { SpotEditor } from '@/components/ads/SpotEditor';
import { SpotPreview } from '@/components/ads/SpotPreview';
import { parseFormat, spotState, STATE_CHIP, windowText, type Spot } from '@/components/ads/spots';

const SITE_DELAY = 'Visible sur le site dans les 5 minutes.';

export default function AdsPage() {
  const { can } = useSession();
  const toast = useToast();
  const { data, error, mutate } = useSWR<{ spots: Spot[] }>('/ads/spots', fetcher);
  const [editing, setEditing] = useState<Spot | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Spot | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // A window that opens or closes while the page is open must show without a reload.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const closeEditor = useCallback(() => setEditing(null), []);
  const closeCreator = useCallback(() => setCreating(false), []);
  const closeRemoval = useCallback(() => setRemoving(null), []);

  const remove = async (spot: Spot) => {
    setBusy(true);
    try {
      await api(`/ads/spots/${spot.key}`, { method: 'DELETE' });
      toast.notify('Emplacement supprimé.');
      setRemoving(null);
      await mutate();
    } catch (e) {
      toast.fail(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const spots = data?.spots;

  return (
    <>
      <PageHeader title="Publicités">
        {can('ads.manage') && (
          <button type="button" className="btn btn-s" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            Nouvel emplacement
          </button>
        )}
      </PageHeader>
      <main className="contenu">
        <p className="info">
          <Info aria-hidden="true" />
          Chaque emplacement affiche la régie par défaut. Remplacez-le par votre bannière quand vous voulez.
        </p>

        {error && (
          <div className="box">
            <Empty>{errorMessage(error)}</Empty>
          </div>
        )}

        <div className="pub-grille">
          {!spots &&
            !error &&
            [0, 1, 2].map((i) => (
              <section key={i} className="carte pub-carte" aria-hidden="true">
                <div className="pub-cadre">
                  <Skeleton width={99} height={132} />
                </div>
                <div className="pub-infos">
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="85%" />
                  <Skeleton width="40%" height={22} />
                </div>
              </section>
            ))}

          {spots?.map((spot) => {
            const state = spotState(spot, now);
            const chip = STATE_CHIP[state];
            const shown = state === 'custom' ? 'custom' : state === 'off' ? 'off' : 'adsense';
            const { width, height } = parseFormat(spot.format);
            const wide = width / height >= 2;
            const period = spot.mode === 'custom' ? windowText(spot) : '';
            return (
              <section key={spot.key} className={`carte pub-carte ${wide ? 'large' : ''}`} aria-labelledby={`spot-${spot.key}`}>
                <div className="pub-cadre">
                  <SpotPreview
                    format={spot.format}
                    show={shown}
                    mediaUrl={spot.media_url}
                    mediaType={spot.media_type}
                    title={spot.title}
                    maxWidth={wide ? 300 : 132}
                    maxHeight={wide ? 96 : 176}
                  />
                </div>
                <div className="pub-infos">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 id={`spot-${spot.key}`} style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {spot.label}
                      </h2>
                      <span className="sous">
                        <span className="mono">{spot.key}</span> · {width} × {height}
                      </span>
                      <span className="sous">{spot.placement}</span>
                    </div>
                    {!spot.builtin && (
                      <Menu label={`Actions pour ${spot.label}`}>
                        {(close) => (
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => {
                              close();
                              setRemoving(spot);
                            }}
                          >
                            Supprimer l&apos;emplacement
                          </button>
                        )}
                      </Menu>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Chip tone={chip.tone}>{chip.label}</Chip>
                    {state === 'ended' && <span className="faible">la régie a repris la place</span>}
                    {state === 'custom' && spot.title && (
                      <span className="faible pub-coupe" title={spot.title}>
                        {spot.title}
                      </span>
                    )}
                  </div>

                  {period && (
                    <span className="info">
                      <CalendarClock aria-hidden="true" />
                      {period}
                    </span>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                    <span className="faible" style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
                      {spot.updated_by ? `Modifié par ${spot.updated_by}, ${ago(spot.updated_at)}` : 'Jamais modifié'}
                    </span>
                    <button type="button" className="btn btn-s" onClick={() => setEditing(spot)} aria-label={`Modifier ${spot.label}`}>
                      Modifier
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {spots && spots.length === 0 && (
          <div className="box">
            <Empty>Aucun emplacement déclaré.</Empty>
          </div>
        )}
      </main>

      {editing && (
        <SpotEditor
          spot={editing}
          onClose={closeEditor}
          onSaved={() => {
            setEditing(null);
            toast.notify(`Emplacement enregistré. ${SITE_DELAY}`);
            void mutate();
          }}
        />
      )}

      {creating && (
        <NewSpotModal
          onClose={closeCreator}
          onCreated={() => {
            setCreating(false);
            toast.notify('Emplacement créé. Il affiche la régie.');
            void mutate();
          }}
        />
      )}

      {removing && (
        <ConfirmModal
          title="Supprimer l'emplacement"
          confirmLabel="Supprimer"
          danger
          busy={busy}
          onClose={closeRemoval}
          onConfirm={() => void remove(removing)}
        >
          <p>
            « {removing.label} » (<span className="mono">{removing.key}</span>) disparaît du back-office. Si le site l&apos;utilise encore, il y
            affichera la régie.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}
