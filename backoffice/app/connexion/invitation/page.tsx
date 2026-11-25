'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, ShieldCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout, AuthTitle, type AsideItem } from '@/components/auth';
import { ROLE_LABEL, type Role } from '@/lib/session';

const ICON = { width: 16, height: 16, strokeWidth: 1.8 } as const;

const ASIDE: AsideItem[] = [
  {
    icon: <Lock {...ICON} />,
    title: 'Double authentification obligatoire.',
    text: 'Elle vous sera demandée à la première connexion, ou au plus tard dans les 24 heures.',
  },
  {
    icon: <ShieldCheck {...ICON} />,
    title: 'Un seul compte.',
    text: "C'est aussi celui du site et de l'application : le mot de passe choisi ici vaut partout.",
  },
];

function Screen() {
  const token = useSearchParams().get('token') || '';
  const [invite, setInvite] = useState<{ email: string; name: string; role: Role } | null>(null);
  const [invalid, setInvalid] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ email: string; name: string; role: Role }>(`/auth/invite?token=${encodeURIComponent(token)}`, { anonymous: true })
      .then(setInvite)
      .catch((e) => setInvalid(errorMessage(e)));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/auth/invite', { anonymous: true, body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (invalid) {
    return (
      <AuthLayout aside={{ title: 'Votre accès', items: ASIDE }}>
        <AuthTitle title="Invitation expirée">{invalid} Demandez à un administrateur de vous la renvoyer.</AuthTitle>
        <Link className="btn btn-s btn-lg" href="/connexion">
          Aller à la connexion
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout aside={{ title: 'Votre accès', items: ASIDE }}>
        <AuthTitle title="Mot de passe enregistré">Connectez-vous pour configurer la double authentification.</AuthTitle>
        <Link className="btn btn-p btn-lg" href="/connexion">
          Se connecter
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout aside={{ title: 'Votre accès', items: ASIDE }}>
      <AuthTitle title="Bienvenue dans l'équipe">
        {invite ? `${invite.name}, choisissez le mot de passe de ${invite.email} (rôle ${ROLE_LABEL[invite.role]}).` : 'Vérification de l’invitation…'}
      </AuthTitle>
      {invite && (
        <form method="post" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="champ">
            <label htmlFor="mdp">
              Mot de passe <span>10 caractères au moins</span>
            </label>
            <input id="mdp" type="password" autoComplete="new-password" minLength={10} required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="mdp2">Confirmation</label>
            <input id="mdp2" type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && (
            <p className="erreur" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-p btn-lg" disabled={busy}>
            Enregistrer
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
}
