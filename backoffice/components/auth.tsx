'use client';

import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { Copy, Download } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { Brand } from './Shell';
import { CodeInput } from './ui';

// The two-column frame of the sign-in screens: the form on the left, a card of
// explanations on the right.
export function AuthLayout({ children, aside }: { children: ReactNode; aside: { title: string; items: AsideItem[] } }) {
  return (
    <div className="auth">
      <div className="auth-form">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brand />
        </div>
        <div style={{ margin: 'auto', width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 16, padding: '32px 0' }}>
          {children}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>
          Accès réservé à l&apos;équipe d&apos;Esport News. Chaque action est enregistrée dans le journal d&apos;audit.
        </p>
      </div>
      <div className="auth-aside">
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: '#fff',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <h2 style={{ fontSize: 13.5, fontWeight: 600 }}>{aside.title}</h2>
          {aside.items.map((item) => (
            <div key={item.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ color: 'var(--muted)', marginTop: 2, display: 'inline-flex' }}>{item.icon}</span>
              <p>
                <b style={{ fontWeight: 500 }}>{item.title}</b>
                <br />
                <span style={{ color: 'var(--ink-3)' }}>{item.text}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface AsideItem {
  icon: ReactNode;
  title: string;
  text: string;
}

export function AuthTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>{title}</h1>
      {children && <p style={{ color: 'var(--ink-3)', marginTop: 4 }}>{children}</p>}
    </div>
  );
}

// Scan the QR code, type the code the app shows: the same steps whether the
// login forces them or the member starts from « Mon compte ».
export function TotpSetup({
  start,
  confirm,
  onDone,
}: {
  start: () => Promise<{ secret: string; otpauth_url: string }>;
  confirm: (code: string) => Promise<void>;
  onDone: () => void;
}) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await start();
        const qr = await QRCode.toDataURL(res.otpauth_url, { margin: 1, width: 184, errorCorrectionLevel: 'M' });
        if (!cancelled) setSetup({ secret: res.secret, qr });
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // `start` opens a new enrolment each time it runs: once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      await confirm(value);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <li>Ouvrez votre application d&apos;authentification (Google Authenticator, 1Password, Authy…).</li>
        <li>Scannez ce QR code, ou saisissez la clé à la main.</li>
        <li>Entrez le code à 6 chiffres qu&apos;elle affiche.</li>
      </ol>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 184,
            height: 184,
            border: '1px solid var(--line)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {setup ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={setup.qr} width={184} height={184} alt="QR code à scanner avec l'application d'authentification" />
          ) : (
            <span className="faible">{error ? '—' : 'Préparation…'}</span>
          )}
        </div>
        {setup && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <span className="lab">Clé de configuration</span>
            <p className="mono" style={{ wordBreak: 'break-all', marginTop: 4 }}>
              {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
            </p>
          </div>
        )}
      </div>
      <CodeInput value={code} onChange={setCode} onComplete={(c) => void submit(c)} disabled={busy || !setup} />
      {error && (
        <p className="erreur" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-p btn-lg" disabled={busy || code.length !== 6} onClick={() => void submit(code)}>
        Activer la double authentification
      </button>
    </div>
  );
}

export function BackupCodes({ codes, onDone, doneLabel }: { codes: string[]; onDone: () => void; doneLabel: string }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ color: 'var(--ink-3)' }}>
        Dix codes à usage unique, pour vous connecter sans votre téléphone. Ils ne seront plus jamais affichés : gardez-les dans
        votre gestionnaire de mots de passe.
      </p>
      <div
        className="mono"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 16px',
          padding: 14,
          border: '1px solid var(--line)',
          borderRadius: 10,
          background: 'var(--surface-2)',
          fontSize: 13,
        }}
      >
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="btn btn-s"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy aria-hidden="true" />
          {copied ? 'Copiés' : 'Copier'}
        </button>
        <a
          className="btn btn-s"
          download="esportnews-codes-de-secours.txt"
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(
            `Codes de secours du back-office Esport News\nChaque code ne sert qu'une fois.\n\n${text}\n`,
          )}`}
        >
          <Download aria-hidden="true" />
          Télécharger
        </a>
      </div>
      <button type="button" className="btn btn-p btn-lg" onClick={onDone}>
        {doneLabel}
      </button>
    </div>
  );
}
