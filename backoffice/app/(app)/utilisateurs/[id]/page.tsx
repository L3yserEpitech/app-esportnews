'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { LogOut, MoreHorizontal, Smartphone } from 'lucide-react';
import { ApiError, download, errorMessage, fetcher } from '@/lib/api';
import { AUDIT_ACTIONS } from '@/lib/audit';
import { day, dayTime, dayYear, plural } from '@/lib/format';
import { ROLE_LABEL, ROLE_TONE, useSession } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { Avatar, Chip, Empty, Menu, Skeleton, Tabs, Toggle, useToast } from '@/components/ui';
import { DeleteDialog, GiftDialog, LogoutAllDialog, RoleDialog } from '@/components/users/dialogs';
import { SOURCE_LONG, deviceNote, followStatus, isOver, limitText, platformLabel, signupSource } from '@/components/users/labels';
import type { Device, FollowedMatch, FollowedTournament, Follows, PremiumDetail, UserDetail } from '@/components/users/types';

type Tab = 'apercu' | 'suivis' | 'appareils' | 'historique';

const TABS: { value: Tab; label: string }[] = [
  { value: 'apercu', label: 'Aperçu' },
  { value: 'suivis', label: 'Matchs et tournois suivis' },
  { value: 'appareils', label: 'Appareils' },
  { value: 'historique', label: 'Historique' },
];

type Dialog = 'logout' | 'role' | 'delete' | 'gift-on' | 'gift-off';

interface HistoryEntry {
  id: number;
  created_at: string;
  actor_name: string;
  action: string;
  detail: string;
  device: string;
  city: string;
}

const ORIGIN_LABEL: Record<FollowedMatch['origin'], string> = {
  like: 'Suivi à la main',
  tournament: 'Ajouté par un tournoi suivi',
  team: 'Ajouté par une équipe favorite',
};

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('apercu');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { data, error, mutate } = useSWR<UserDetail>(`/users/${id}`, fetcher);
  const { data: history, mutate: reloadHistory } = useSWR<{ entries: HistoryEntry[] }>(
    tab === 'historique' ? `/users/${id}/history` : null,
    fetcher,
  );
  const { data: follows } = useSWR<Follows>(tab === 'suivis' ? `/users/${id}/follows` : null, fetcher);

  if (error instanceof ApiError && error.status === 404) {
    return (
      <>
        <PageHeader title="Compte introuvable" parent={{ href: '/utilisateurs', label: 'Utilisateurs' }} />
        <main className="contenu">
          <div className="box">
            <Empty>
              <p style={{ color: 'var(--ink)', fontWeight: 500, marginBottom: 4 }}>Aucun compte ne porte l&apos;identifiant {id}.</p>
              <p style={{ marginBottom: 14 }}>Il a peut-être été supprimé : l&apos;onglet « Supprimés » de la liste garde la date et le motif.</p>
              <Link className="btn btn-s" href="/utilisateurs">
                Revenir aux utilisateurs
              </Link>
            </Empty>
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Utilisateur" parent={{ href: '/utilisateurs', label: 'Utilisateurs' }} />
        <main className="contenu">
          <div className="box">
            <Empty>{errorMessage(error)}</Empty>
          </div>
        </main>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Utilisateur" parent={{ href: '/utilisateurs', label: 'Utilisateurs' }} />
        <main className="contenu">
          <Skeleton height={38} />
          <div className="grille-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
            <Skeleton height={220} />
            <Skeleton height={220} />
          </div>
        </main>
      </>
    );
  }

  const { user, premium, devices } = data;
  const self = user.id === me.user.id;
  const ref = { id: user.id, email: user.email, role: user.role };

  const done = (text: string) => {
    setDialog(null);
    toast.notify(text);
    void mutate();
    void reloadHistory();
  };

  const exportData = () =>
    download(`/users/${user.id}/export`, `compte-${user.id}.json`)
      .then(() => void reloadHistory())
      .catch((e) => toast.fail(errorMessage(e)));

  return (
    <>
      <PageHeader
        title={user.email}
        parent={{ href: '/utilisateurs', label: 'Utilisateurs' }}
        chips={
          <>
            <Chip tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role]}</Chip>
            {premium.active && <Chip tone="vert">Premium</Chip>}
          </>
        }
      >
        <button type="button" className="btn btn-s" onClick={() => setDialog('logout')}>
          <LogOut aria-hidden="true" />
          Déconnecter tous les appareils
        </button>
        <button
          type="button"
          className="btn btn-s"
          disabled={self}
          title={self ? 'Vous ne pouvez pas changer votre propre rôle' : undefined}
          onClick={() => setDialog('role')}
        >
          Changer le rôle
        </button>
        <Menu
          label="Autres actions"
          trigger={(props) => (
            <button type="button" className="ico-btn bord" aria-label="Autres actions" {...props}>
              <MoreHorizontal />
            </button>
          )}
        >
          {(close) => (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  void exportData();
                }}
              >
                Exporter les données
              </button>
              <hr />
              <button
                type="button"
                role="menuitem"
                className="danger"
                disabled={self}
                onClick={() => {
                  close();
                  setDialog('delete');
                }}
              >
                Supprimer le compte
              </button>
            </>
          )}
        </Menu>
      </PageHeader>

      <main className="contenu">
        <Tabs label="Sections" value={tab} onChange={setTab} tabs={TABS} />

        {tab === 'apercu' && (
          <div className="grille-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <section className="carte">
                <div className="carte-t">
                  <h2>Compte</h2>
                </div>
                <dl className="dl">
                  <dt>Adresse e-mail</dt>
                  <dd>{user.email}</dd>
                  <dt>Identifiant</dt>
                  <dd className="mono">{user.id}</dd>
                  <dt>Inscrit le</dt>
                  <dd>{[dayYear(user.created_at), signupSource(user.signup_source)].filter(Boolean).join(', ')}</dd>
                  <dt>Âge déclaré</dt>
                  <dd>{user.age ? `${user.age} ans` : '—'}</dd>
                  <dt>Équipes favorites</dt>
                  <dd style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {user.favorite_teams.length === 0 && '—'}
                    {user.favorite_teams.map((t) =>
                      t.name ? (
                        <span key={t.id} className="tag">
                          {t.name}
                        </span>
                      ) : (
                        <span key={t.id} className="tag mono" title="Nom absent du cache : seul l'identifiant Liquipedia est connu">
                          n° {t.id}
                        </span>
                      ),
                    )}
                  </dd>
                  <dt>Sessions ouvertes</dt>
                  <dd>{user.sessions === null ? '—' : user.sessions === 0 ? 'Aucune' : plural(user.sessions, 'appareil', 'appareils')}</dd>
                </dl>
              </section>

              <PremiumCard premium={premium} onToggle={(next) => setDialog(next ? 'gift-on' : 'gift-off')} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              <section className="carte">
                <div className="carte-t">
                  <h2>Appareils</h2>
                  <div className="droite">
                    <span className="faible" style={{ fontSize: 12 }}>
                      notifications push
                    </span>
                  </div>
                </div>
                {devices.length === 0 ? (
                  <Empty>Aucun appareil enregistré pour les notifications.</Empty>
                ) : (
                  <ul className="liste">
                    {devices.slice(0, 4).map((d) => (
                      <DeviceLine key={d.id} device={d} />
                    ))}
                  </ul>
                )}
                {devices.length > 4 && (
                  <CardLink onClick={() => setTab('appareils')}>Voir les {devices.length} appareils</CardLink>
                )}
              </section>

              <FollowsCard follows={data.follows} onSeeAll={() => setTab('suivis')} />

              <section className="carte">
                <div className="carte-t">
                  <h2>Données personnelles</h2>
                </div>
                <div className="carte-c">
                  <p className="faible">
                    Export au format JSON de tout ce que la base garde sur ce compte, ou suppression définitive (abonnements,
                    appareils et sessions compris).
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-s" onClick={() => void exportData()}>
                      Exporter les données
                    </button>
                    <button
                      type="button"
                      className="btn btn-r"
                      disabled={self}
                      title={self ? 'Vous ne pouvez pas supprimer votre propre compte ici' : undefined}
                      onClick={() => setDialog('delete')}
                    >
                      Supprimer le compte
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {tab === 'suivis' && <FollowsTab follows={follows} />}

        {tab === 'appareils' && (
          <section className="carte">
            <div className="carte-t">
              <h2>Appareils</h2>
              <div className="droite">
                <span className="faible" style={{ fontSize: 12 }}>
                  {user.sessions === null ? 'notifications push' : `${plural(user.sessions, 'session ouverte', 'sessions ouvertes')} sur le site et l'app`}
                </span>
              </div>
            </div>
            <div className="box-scroll">
              <table className="tbl serre">
                <thead>
                  <tr>
                    <th>Plateforme</th>
                    <th>Notifications push</th>
                    <th>Enregistré le</th>
                    <th>Dernier changement</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="src">
                          <Smartphone aria-hidden="true" />
                          {platformLabel(d.platform)}
                        </span>
                      </td>
                      <td>{d.active ? <Chip tone="vert">Joignable</Chip> : <Chip tone="gris">Inactif</Chip>}</td>
                      <td className="faible">{dayTime(d.created_at)}</td>
                      <td className="faible">{dayTime(d.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {devices.length === 0 && <Empty>Aucun appareil enregistré pour les notifications.</Empty>}
            <div className="faible" style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)' }}>
              Un appareil devient inactif quand Apple ou Google refuse son jeton, ou quand la personne se déconnecte de l&apos;application.
            </div>
          </section>
        )}

        {tab === 'historique' && (
          <div className="box">
            <div className="box-scroll">
              <table className="tbl serre">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Membre</th>
                    <th>Action</th>
                    <th>Détail</th>
                    <th>Depuis</th>
                  </tr>
                </thead>
                <tbody>
                  {!history &&
                    [0, 1, 2].map((i) => (
                      <tr key={i}>
                        <td colSpan={5}>
                          <Skeleton height={18} />
                        </td>
                      </tr>
                    ))}
                  {history?.entries.map((e) => {
                    const meta = AUDIT_ACTIONS[e.action] || { label: e.action, tone: 'gris' as const };
                    return (
                      <tr key={e.id}>
                        <td className="faible">{dayTime(e.created_at)}</td>
                        <td>
                          <span className="qui" style={{ gap: 8 }}>
                            <Avatar name={e.actor_name || '?'} size={24} />
                            {e.actor_name || 'Système'}
                          </span>
                        </td>
                        <td>
                          <Chip tone={meta.tone}>{meta.label}</Chip>
                        </td>
                        <td className="court" title={e.detail}>
                          {e.detail || <span className="faible">—</span>}
                        </td>
                        <td className="mono faible">{[e.city, e.device].filter(Boolean).join(' · ') || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {history && history.entries.length === 0 && <Empty>L&apos;équipe n&apos;a encore rien fait sur ce compte.</Empty>}
          </div>
        )}
      </main>

      {dialog === 'logout' && <LogoutAllDialog user={ref} onClose={() => setDialog(null)} onDone={() => done('Appareils déconnectés.')} />}
      {dialog === 'role' && (
        <RoleDialog
          user={ref}
          self={self}
          onClose={() => setDialog(null)}
          onDone={(next) => done(`${user.email} est maintenant ${ROLE_LABEL[next]}.`)}
        />
      )}
      {(dialog === 'gift-on' || dialog === 'gift-off') && (
        <GiftDialog
          user={ref}
          gifted={dialog === 'gift-on'}
          onClose={() => setDialog(null)}
          onDone={() => done(dialog === 'gift-on' ? 'Premium offert.' : 'Premium offert retiré.')}
        />
      )}
      {dialog === 'delete' && (
        <DeleteDialog
          user={ref}
          self={self}
          onClose={() => setDialog(null)}
          onDone={() => {
            toast.notify('Compte supprimé.');
            router.replace('/utilisateurs');
          }}
        />
      )}
    </>
  );
}

function CardLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className="lien"
      onClick={onClick}
      style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 12.5, fontWeight: 500 }}
    >
      {children}
    </button>
  );
}

function DeviceLine({ device }: { device: Device }) {
  return (
    <li>
      <Smartphone className="ico-appareil" aria-hidden="true" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontWeight: 500 }}>{platformLabel(device.platform)}</b>
        <span className="sous">{deviceNote(device, day)}</span>
      </span>
      {device.active ? <Chip tone="vert">Joignable</Chip> : <Chip tone="gris">Inactif</Chip>}
    </li>
  );
}

function expiryLabel(premium: PremiumDetail): string {
  if (premium.expires_at && new Date(premium.expires_at).getTime() < Date.now()) return 'Arrivé à échéance le';
  return premium.will_renew === false ? 'Se termine le' : 'Renouvellement';
}

function productLabel(product: string | null): string {
  if (!product) return '—';
  const p = product.toLowerCase();
  if (p.includes('month')) return 'Premium mensuel';
  if (p.includes('year') || p.includes('annual')) return 'Premium annuel';
  return product;
}

function PremiumCard({ premium, onToggle }: { premium: PremiumDetail; onToggle: (next: boolean) => void }) {
  const store = premium.source === 'app_store' || premium.source === 'google_play';
  return (
    <section className="carte">
      <div className="carte-t">
        <h2>Premium</h2>
        <div className="droite">{premium.active ? <Chip tone="vert">Actif</Chip> : <Chip tone="gris">Inactif</Chip>}</div>
      </div>
      {premium.source ? (
        <dl className="dl">
          <dt>Source</dt>
          <dd>{SOURCE_LONG[premium.source]}</dd>
          {premium.source !== 'gift' && (
            <>
              <dt>Formule</dt>
              <dd title={premium.product || undefined}>{productLabel(premium.product)}</dd>
              <dt>{expiryLabel(premium)}</dt>
              <dd>
                {dayYear(premium.expires_at)}
                {premium.expiring && (
                  <span style={{ marginLeft: 8 }}>
                    <Chip tone="ambre">Expire bientôt</Chip>
                  </span>
                )}
              </dd>
            </>
          )}
          {store && (
            <>
              <dt>Dernière vérification {premium.source === 'app_store' ? 'Apple' : 'Google'}</dt>
              <dd>{premium.last_verified_at ? dayTime(premium.last_verified_at) : '—'}</dd>
              <dt>{premium.transaction_kind === 'purchase_token' ? "Jeton d'achat" : "Transaction d'origine"}</dt>
              <dd className="mono">{premium.transaction || '—'}</dd>
            </>
          )}
          {premium.gifted && (
            <>
              <dt>Motif du Premium offert</dt>
              <dd>{premium.gift_note || '—'}</dd>
            </>
          )}
        </dl>
      ) : (
        <div className="carte-c">
          <p className="faible">
            {premium.active
              ? "Ce compte est Premium, mais la base ne garde la trace d'aucun achat ni d'aucun geste de l'équipe."
              : "Ce compte n'a pas de Premium."}
          </p>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--line-soft)' }}>
        <div style={{ flex: 1 }}>
          <b style={{ fontWeight: 500 }}>Premium offert</b>
          <span className="sous">Accordé à la main. La vérification quotidienne des achats ne le retire jamais.</span>
        </div>
        <Toggle checked={premium.gifted} onChange={onToggle} label="Premium offert" />
      </div>
    </section>
  );
}

function matchAlert(m: FollowedMatch): string {
  if (m.notified_start) return 'alerte envoyée';
  if (isOver(m.status)) return followStatus(m.status);
  return 'alerte au début';
}

function FollowsCard({ follows, onSeeAll }: { follows: Follows; onSeeAll: () => void }) {
  const empty = follows.matches.length === 0 && follows.tournaments.length === 0;
  return (
    <section className="carte">
      <div className="carte-t">
        <h2>Suivis</h2>
        <div className="droite">{!empty && <CardLink onClick={onSeeAll}>Tout voir</CardLink>}</div>
      </div>
      {empty ? (
        <Empty>Ce compte ne suit ni match ni tournoi.</Empty>
      ) : (
        <ul className="liste">
          {follows.matches.map((m) => (
            <li key={`m${m.id}`}>
              <Chip tone="rose">Match</Chip>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontWeight: 500 }}>{m.name || '—'}</b>
                <span className="sous">{[m.game, followStatus(m.status)].filter(Boolean).join(' · ')}</span>
              </span>
              <span className="faible">{matchAlert(m)}</span>
            </li>
          ))}
          {follows.tournaments.map((t) => (
            <li key={`t${t.id}`}>
              <Chip tone="gris">Tournoi</Chip>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontWeight: 500 }}>{t.name || '—'}</b>
                <span className="sous">{isOver(t.status) ? `${t.game} · terminé` : 'ses matchs sont ajoutés tout seuls'}</span>
              </span>
              <span className="faible">{followStatus(t.status)}</span>
            </li>
          ))}
        </ul>
      )}
      <LimitsLine follows={follows} />
    </section>
  );
}

function LimitsLine({ follows }: { follows: Follows }) {
  return (
    <div className="faible" style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)', fontSize: 12.5 }}>
      Matchs suivis à la main : {limitText(follows.match_limit, follows.unlimited)} · Tournois : {limitText(follows.tournament_limit, follows.unlimited)}
    </div>
  );
}

function FollowsTab({ follows }: { follows: Follows | undefined }) {
  if (!follows) {
    return (
      <>
        <Skeleton height={160} />
        <Skeleton height={120} />
      </>
    );
  }
  return (
    <>
      <section className="carte">
        <div className="carte-t">
          <h2>Matchs</h2>
          <div className="droite">
            <span className="faible" style={{ fontSize: 12 }}>
              {plural(follows.matches_total, 'match', 'matchs')}
            </span>
          </div>
        </div>
        <div className="box-scroll">
          <table className="tbl serre">
            <thead>
              <tr>
                <th>Match</th>
                <th>Jeu</th>
                <th>Tournoi</th>
                <th>Début</th>
                <th>État</th>
                <th>Origine</th>
                <th>Alerte de début</th>
              </tr>
            </thead>
            <tbody>
              {follows.matches.map((m: FollowedMatch) => (
                <tr key={m.id}>
                  <td className="court" title={m.name}>
                    <b style={{ fontWeight: 500 }}>{m.name || '—'}</b>
                  </td>
                  <td>{m.game || '—'}</td>
                  <td className="court faible" title={m.tournament}>
                    {m.tournament || '—'}
                  </td>
                  <td className="faible">{dayTime(m.begin_at)}</td>
                  <td>
                    <Chip tone={m.status === 'running' ? 'vert' : 'gris'}>{followStatus(m.status)}</Chip>
                  </td>
                  <td className="faible">{ORIGIN_LABEL[m.origin] || '—'}</td>
                  <td className="faible">{m.notified_start ? 'envoyée' : isOver(m.status) ? 'non envoyée' : 'à venir'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {follows.matches.length === 0 && <Empty>Ce compte ne suit aucun match.</Empty>}
      </section>

      <section className="carte">
        <div className="carte-t">
          <h2>Tournois</h2>
          <div className="droite">
            <span className="faible" style={{ fontSize: 12 }}>
              {plural(follows.tournaments_total, 'tournoi', 'tournois')}
            </span>
          </div>
        </div>
        <div className="box-scroll">
          <table className="tbl serre">
            <thead>
              <tr>
                <th>Tournoi</th>
                <th>Jeu</th>
                <th>Début</th>
                <th>Fin</th>
                <th>État</th>
                <th>Suivi depuis le</th>
              </tr>
            </thead>
            <tbody>
              {follows.tournaments.map((t: FollowedTournament) => (
                <tr key={t.id}>
                  <td className="court" title={t.name}>
                    <b style={{ fontWeight: 500 }}>{t.name || '—'}</b>
                  </td>
                  <td>{t.game || '—'}</td>
                  <td className="faible">{dayYear(t.begin_at)}</td>
                  <td className="faible">{dayYear(t.end_at)}</td>
                  <td>
                    <Chip tone={t.status === 'running' ? 'vert' : 'gris'}>{followStatus(t.status)}</Chip>
                  </td>
                  <td className="faible">{dayYear(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {follows.tournaments.length === 0 && <Empty>Ce compte ne suit aucun tournoi.</Empty>}
        <LimitsLine follows={follows} />
      </section>
    </>
  );
}
