'use client';

import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Check, Info, Plus, X } from 'lucide-react';
import { api, errorMessage, fetcher, SITE_URL } from '@/lib/api';
import { ago, until } from '@/lib/format';
import { AuthorsCard } from '@/components/team/AuthorsCard';
import { ROLE_LABEL, ROLE_TONE, useSession, type Role } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { Avatar, Chip, ConfirmModal, Empty, Menu, Modal, Skeleton, useToast } from '@/components/ui';

interface Member {
  id: number;
  name: string;
  email: string;
  role: Role;
  team_since: string | null;
  last_login_at: string | null;
  totp_enabled_at: string | null;
  totp_deadline: string | null;
  author_slug: string | null;
}

const TEAM_ROLES: Role[] = ['admin', 'editor', 'reader'];

const ROLE_HELP: Record<Role, string> = {
  admin: 'Tout le back-office, y compris les utilisateurs, l’équipe et le journal.',
  editor: 'Écrit et publie ses propres articles, voit les analytics.',
  reader: 'Consulte les analytics et la santé du système, sans rien modifier.',
  user: 'Retire l’accès au back-office. Le compte du site reste intact.',
};

type Cell = true | false | string;

// Mirrors rolePerms in backend-go/internal/backoffice/core.go.
const MATRIX: { action: string; admin: Cell; editor: Cell; reader: Cell }[] = [
  { action: 'Écrire et publier un article', admin: true, editor: 'Les siens', reader: false },
  { action: "Modifier l'article d'un autre", admin: true, editor: false, reader: false },
  { action: 'Envoyer un push à tous', admin: true, editor: 'À la publication', reader: false },
  { action: 'Voir les analytics', admin: true, editor: true, reader: true },
  { action: 'Voir la santé du système', admin: true, editor: false, reader: true },
  { action: 'Gérer les utilisateurs', admin: true, editor: false, reader: false },
  { action: "Gérer l'équipe et les rôles", admin: true, editor: false, reader: false },
  { action: "Lire le journal d'audit", admin: true, editor: false, reader: false },
];

function MatrixCell({ value }: { value: Cell }) {
  if (value === true)
    return (
      <td className="oui">
        <Check aria-label="Oui" />
      </td>
    );
  if (value === false)
    return (
      <td className="non">
        <X aria-label="Non" />
      </td>
    );
  return (
    <td>
      <span className="part">{value}</span>
    </td>
  );
}

function TotpChip({ member }: { member: Member }) {
  if (member.totp_enabled_at) return <Chip tone="vert">Activée</Chip>;
  const late = member.totp_deadline && new Date(member.totp_deadline).getTime() < Date.now();
  if (late) return <Chip tone="rouge">Exigée à la connexion</Chip>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Chip tone="ambre">À activer</Chip>
      {member.totp_deadline && <span className="faible">{until(member.totp_deadline)}</span>}
    </span>
  );
}

export default function TeamPage() {
  const { me } = useSession();
  const toast = useToast();
  const { data, error, mutate } = useSWR<{ members: Member[] }>('/team', fetcher);
  const [inviting, setInviting] = useState(false);
  const [roleOf, setRoleOf] = useState<Member | null>(null);
  const [resetOf, setResetOf] = useState<Member | null>(null);
  const [removeOf, setRemoveOf] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, done: string, close: () => void) => {
    setBusy(true);
    try {
      await fn();
      toast.notify(done);
      close();
      await mutate();
    } catch (e) {
      if ((e as { code?: string }).code !== 'reauth_cancelled') toast.fail(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const members = data?.members;

  return (
    <>
      <PageHeader title="Équipe et rôles">
        <button type="button" className="btn btn-p" onClick={() => setInviting(true)}>
          <Plus aria-hidden="true" />
          Inviter un membre
        </button>
      </PageHeader>
      <main className="contenu">
        <section className="carte">
          <div className="carte-t">
            <h2>Membres</h2>
            <div className="droite">
              <span className="faible" style={{ fontSize: 12 }}>
                {members ? `${members.length} ${members.length > 1 ? 'personnes' : 'personne'}` : ''}
              </span>
            </div>
          </div>
          <div className="box-scroll">
            <table className="tbl serre">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Rôle</th>
                  <th>Double authentification</th>
                  <th>Fiche auteur</th>
                  <th>Dernière connexion</th>
                  <th style={{ width: 46 }}>
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {!members &&
                  !error &&
                  [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td colSpan={6}>
                        <Skeleton height={18} />
                      </td>
                    </tr>
                  ))}
                {members?.map((m) => {
                  const author = m.author_slug ? `/auteurs/${m.author_slug}` : null;
                  const self = m.id === me.user.id;
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className="qui">
                          <Avatar name={m.name} team={m.role === 'admin'} />
                          <span>
                            <b style={{ fontWeight: 500 }}>
                              {m.name}
                              {self && <span className="faible"> · vous</span>}
                            </b>
                            <span className="sous">{m.email}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <Chip tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Chip>
                      </td>
                      <td>
                        <TotpChip member={m} />
                      </td>
                      <td>
                        {author ? (
                          <a className="lien" href={`${SITE_URL}${author}`} target="_blank" rel="noreferrer">
                            {author}
                          </a>
                        ) : (
                          <span className="faible">—</span>
                        )}
                      </td>
                      <td className="faible">{m.last_login_at ? ago(m.last_login_at) : 'jamais'}</td>
                      <td>
                        <Menu label={`Actions pour ${m.name}`}>
                          {(close) => (
                            <>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={self}
                                onClick={() => {
                                  close();
                                  setRoleOf(m);
                                }}
                              >
                                Changer le rôle
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  close();
                                  setResetOf(m);
                                }}
                              >
                                Réinitialiser la double authentification
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  close();
                                  void act(() => api(`/team/${m.id}/invite`, { method: 'POST' }), 'Invitation renvoyée.', () => undefined);
                                }}
                              >
                                Renvoyer l&apos;invitation
                              </button>
                              <hr />
                              <button
                                type="button"
                                role="menuitem"
                                className="danger"
                                disabled={self}
                                onClick={() => {
                                  close();
                                  setRemoveOf(m);
                                }}
                              >
                                Retirer de l&apos;équipe
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
          <div className="faible" style={{ padding: '12px 16px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Info className="ico" aria-hidden="true" />
            Sans double authentification activée, un membre ne peut pas ouvrir le back-office après son premier jour.
          </div>
        </section>

        <AuthorsCard members={members || []} onChange={() => void mutate()} />

        <section className="carte">
          <div className="carte-t">
            <h2>Ce que chaque rôle peut faire</h2>
          </div>
          <div className="box-scroll">
            <table className="mat">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Admin</th>
                  <th>Rédacteur</th>
                  <th>Lecteur</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((row) => (
                  <tr key={row.action}>
                    <td>{row.action}</td>
                    <MatrixCell value={row.admin} />
                    <MatrixCell value={row.editor} />
                    <MatrixCell value={row.reader} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onDone={(sent) => {
            setInviting(false);
            toast.notify(sent ? 'Invitation envoyée.' : "Membre ajouté, mais l'e-mail n'est pas parti : renvoyez l'invitation.");
            void mutate();
          }}
        />
      )}

      {roleOf && (
        <RoleModal
          member={roleOf}
          busy={busy}
          onClose={() => setRoleOf(null)}
          onSave={(role) =>
            act(() => api(`/team/${roleOf.id}`, { method: 'PATCH', body: { role } }), `${roleOf.name} est maintenant ${ROLE_LABEL[role]}.`, () => setRoleOf(null))
          }
        />
      )}

      {resetOf && (
        <ConfirmModal
          title="Réinitialiser la double authentification"
          confirmLabel="Réinitialiser"
          danger
          busy={busy}
          onClose={() => setResetOf(null)}
          onConfirm={() =>
            act(() => api(`/team/${resetOf.id}/reset-totp`, { method: 'POST' }), 'Double authentification réinitialisée.', () => setResetOf(null))
          }
        >
          <p>
            {resetOf.name} sera déconnecté, ses codes de secours et appareils de confiance seront effacés. Il devra reconfigurer une
            application d&apos;authentification sous 24 heures.
          </p>
        </ConfirmModal>
      )}

      {removeOf && (
        <ConfirmModal
          title="Retirer de l'équipe"
          confirmLabel="Retirer"
          danger
          busy={busy}
          onClose={() => setRemoveOf(null)}
          onConfirm={() =>
            act(() => api(`/team/${removeOf.id}`, { method: 'PATCH', body: { role: 'user' } }), `${removeOf.name} n'a plus accès au back-office.`, () => setRemoveOf(null))
          }
        >
          <p>
            {removeOf.name} perd tout accès au back-office. Son compte du site et de l&apos;application reste intact, ses articles aussi.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: (emailSent: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api<{ email_sent: boolean }>('/team/invite', { body: { email, name, role } });
      onDone(res.email_sent);
    } catch (err) {
      if ((err as { code?: string }).code !== 'reauth_cancelled') setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Inviter un membre" onClose={onClose}>
      <form id="invite" method="post" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="champ">
          <label htmlFor="inv-email">Adresse e-mail</label>
          <input id="inv-email" type="email" required placeholder="nom@esportnews.fr" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="inv-name">
            Nom <span>tel qu&apos;il signera ses articles</span>
          </label>
          <input id="inv-name" type="text" placeholder="Prénom Nom" value={name} onChange={(e) => setName(e.target.value)} />
          <span className="aide">Inutile si cette adresse a déjà un compte sur le site.</span>
        </div>
        <RoleField value={role} onChange={setRole} />
        {error && (
          <p className="erreur" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-p" disabled={busy}>
            Envoyer l&apos;invitation
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RoleField({ value, onChange, withRemoval }: { value: Role; onChange: (r: Role) => void; withRemoval?: boolean }) {
  const roles = withRemoval ? [...TEAM_ROLES, 'user' as Role] : TEAM_ROLES;
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <legend className="lab" style={{ marginBottom: 6 }}>
        Rôle
      </legend>
      {roles.map((r) => (
        <label
          key={r}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            padding: '10px 12px',
            border: `1px solid ${value === r ? 'var(--rose-line)' : 'var(--line)'}`,
            background: value === r ? 'var(--rose-bg)' : '#fff',
            borderRadius: 10,
          }}
        >
          <input type="radio" name="role" checked={value === r} onChange={() => onChange(r)} style={{ accentColor: 'var(--primary)', marginTop: 3 }} />
          <span>
            <b style={{ fontWeight: 500 }}>{r === 'user' ? "Retirer de l'équipe" : ROLE_LABEL[r]}</b>
            <span className="sous">{ROLE_HELP[r]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function RoleModal({ member, busy, onClose, onSave }: { member: Member; busy: boolean; onClose: () => void; onSave: (role: Role) => void }) {
  const [role, setRole] = useState<Role>(member.role);
  return (
    <Modal
      title={`Rôle de ${member.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-p" disabled={busy || role === member.role} onClick={() => onSave(role)}>
            Enregistrer
          </button>
        </>
      }
    >
      <RoleField value={role} onChange={setRole} />
      <p className="aide">Le changement s&apos;applique tout de suite et ferme ses sessions ouvertes.</p>
    </Modal>
  );
}
