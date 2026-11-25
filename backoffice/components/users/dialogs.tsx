'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import { ROLE_LABEL, type Role } from '@/lib/session';
import { Modal } from '@/components/ui';
import type { UserRef } from './types';

const ROLES: Role[] = ['user', 'reader', 'editor', 'admin'];

const ROLE_HELP: Record<Role, string> = {
  user: 'Compte du site et de l’application, sans accès au back-office.',
  reader: 'Consulte les analytics et la santé du système, sans rien modifier.',
  editor: 'Écrit et publie ses propres articles, voit les analytics.',
  admin: 'Tout le back-office, y compris les utilisateurs, l’équipe et le journal.',
};

// Runs one call for a dialog: busy flag, error line, and silence when the
// member backs out of the identity check.
function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (call: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await call();
      onDone();
    } catch (e) {
      if ((e as { code?: string }).code !== 'reauth_cancelled') setError(errorMessage(e));
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function DialogForm({
  title,
  confirmLabel,
  danger,
  disabled,
  busy,
  error,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  disabled?: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy && !disabled) onSubmit();
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form method="post" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
        {error && (
          <p className="erreur" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className={`btn ${danger ? 'btn-r' : 'btn-p'}`} disabled={busy || disabled}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function LogoutAllDialog({ user, onClose, onDone }: { user: UserRef; onClose: () => void; onDone: () => void }) {
  const fieldId = useId();
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <DialogForm
      title="Déconnecter tous les appareils"
      confirmLabel="Déconnecter"
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api(`/users/${user.id}/logout-all`, { method: 'POST', body: { reason: reason.trim() } }))}
    >
      <p>
        Toutes les sessions de <b style={{ fontWeight: 600 }}>{user.email}</b> sur le site et dans l&apos;application sont fermées
        tout de suite. La personne devra se reconnecter ; son compte et ses abonnements ne changent pas.
      </p>
      <div className="champ">
        <label htmlFor={fieldId}>
          Motif <span>facultatif</span>
        </label>
        <input id={fieldId} type="text" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        <span className="aide">Inscrit au journal d&apos;audit avec votre nom.</span>
      </div>
    </DialogForm>
  );
}

export function RoleDialog({
  user,
  self,
  onClose,
  onDone,
}: {
  user: UserRef;
  self: boolean;
  onClose: () => void;
  onDone: (role: Role) => void;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const { busy, error, run } = useSubmit(() => onDone(role));
  return (
    <DialogForm
      title={`Rôle de ${user.email}`}
      confirmLabel="Enregistrer"
      disabled={self || role === user.role}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api(`/users/${user.id}/role`, { method: 'PATCH', body: { role } }))}
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend className="lab" style={{ marginBottom: 6 }}>
          Rôle
        </legend>
        {ROLES.map((r) => (
          <label
            key={r}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              padding: '10px 12px',
              border: `1px solid ${role === r ? 'var(--rose-line)' : 'var(--line)'}`,
              background: role === r ? 'var(--rose-bg)' : '#fff',
              borderRadius: 10,
            }}
          >
            <input
              type="radio"
              name="role"
              checked={role === r}
              disabled={self}
              onChange={() => setRole(r)}
              style={{ accentColor: 'var(--primary)', marginTop: 3 }}
            />
            <span>
              <b style={{ fontWeight: 500 }}>{ROLE_LABEL[r]}</b>
              <span className="sous">{ROLE_HELP[r]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="aide">
        {self
          ? 'Vous ne pouvez pas changer votre propre rôle.'
          : "Le changement s'applique tout de suite et ferme ses sessions ouvertes dans le back-office."}
      </p>
    </DialogForm>
  );
}

// Turning the gift on asks why; turning it off says what the account keeps.
export function GiftDialog({
  user,
  gifted,
  onClose,
  onDone,
}: {
  user: UserRef;
  gifted: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const fieldId = useId();
  const [note, setNote] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  return (
    <DialogForm
      title={gifted ? 'Offrir le Premium' : 'Retirer le Premium offert'}
      confirmLabel={gifted ? 'Offrir le Premium' : 'Retirer'}
      danger={!gifted}
      disabled={gifted && !note.trim()}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api(`/users/${user.id}/premium-gift`, { method: 'PUT', body: { gifted, note: note.trim() } }))}
    >
      <p>
        {gifted ? (
          <>
            <b style={{ fontWeight: 600 }}>{user.email}</b> passe en Premium sans achat. La vérification quotidienne des achats ne
            le retire jamais : il reste jusqu&apos;à ce que quelqu&apos;un de l&apos;équipe le retire ici.
          </>
        ) : (
          <>
            <b style={{ fontWeight: 600 }}>{user.email}</b> ne garde le Premium que si un abonnement App Store, Google Play ou
            Stripe est encore en cours.
          </>
        )}
      </p>
      <div className="champ">
        <label htmlFor={fieldId}>Motif {!gifted && <span>facultatif</span>}</label>
        <input
          id={fieldId}
          type="text"
          maxLength={300}
          required={gifted}
          placeholder={gifted ? 'Partenaire, gagnant d’un concours, geste commercial…' : undefined}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <span className="aide">Inscrit au journal d&apos;audit{gifted ? ' et affiché sur la fiche' : ''}.</span>
      </div>
    </DialogForm>
  );
}

export function DeleteDialog({ user, self, onClose, onDone }: { user: UserRef; self: boolean; onClose: () => void; onDone: () => void }) {
  const reasonId = useId();
  const emailId = useId();
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  const confirmed = typed.trim().toLowerCase() === user.email.trim().toLowerCase();

  if (self) {
    return (
      <Modal
        title="Supprimer le compte"
        onClose={onClose}
        footer={
          <button type="button" className="btn btn-s" onClick={onClose}>
            Fermer
          </button>
        }
      >
        <p>Vous ne pouvez pas supprimer votre propre compte depuis le back-office.</p>
      </Modal>
    );
  }

  return (
    <DialogForm
      title="Supprimer le compte"
      confirmLabel="Supprimer définitivement"
      danger
      disabled={!confirmed || !reason.trim()}
      busy={busy}
      error={error}
      onClose={onClose}
      onSubmit={() => run(() => api(`/users/${user.id}`, { method: 'DELETE', body: { reason: reason.trim() } }))}
    >
      <p>
        Le compte <b style={{ fontWeight: 600 }}>{user.email}</b> est effacé pour de bon, avec ses appareils, ses matchs et tournois
        suivis et ses sessions. Rien ne permet de revenir en arrière. Un abonnement en cours (App Store, Google Play, Stripe)
        n&apos;est pas résilié par cette suppression.
      </p>
      <div className="champ">
        <label htmlFor={reasonId}>Motif</label>
        <textarea id={reasonId} rows={2} maxLength={300} required value={reason} onChange={(e) => setReason(e.target.value)} />
        <span className="aide">
          Conservé avec la date de suppression et inscrit au journal. N&apos;y écrivez ni nom ni adresse : c&apos;est tout ce qui reste
          du compte.
        </span>
      </div>
      <div className="champ">
        <label htmlFor={emailId}>Pour confirmer, saisissez l&apos;adresse e-mail du compte</label>
        <input
          id={emailId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-invalid={typed !== '' && !confirmed}
        />
      </div>
    </DialogForm>
  );
}
