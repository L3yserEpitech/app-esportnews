'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api, configureApi, errorMessage, fetcher, ApiError } from './api';
import { CodeInput, Modal } from '@/components/ui';

export type Role = 'user' | 'reader' | 'editor' | 'admin';

export const ROLE_LABEL: Record<Role, string> = {
  user: 'Utilisateur',
  reader: 'Lecteur',
  editor: 'Rédacteur',
  admin: 'Admin',
};

export const ROLE_TITLE: Record<Role, string> = {
  user: 'Utilisateur',
  reader: 'Lecteur',
  editor: 'Rédacteur',
  admin: 'Administrateur',
};

export const ROLE_TONE: Record<Role, 'gris' | 'bleu' | 'rose'> = {
  user: 'gris',
  reader: 'gris',
  editor: 'bleu',
  admin: 'rose',
};

export type Perm =
  | 'articles.write'
  | 'articles.write_any'
  | 'push.broadcast'
  | 'analytics.read'
  | 'health.read'
  | 'users.manage'
  | 'team.manage'
  | 'audit.read'
  | 'media.manage'
  | 'ads.manage';

export interface Me {
  user: { id: number; name: string; email: string; avatar: string | null; role: Role };
  permissions: Perm[];
  totp_enabled: boolean;
  totp_deadline?: string;
  backup_codes_left: number;
  session: { expires_at: string; sudo_until: string; city: string; device: string };
  env: string;
  site_url: string;
}

interface SessionValue {
  me: Me;
  can: (perm: Perm) => boolean;
  refresh: () => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

// The session itself is an httpOnly cookie this code never sees. The tab only
// remembers that it was signed in, to word the return to the login screen.
const SIGNED_IN = 'bo_signed_in';

function wasSignedIn(): boolean {
  try {
    return window.sessionStorage.getItem(SIGNED_IN) === '1';
  } catch {
    return false;
  }
}

function rememberSignedIn() {
  try {
    window.sessionStorage.setItem(SIGNED_IN, '1');
  } catch {
    // Private window: the wording falls back on « connexion requise ».
  }
}

function forgetSignedIn() {
  try {
    window.sessionStorage.removeItem(SIGNED_IN);
  } catch {
    // Nothing to forget.
  }
}

// Guards every screen behind the login and owns the « confirm it's you » dialog
// that heavy actions trigger.
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [reauthOpen, setReauthOpen] = useState(false);
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const toLogin = useCallback(
    (expired: boolean) => {
      const next = pathname && pathname !== '/' ? `&suite=${encodeURIComponent(pathname)}` : '';
      router.replace(`/connexion?${expired ? 'expiree=1' : 'x=0'}${next}`);
    },
    [pathname, router],
  );

  useEffect(() => {
    configureApi({
      reauth: () =>
        new Promise<boolean>((resolve) => {
          pending.current = resolve;
          setReauthOpen(true);
        }),
      // « Session expirée » only makes sense to someone who had one in this tab.
      sessionLost: () => toLogin(wasSignedIn()),
    });
  }, [toLogin]);

  const { data: me, mutate } = useSWR<Me>('/auth/me', fetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: (err) => !(err instanceof ApiError && (err.status === 401 || err.status === 403)),
  });

  const settle = (ok: boolean) => {
    setReauthOpen(false);
    pending.current?.(ok);
    pending.current = null;
  };

  useEffect(() => {
    if (me) rememberSignedIn();
  }, [me]);

  const value = useMemo<SessionValue | null>(() => {
    if (!me) return null;
    return {
      me,
      can: (perm) => me.permissions.includes(perm),
      refresh: () => void mutate(),
      logout: async () => {
        try {
          await api('/auth/logout', { method: 'POST' });
        } catch {
          // The token is dropped either way.
        }
        forgetSignedIn();
        router.replace('/connexion');
      },
    };
  }, [me, mutate, router]);

  if (!value) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="faible">
        Chargement…
      </div>
    );
  }

  return (
    <SessionContext.Provider value={value}>
      {children}
      {reauthOpen && <ReauthModal totp={value.me.totp_enabled} onDone={settle} />}
    </SessionContext.Provider>
  );
}

function ReauthModal({ totp, onDone }: { totp: boolean; onDone: (ok: boolean) => void }) {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (value?: string) => {
    setBusy(true);
    setError('');
    try {
      await api('/auth/reauth', { body: totp ? { code: value ?? code } : { password } });
      onDone(true);
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Confirmez votre identité"
      onClose={() => onDone(false)}
      footer={
        <>
          <button type="button" className="btn btn-s" onClick={() => onDone(false)}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-p"
            disabled={busy || (totp ? code.length !== 6 : !password)}
            onClick={() => void submit()}
          >
            Confirmer
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--ink-3)' }}>
        Cette action est sensible et sera inscrite au journal d&apos;audit.{' '}
        {totp
          ? "Saisissez le code à 6 chiffres de votre application d'authentification."
          : 'Saisissez votre mot de passe.'}
      </p>
      {totp ? (
        <CodeInput value={code} onChange={setCode} onComplete={(c) => void submit(c)} autoFocus disabled={busy} />
      ) : (
        <div className="champ">
          <label htmlFor="reauth-mdp">Mot de passe</label>
          <input
            id="reauth-mdp"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password) void submit();
            }}
          />
        </div>
      )}
      {error && (
        <p className="erreur" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
