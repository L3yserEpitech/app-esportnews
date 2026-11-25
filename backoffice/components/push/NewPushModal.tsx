'use client';

import { useEffect, useId, useState } from 'react';
import useSWR from 'swr';
import { Link2, Search, X } from 'lucide-react';
import { api, ApiError, errorMessage, fetcher } from '@/lib/api';
import { Modal } from '@/components/ui';
import { AUDIENCES, MAX_PUSH_BODY, MAX_PUSH_TITLE, devices, type PushAudience, type PushEntry } from './types';

interface ArticleHit {
  id: number;
  title: string;
  slug: string;
  category: string;
}

// The backend counts characters, not UTF-16 units: an emoji is one.
const count = (s: string) => Array.from(s.trim()).length;

// The dialog refocuses whenever its onClose changes: keep this one stable.
const stay = () => undefined;

function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

function Counter({ value, max }: { value: string; max: number }) {
  const n = count(value);
  return (
    <span className={n > max ? 'push-trop' : undefined} aria-live="polite">
      {n} / {max}
    </span>
  );
}

// What the lock screen shows: app name, title in bold, then the message.
export function PushPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="push-apercu" aria-label="Aperçu de la notification">
      <span className="push-apercu-ico" aria-hidden="true">
        EN
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="push-apercu-app">
          <span>Esport News</span>
          <span>maintenant</span>
        </div>
        <b className={title.trim() ? undefined : 'faible'}>{title.trim() || 'Titre de la notification'}</b>
        <p className={body.trim() ? undefined : 'faible'}>{body.trim() || 'Le message apparaît ici.'}</p>
      </div>
    </div>
  );
}

function ArticleLink({ value, onChange }: { value: ArticleHit | null; onChange: (a: ArticleHit | null) => void }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim(), 250);
  // Built by the Articles screen's API: without it the link is simply not offered.
  const { data, error, isLoading } = useSWR<{ articles?: ArticleHit[] }>(
    !value && search.length >= 2 ? `/articles?limit=6&status=published&q=${encodeURIComponent(search)}` : null,
    fetcher,
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
  const hits = (data?.articles || []).filter((a) => a.slug);

  if (value) {
    return (
      <div className="champ">
        <span className="lab">
          Lien vers un article <span>facultatif</span>
        </span>
        <div className="push-lien">
          <Link2 className="ico" aria-hidden="true" />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value.title}</span>
          <button type="button" className="ico-btn" aria-label="Retirer le lien" onClick={() => onChange(null)}>
            <X />
          </button>
        </div>
        <span className="aide">Un appui sur la notification ouvre cet article dans l&apos;application.</span>
      </div>
    );
  }

  return (
    <div className="champ">
      <label htmlFor={inputId}>
        Lien vers un article <span>facultatif</span>
      </label>
      <div className="inp">
        <Search aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          placeholder="Chercher un article publié"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {search.length >= 2 && (
        <div className="push-resultats" role="group" aria-label="Articles trouvés">
          {isLoading && <span className="aide">Recherche…</span>}
          {error && (
            <span className="aide">
              {error instanceof ApiError && error.status === 404 ? "La recherche d'articles n'est pas disponible." : errorMessage(error)}
            </span>
          )}
          {data && hits.length === 0 && <span className="aide">Aucun article publié ne correspond.</span>}
          {hits.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                onChange(a);
                setQuery('');
              }}
            >
              <span>{a.title}</span>
              {a.category && <span className="faible">{a.category}</span>}
            </button>
          ))}
        </div>
      )}
      <span className="aide">Sans lien, un appui sur la notification ouvre simplement l&apos;application.</span>
    </div>
  );
}

export function NewPushModal({ onClose, onSent }: { onClose: () => void; onSent: (entry: PushEntry) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<PushAudience>('all');
  const [article, setArticle] = useState<ArticleHit | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const live = { refreshInterval: 30_000 };
  const counts: Record<PushAudience, number | undefined> = {
    all: useSWR<{ devices: number }>('/push/audience?audience=all', fetcher, live).data?.devices,
    ios: useSWR<{ devices: number }>('/push/audience?audience=ios', fetcher, live).data?.devices,
    android: useSWR<{ devices: number }>('/push/audience?audience=android', fetcher, live).data?.devices,
  };
  const target = counts[audience];
  const audienceLabel = AUDIENCES.find((a) => a.value === audience)?.label || '';

  const titleCount = count(title);
  const bodyCount = count(body);
  const ready =
    titleCount > 0 && titleCount <= MAX_PUSH_TITLE && bodyCount > 0 && bodyCount <= MAX_PUSH_BODY && target !== undefined && target > 0;

  const send = async () => {
    setBusy(true);
    setError('');
    try {
      const entry = await api<PushEntry>('/push/send', {
        body: { title: title.trim(), body: body.trim(), audience, article_slug: article?.slug || '' },
      });
      onSent(entry);
    } catch (e) {
      if ((e as { code?: string }).code !== 'reauth_cancelled') setError(errorMessage(e));
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <Modal
        title="Envoyer la notification"
        key="confirmer"
        onClose={busy ? stay : onClose}
        wide
        footer={
          <>
            <button type="button" className="btn btn-s" disabled={busy} onClick={() => setConfirming(false)}>
              Modifier
            </button>
            <button type="button" className="btn btn-p" disabled={busy || !ready} onClick={() => void send()}>
              {busy ? 'Envoi en cours…' : `Envoyer à ${devices(target || 0)}`}
            </button>
          </>
        }
      >
        <p>
          Cette notification part tout de suite sur <b>{devices(target || 0)}</b> ({audienceLabel.toLowerCase()}). Un envoi ne peut pas
          être rappelé et sera inscrit au journal d&apos;audit.
        </p>
        <PushPreview title={title} body={body} />
        <dl className="dl">
          <dt>Destinataires</dt>
          <dd>{audienceLabel}</dd>
          <dt>Au toucher</dt>
          <dd>{article ? `Ouvre l'article « ${article.title} »` : "Ouvre l'application"}</dd>
        </dl>
        {error && (
          <p className="erreur" role="alert">
            {error}
          </p>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      key="rediger"
      title="Nouvelle notification"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-p" disabled={!ready} onClick={() => setConfirming(true)}>
            Continuer
          </button>
        </>
      }
    >
      <div className="champ">
        <label htmlFor="push-titre">
          Titre <Counter value={title} max={MAX_PUSH_TITLE} />
        </label>
        <input
          id="push-titre"
          type="text"
          autoComplete="off"
          aria-invalid={titleCount > MAX_PUSH_TITLE}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="champ">
        <label htmlFor="push-message">
          Message <Counter value={body} max={MAX_PUSH_BODY} />
        </label>
        <textarea
          id="push-message"
          rows={3}
          aria-invalid={bodyCount > MAX_PUSH_BODY}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <fieldset className="push-audience">
        <legend className="lab">Destinataires</legend>
        {AUDIENCES.map((a) => {
          const n = counts[a.value];
          return (
            <label key={a.value} className={audience === a.value ? 'on' : undefined}>
              <input type="radio" name="push-audience" checked={audience === a.value} onChange={() => setAudience(a.value)} />
              <span>
                <b>{a.label}</b>
                <span className="sous">{n === undefined ? '—' : devices(n)}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {target === 0 && (
        <p className="erreur" role="alert">
          Aucun appareil joignable pour ces destinataires.
        </p>
      )}

      <ArticleLink value={article} onChange={setArticle} />

      <div className="champ">
        <span className="lab">Aperçu</span>
        <PushPreview title={title} body={body} />
      </div>
    </Modal>
  );
}
