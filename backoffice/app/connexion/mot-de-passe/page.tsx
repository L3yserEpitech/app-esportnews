'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Clock, Lock } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout, AuthTitle, type AsideItem } from '@/components/auth';

const ICON = { width: 16, height: 16, strokeWidth: 1.8 } as const;

const ASIDE: AsideItem[] = [
  { icon: <Clock {...ICON} />, title: 'Lien valable 1 heure.', text: 'Il ne sert qu’une fois. Une nouvelle demande annule la précédente.' },
  {
    icon: <Lock {...ICON} />,
    title: 'Toutes les sessions sont fermées.',
    text: 'Changer le mot de passe déconnecte le back-office, le site et l’application sur tous vos appareils.',
  },
];

function Screen() {
  const token = useSearchParams().get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (token && password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setBusy(true);
    try {
      if (token) await api('/auth/reset', { anonymous: true, body: { token, password } });
      else await api('/auth/forgot', { anonymous: true, body: { email } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const backToLogin = (
    <Link className="lien" href="/connexion" style={{ alignSelf: 'center', fontSize: 12.5 }}>
      Retour à la connexion
    </Link>
  );

  if (done) {
    return (
      <AuthLayout aside={{ title: 'Mot de passe', items: ASIDE }}>
        <AuthTitle title={token ? 'Mot de passe changé' : 'Vérifiez votre boîte'}>
          {token
            ? 'Vous pouvez vous connecter avec votre nouveau mot de passe.'
            : "Si cette adresse appartient à un membre de l'équipe, un lien vient de lui être envoyé."}
        </AuthTitle>
        <Link className="btn btn-p btn-lg" href="/connexion">
          Aller à la connexion
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout aside={{ title: 'Mot de passe', items: ASIDE }}>
      <AuthTitle title={token ? 'Nouveau mot de passe' : 'Mot de passe oublié'}>
        {token ? 'Au moins 10 caractères.' : 'Indiquez votre adresse : nous vous envoyons un lien pour en choisir un nouveau.'}
      </AuthTitle>
      <form method="post" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {token ? (
          <>
            <div className="champ">
              <label htmlFor="mdp">Nouveau mot de passe</label>
              <input id="mdp" type="password" autoComplete="new-password" minLength={10} required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="champ">
              <label htmlFor="mdp2">Confirmation</label>
              <input id="mdp2" type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="champ">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" type="email" autoComplete="username" placeholder="nom@esportnews.fr" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        {error && (
          <p className="erreur" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-p btn-lg" disabled={busy}>
          {token ? 'Enregistrer' : 'Envoyer le lien'}
        </button>
      </form>
      {backToLogin}
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
