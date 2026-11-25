'use client';

import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { api, errorMessage, fetcher } from '@/lib/api';
import { dayTime, dayYear } from '@/lib/format';
import { ROLE_LABEL, ROLE_TONE, useSession } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { BackupCodes, TotpSetup } from '@/components/auth';
import { Chip, Modal, useToast } from '@/components/ui';

interface Device {
  id: number;
  label: string;
  created_at: string;
  expires_at: string;
}

export default function AccountPage() {
  const { me, refresh } = useSession();
  const toast = useToast();
  const { data: devices, mutate: reloadDevices } = useSWR<{ devices: Device[] }>('/account/devices', fetcher);
  const [setup, setSetup] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  const cancelled = (e: unknown) => (e as { code?: string }).code === 'reauth_cancelled';

  const regenerate = async () => {
    try {
      const res = await api<{ backup_codes: string[] }>('/account/backup-codes', { method: 'POST' });
      setCodes(res.backup_codes);
      refresh();
    } catch (e) {
      if (!cancelled(e)) toast.fail(errorMessage(e));
    }
  };

  const forget = async () => {
    try {
      await api('/account/devices', { method: 'DELETE' });
      await reloadDevices();
      toast.notify('Appareils de confiance oubliés.');
    } catch (e) {
      toast.fail(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Mon compte" chips={<Chip tone={ROLE_TONE[me.user.role]}>{ROLE_LABEL[me.user.role]}</Chip>} />
      <main className="contenu">
        <div className="grille-2" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <section className="carte">
              <div className="carte-t">
                <h2>Compte</h2>
              </div>
              <dl className="dl">
                <dt>Nom</dt>
                <dd>{me.user.name}</dd>
                <dt>Adresse e-mail</dt>
                <dd>{me.user.email}</dd>
                <dt>Session</dt>
                <dd>
                  jusqu&apos;au {dayTime(me.session.expires_at)}
                  {[me.session.city, me.session.device].filter(Boolean).length > 0 && (
                    <span className="sous">{[me.session.city, me.session.device].filter(Boolean).join(' · ')}</span>
                  )}
                </dd>
              </dl>
            </section>
            <PasswordCard />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <section className="carte">
              <div className="carte-t">
                <h2>Double authentification</h2>
                <div className="droite">{me.totp_enabled ? <Chip tone="vert">Activée</Chip> : <Chip tone="ambre">À activer</Chip>}</div>
              </div>
              <div className="carte-c">
                <p className="faible">
                  {me.totp_enabled
                    ? "Un code de votre application d'authentification est demandé à chaque nouvel appareil et avant les actions sensibles."
                    : "Obligatoire pour garder l'accès au back-office : un code de votre application d'authentification à chaque nouvel appareil."}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className={`btn ${me.totp_enabled ? 'btn-s' : 'btn-p'}`} onClick={() => setSetup(true)}>
                    {me.totp_enabled ? "Changer d'application" : 'Activer maintenant'}
                  </button>
                </div>
              </div>
              {me.totp_enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid var(--line-soft)' }}>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontWeight: 500 }}>Codes de secours</b>
                    <span className="sous">
                      {me.backup_codes_left} sur 10 encore utilisables. En générer de nouveaux annule les anciens.
                    </span>
                  </div>
                  <button type="button" className="btn btn-s" onClick={() => void regenerate()}>
                    Régénérer
                  </button>
                </div>
              )}
            </section>

            <section className="carte">
              <div className="carte-t">
                <h2>Appareils de confiance</h2>
                <div className="droite">
                  <span className="faible" style={{ fontSize: 12 }}>
                    sans code pendant 30 jours
                  </span>
                </div>
              </div>
              {devices && devices.devices.length > 0 ? (
                <>
                  <ul className="liste">
                    {devices.devices.map((d) => (
                      <li key={d.id}>
                        <span style={{ flex: 1 }}>
                          <b style={{ fontWeight: 500 }}>{d.label || 'Appareil'}</b>
                          <span className="sous">
                            ajouté le {dayYear(d.created_at)}, jusqu&apos;au {dayYear(d.expires_at)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line-soft)' }}>
                    <button type="button" className="btn btn-s" onClick={() => void forget()}>
                      Tout oublier
                    </button>
                  </div>
                </>
              ) : (
                <div className="carte-c">
                  <p className="faible">Aucun. Cochez « Faire confiance à cet appareil » en saisissant votre code à la connexion.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {setup && (
        <Modal title="Double authentification" onClose={() => setSetup(false)} wide>
          <TotpSetup
            start={() => api('/account/totp/start', { method: 'POST', body: {} })}
            confirm={async (code) => {
              const res = await api<{ backup_codes: string[] }>('/account/totp/confirm', { body: { code } });
              setCodes(res.backup_codes);
            }}
            onDone={() => {
              setSetup(false);
              refresh();
              void reloadDevices();
            }}
          />
        </Modal>
      )}

      {codes && (
        <Modal title="Vos codes de secours" onClose={() => setCodes(null)}>
          <BackupCodes codes={codes} onDone={() => setCodes(null)} doneLabel="J'ai enregistré mes codes" />
        </Modal>
      )}
    </>
  );
}

function PasswordCard() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setBusy(true);
    try {
      await api('/account/password', { body: { current, password } });
      setCurrent('');
      setPassword('');
      setConfirm('');
      toast.notify('Mot de passe changé. Le site et l’application sont déconnectés.');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="carte">
      <div className="carte-t">
        <h2>Mot de passe</h2>
      </div>
      <form method="post" className="carte-c" onSubmit={submit}>
        <div className="champ">
          <label htmlFor="mdp-actuel">Mot de passe actuel</label>
          <input id="mdp-actuel" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="mdp-nouveau">
            Nouveau mot de passe <span>10 caractères au moins</span>
          </label>
          <input id="mdp-nouveau" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="mdp-confirm">Confirmation</label>
          <input id="mdp-confirm" type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && (
          <p className="erreur" role="alert">
            {error}
          </p>
        )}
        <p className="aide">Ce compte est aussi celui du site et de l&apos;application : leurs sessions seront fermées.</p>
        <div>
          <button type="submit" className="btn btn-s" disabled={busy}>
            Changer le mot de passe
          </button>
        </div>
      </form>
    </section>
  );
}
