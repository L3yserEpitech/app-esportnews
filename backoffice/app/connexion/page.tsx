'use client';

import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Clock, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout, AuthTitle, BackupCodes, TotpSetup, type AsideItem } from '@/components/auth';
import { CodeInput } from '@/components/ui';

type Step =
  | { name: 'credentials' }
  | { name: 'totp'; challenge: string; email: string }
  | { name: 'backup'; challenge: string; email: string }
  | { name: 'enroll'; challenge: string; email: string }
  | { name: 'codes'; codes: string[] };

interface LoginResult {
  step: 'done' | 'totp' | 'enroll';
  challenge?: string;
  email?: string;
  backup_codes?: string[];
}

const ICON = { width: 16, height: 16, strokeWidth: 1.8 } as const;

const SECURITY: AsideItem[] = [
  {
    icon: <Lock {...ICON} />,
    title: 'Double authentification obligatoire.',
    text: "Un code de votre application d'authentification à chaque nouvel appareil.",
  },
  {
    icon: <Clock {...ICON} />,
    title: 'Session de 12 heures.',
    text: 'Reconnexion demandée avant une action lourde : suppression de compte, changement de rôle, push à tous.',
  },
  {
    icon: <ShieldCheck {...ICON} />,
    title: "Comptes d'équipe uniquement.",
    text: "Un compte utilisateur du site ou de l'app n'ouvre pas le back-office.",
  },
];

const NO_CODE: AsideItem[] = [
  {
    icon: <KeyRound {...ICON} />,
    title: 'Codes de secours.',
    text: "Dix codes à usage unique, donnés à l'activation de la double authentification.",
  },
  {
    icon: <UserCheck {...ICON} />,
    title: 'Un autre administrateur',
    text: "peut réinitialiser votre double authentification depuis Équipe et rôles. L'action est journalisée.",
  },
];

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (res: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

// `suite` comes from the URL: it may only lead back into the back-office. The
// browser resolves it, so `//host`, `/\host` and friends are judged as it would
// follow them, not as they are spelled.
function sameOriginPath(raw: string): string {
  try {
    const target = new URL(raw, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname.startsWith('/connexion')) return '/';
    return target.pathname + target.search + target.hash;
  } catch {
    return '/';
  }
}

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('suite') || '/';
  const [step, setStep] = useState<Step>({ name: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState('');
  const [trust, setTrust] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lost, setLost] = useState(false);
  const [googleId, setGoogleId] = useState('');
  const city = useRef('');
  const googleSlot = useRef<HTMLDivElement>(null);

  const enter = useCallback(() => {
    router.replace(sameOriginPath(next));
  }, [next, router]);

  // Already signed in (the cookie says so, not this page): straight in.
  useEffect(() => {
    if (params.get('expiree')) return;
    api('/auth/me', { anonymous: true })
      .then(() => enter())
      .catch(() => undefined);
  }, [enter, params]);

  useEffect(() => {
    fetch('/api/geo')
      .then((r) => r.json())
      .then((d: { city?: string }) => {
        city.current = d.city || '';
      })
      .catch(() => undefined);
    api<{ google_client_id: string }>('/auth/config', { anonymous: true })
      .then((c) => setGoogleId(c.google_client_id || ''))
      .catch(() => undefined);
  }, []);

  const headers = () => (city.current ? { 'X-BO-City': city.current } : undefined);

  const handle = useCallback(
    (res: LoginResult) => {
      setError('');
      setCode('');
      if (res.step === 'done') {
        if (res.backup_codes) setStep({ name: 'codes', codes: res.backup_codes });
        else enter();
      } else if (res.step === 'totp' && res.challenge) {
        setStep({ name: 'totp', challenge: res.challenge, email: res.email || '' });
      } else if (res.step === 'enroll' && res.challenge) {
        setStep({ name: 'enroll', challenge: res.challenge, email: res.email || '' });
      }
    },
    [enter],
  );

  const run = async (fn: () => Promise<LoginResult>) => {
    setBusy(true);
    setError('');
    try {
      handle(await fn());
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  // Google renders its own button; it only appears once a client ID is configured.
  useEffect(() => {
    if (!googleId || step.name !== 'credentials') return;
    const mount = () => {
      if (!window.google || !googleSlot.current) return;
      window.google.accounts.id.initialize({
        client_id: googleId,
        callback: (res) =>
          void run(() =>
            api<LoginResult>('/auth/google', {
              anonymous: true,
              headers: headers(),
              body: { credential: res.credential },
            }),
          ),
      });
      googleSlot.current.replaceChildren();
      window.google.accounts.id.renderButton(googleSlot.current, {
        theme: 'outline',
        size: 'large',
        width: 380,
        text: 'continue_with',
        locale: 'fr',
      });
    };
    if (window.google) {
      mount();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = mount;
    document.head.appendChild(script);
    // `run` and `headers` only close over refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleId, step.name]);

  const submitCredentials = (e: FormEvent) => {
    e.preventDefault();
    void run(() =>
      api<LoginResult>('/auth/login', {
        anonymous: true,
        headers: headers(),
        body: { email, password },
      }),
    );
  };

  const back = (
    <button
      type="button"
      className="lien"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ink-3)', background: 'none', border: 0, padding: 0, alignSelf: 'flex-start', font: 'inherit', fontWeight: 500, fontSize: 12.5 }}
      onClick={() => {
        setStep({ name: 'credentials' });
        setError('');
        setLost(false);
      }}
    >
      <ChevronLeft style={{ width: 15, height: 15 }} aria-hidden="true" />
      Retour
    </button>
  );

  const alert = error && (
    <p className="erreur" role="alert">
      {error}
    </p>
  );

  if (step.name === 'credentials') {
    return (
      <AuthLayout aside={{ title: 'Sécurité du back-office', items: SECURITY }}>
        <AuthTitle title="Connexion">Back-office d&apos;Esport News</AuthTitle>
        {params.get('expiree') && !error && (
          <p className="bandeau" role="status">
            Votre session a expiré. Reconnectez-vous.
          </p>
        )}
        {googleId && (
          <>
            <div ref={googleSlot} style={{ minHeight: 40 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 12 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              ou
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>
          </>
        )}
        <form method="post" onSubmit={submitCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="champ">
            <label htmlFor="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              placeholder="nom@esportnews.fr"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="champ">
            <label htmlFor="mdp">Mot de passe</label>
            <input
              id="mdp"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {alert}
          <button type="submit" className="btn btn-p btn-lg" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
        <Link className="lien" href="/connexion/mot-de-passe" style={{ alignSelf: 'center', fontSize: 12.5 }}>
          Mot de passe oublié
        </Link>
      </AuthLayout>
    );
  }

  if (step.name === 'totp') {
    const verify = (value: string) =>
      void run(() =>
        api<LoginResult>('/auth/totp', { anonymous: true, body: { challenge: step.challenge, code: value, trust_device: trust } }),
      );
    return (
      <AuthLayout aside={{ title: 'Pas de code sous la main ?', items: NO_CODE }}>
        {back}
        <AuthTitle title="Code de vérification">
          Saisissez le code à 6 chiffres affiché par votre application d&apos;authentification pour {step.email}.
        </AuthTitle>
        <CodeInput value={code} onChange={setCode} onComplete={verify} autoFocus disabled={busy} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink-2)' }}>
          <input type="checkbox" className="cb" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
          Faire confiance à cet appareil pendant 30 jours
        </label>
        {alert}
        <button type="button" className="btn btn-p btn-lg" disabled={busy || code.length !== 6} onClick={() => verify(code)}>
          Vérifier
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
          <button
            type="button"
            className="lien"
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 500 }}
            onClick={() => {
              setError('');
              setStep({ name: 'backup', challenge: step.challenge, email: step.email });
            }}
          >
            Utiliser un code de secours
          </button>
          <button
            type="button"
            className="lien"
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 500, color: 'var(--ink-3)' }}
            onClick={() => setLost((v) => !v)}
          >
            Appareil perdu
          </button>
        </div>
        {lost && (
          <p className="aide" role="status">
            Sans téléphone ni code de secours, demandez à un administrateur de réinitialiser votre double authentification depuis
            « Équipe et rôles ». Vous la reconfigurerez à la connexion suivante.
          </p>
        )}
      </AuthLayout>
    );
  }

  if (step.name === 'backup') {
    return (
      <AuthLayout aside={{ title: 'Pas de code sous la main ?', items: NO_CODE }}>
        {back}
        <AuthTitle title="Code de secours">
          Saisissez l&apos;un des dix codes reçus à l&apos;activation de la double authentification. Il ne servira qu&apos;une fois.
        </AuthTitle>
        <form
          method="post"
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api<LoginResult>('/auth/backup', { anonymous: true, body: { challenge: step.challenge, code: backup } }));
          }}
        >
          <div className="champ">
            <label htmlFor="secours">Code de secours</label>
            <input
              id="secours"
              type="text"
              className="mono"
              placeholder="xxxxx-xxxxx"
              autoComplete="off"
              autoFocus
              value={backup}
              onChange={(e) => setBackup(e.target.value)}
            />
          </div>
          {alert}
          <button type="submit" className="btn btn-p btn-lg" disabled={busy || backup.trim().length < 10}>
            Vérifier
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (step.name === 'enroll') {
    return (
      <AuthLayout aside={{ title: 'Sécurité du back-office', items: SECURITY }}>
        {back}
        <AuthTitle title="Activez la double authentification">
          Elle est obligatoire pour ouvrir le back-office avec {step.email}.
        </AuthTitle>
        <TotpSetup
          start={() => api('/auth/enroll/start', { anonymous: true, body: { challenge: step.challenge } })}
          confirm={async (value) => {
            const res = await api<LoginResult>('/auth/enroll/confirm', {
              anonymous: true,
              body: { challenge: step.challenge, code: value },
            });
            handle(res);
          }}
          onDone={() => undefined}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout aside={{ title: 'Pas de code sous la main ?', items: NO_CODE }}>
      <AuthTitle title="Vos codes de secours">La double authentification est activée.</AuthTitle>
      <BackupCodes codes={step.codes} onDone={enter} doneLabel="J'ai enregistré mes codes" />
    </AuthLayout>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
