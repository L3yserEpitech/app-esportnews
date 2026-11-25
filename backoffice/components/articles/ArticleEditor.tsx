'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { ExternalLink, Image as ImageIcon, Lock, X } from 'lucide-react';
import { api, errorMessage, fetcher, SITE_URL } from '@/lib/api';
import { ago, day, dayTime, dayYear, dec1, num, time } from '@/lib/format';
import { useSession } from '@/lib/session';
import { Chip, ConfirmModal, Empty, Modal, Skeleton, Toggle, useToast } from '@/components/ui';
import { RichText } from './RichText';
import {
  STATUS_LABEL,
  STATUS_TONE,
  type ArticleDetail,
  type ArticleMeta,
  type ArticleStatus,
  type ArticleVersion,
  type GscArticle,
} from './types';

const AUTOSAVE_DELAY = 2500;
const SEO_TITLE_MAX = 60;
const DESCRIPTION_TARGET = 160;

// Everything the form edits but the body, which lives in the Tiptap document.
interface Form {
  title: string;
  subtitle: string;
  tags: string[];
  featuredImage: string;
  credit: string;
  category: string;
  game_id: number | null;
  author_id: number | null;
  seo_title: string;
  description: string;
  // null on a new article: the default set in the push settings applies.
  notify_on_publish: boolean | null;
}

const formOf = (a: ArticleDetail): Form => ({
  title: a.title,
  subtitle: a.subtitle,
  tags: a.tags || [],
  featuredImage: a.featuredImage,
  credit: a.credit,
  category: a.category,
  game_id: a.game_id,
  author_id: a.author_id,
  seo_title: a.seo_title,
  description: a.description,
  notify_on_publish: a.notify_on_publish,
});

const pad = (n: number) => String(n).padStart(2, '0');
const dateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function localInstant(date: string, clock: string): Date | null {
  if (!date || !clock) return null;
  const d = new Date(`${date}T${clock}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function emptyBody(html: string): boolean {
  if (/<img|<video|<iframe|data-tweet-id/.test(html)) return false;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}

// The editor appends an empty paragraph after a closing image or heading as
// soon as it is clicked: that alone is not an edit of the article.
const bodyKey = (html: string) => html.replace(/(<p><\/p>)+$/, '');

function since(at: number): string {
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 5) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  return ago(at);
}

const siteHost = (() => {
  try {
    return new URL(SITE_URL).host.replace(/^www\./, '');
  } catch {
    return SITE_URL;
  }
})();

type Confirm = 'publish' | 'unpublish' | null;

export function ArticleEditor({ articleId }: { articleId: number | null }) {
  const { me, can } = useSession();
  const toast = useToast();

  const [id, setId] = useState<number | null>(articleId);
  const [server, setServer] = useState<ArticleDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<Form>(() => ({
    title: '',
    subtitle: '',
    tags: [],
    featuredImage: '',
    credit: '',
    category: '',
    game_id: null,
    author_id: me.user.id,
    seo_title: '',
    description: '',
    notify_on_publish: null,
  }));
  const [baseline, setBaseline] = useState<Form>(form);
  const [initialBody, setInitialBody] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [bodyRev, setBodyRev] = useState(0);
  const [bodyDirty, setBodyDirty] = useState(false);
  const body = useRef('');
  const bodySaved = useRef('');

  const [desired, setDesired] = useState<ArticleStatus>('draft');
  const [date, setDate] = useState('');
  const [clock, setClock] = useState('');

  const [saving, setSaving] = useState<'auto' | 'manual' | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [autoError, setAutoError] = useState<{ signature: string; message: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [restoring, setRestoring] = useState<ArticleVersion | null>(null);
  const [, setTick] = useState(0);

  const busy = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const { data: meta } = useSWR<ArticleMeta>('/articles/meta', fetcher);
  const { data: versions, mutate: mutateVersions } = useSWR<{ versions: ArticleVersion[] }>(
    id ? `/articles/${id}/versions` : null,
    fetcher,
  );
  const published = server?.status === 'published';
  // Search Console is wired by the analytics module: the card only shows once it answers.
  const { data: gsc } = useSWR<GscArticle>(
    published && server?.slug ? `/analytics/gsc/article?slug=${encodeURIComponent(server.slug)}` : null,
    fetcher,
    { shouldRetryOnError: false },
  );

  // Takes what the server holds as the new starting point of the form.
  const adopt = useCallback((a: ArticleDetail) => {
    const next = formOf(a);
    setServer(a);
    setId(a.id);
    setForm(next);
    setBaseline(next);
    body.current = a.article_content;
    bodySaved.current = bodyKey(a.article_content);
    setInitialBody(a.article_content);
    setEditorKey((k) => k + 1);
    setBodyRev(0);
    setBodyDirty(false);
    setDesired(a.status);
    const at = a.scheduled_at ? new Date(a.scheduled_at) : null;
    setDate(at ? dateInput(at) : '');
    setClock(at ? timeInput(at) : '');
    setAutoError(null);
  }, []);

  useEffect(() => {
    if (articleId === null) return;
    let alive = true;
    api<ArticleDetail>(`/articles/${articleId}`)
      .then((a) => alive && adopt(a))
      .catch((e) => alive && setLoadError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [articleId, adopt]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 10_000);
    return () => window.clearInterval(t);
  }, []);

  const current: ArticleStatus = server?.status ?? 'draft';
  const canEdit = server ? server.can_edit : can('articles.write');
  const canChooseAuthor = can('articles.write_any');
  const notify = form.notify_on_publish ?? meta?.notify_default ?? true;

  const scheduledAt = desired === 'scheduled' ? localInstant(date, clock) : null;
  const fieldsDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);
  const dirty = fieldsDirty || bodyDirty;
  const scheduleMoved =
    desired === 'scheduled' &&
    (current !== 'scheduled' || !scheduledAt || !server?.scheduled_at || new Date(server.scheduled_at).getTime() !== scheduledAt.getTime());
  const statusMoves = desired !== current || scheduleMoved;
  const signature = useMemo(() => `${JSON.stringify(form)}#${bodyRev}`, [form, bodyRev]);

  const title = form.title.trim() || (id ? 'Sans titre' : 'Nouvel article');
  useEffect(() => {
    document.title = `${title} · Back-office Esport News`;
  }, [title]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [form.title, server]);

  // The latest state, for the save that a timer or a click starts later.
  const latest = useRef({ form, id, bodyDirty, desired, scheduledAt, canChooseAuthor, signature });
  latest.current = { form, id, bodyDirty, desired, scheduledAt, canChooseAuthor, signature };

  const save = useCallback(
    async (mode: 'auto' | 'manual'): Promise<ArticleDetail | null> => {
      if (busy.current) return null;
      const s = latest.current;
      busy.current = true;
      setSaving(mode);
      const payload: Record<string, unknown> = {
        title: s.form.title,
        subtitle: s.form.subtitle,
        tags: s.form.tags,
        featuredImage: s.form.featuredImage,
        credit: s.form.credit,
        category: s.form.category,
        game_id: s.form.game_id ?? 0,
        seo_title: s.form.seo_title,
        description: s.form.description,
      };
      if (s.form.notify_on_publish !== null) payload.notify_on_publish = s.form.notify_on_publish;
      if (s.canChooseAuthor && s.form.author_id !== null) payload.author_id = s.form.author_id;
      // An untouched body is not sent: the server keeps the stored HTML as it is.
      const sentBody = s.id === null || s.bodyDirty ? body.current : null;
      if (sentBody !== null) payload.article_content = sentBody;
      if (mode === 'auto') {
        payload.status = 'draft';
        payload.autosave = true;
      } else {
        payload.status = s.desired;
        if (s.desired === 'scheduled' && s.scheduledAt) payload.scheduled_at = s.scheduledAt.toISOString();
      }
      try {
        const saved =
          s.id === null
            ? await api<ArticleDetail>('/articles', { body: payload })
            : await api<ArticleDetail>(`/articles/${s.id}`, { method: 'PUT', body: payload });
        setServer(saved);
        // What was sent is the new reference: what was typed during the request stays unsaved.
        setBaseline(s.form);
        if (sentBody !== null) bodySaved.current = bodyKey(sentBody);
        setBodyDirty(bodyKey(body.current) !== bodySaved.current);
        setSavedAt(Date.now());
        setAutoError(null);
        if (s.id === null) {
          setId(saved.id);
          // Same screen, new address: a reload now opens this draft.
          window.history.replaceState(null, '', `/articles/${saved.id}`);
        }
        if (mode === 'manual') {
          setDesired(saved.status);
          if (saved.status !== 'scheduled') {
            setDate('');
            setClock('');
          }
        }
        void mutateVersions();
        return saved;
      } catch (e) {
        if (mode === 'auto') setAutoError({ signature: s.signature, message: errorMessage(e) });
        else if ((e as { code?: string }).code !== 'reauth_cancelled') toast.fail(errorMessage(e));
        return null;
      } finally {
        busy.current = false;
        setSaving(null);
      }
    },
    [mutateVersions, toast],
  );

  // Drafts save themselves. A published or scheduled article only changes on the button.
  const autosaves = canEdit && current === 'draft' && form.title.trim() !== '' && (articleId === null || server !== null);
  useEffect(() => {
    if (!autosaves || !dirty || saving || autoError?.signature === signature) return;
    const t = window.setTimeout(() => void save('auto'), AUTOSAVE_DELAY);
    return () => window.clearTimeout(t);
  }, [autosaves, dirty, saving, autoError, signature, save]);

  const unsaved = canEdit && (dirty || (statusMoves && id !== null));
  useEffect(() => {
    if (!unsaved) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    // In-app links don't unload the page: ask before following one.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.origin !== window.location.origin) return;
      if (!window.confirm('Des modifications ne sont pas enregistrées. Quitter cette page ?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [unsaved]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onBodyReady = useCallback((html: string) => {
    bodySaved.current = bodyKey(html);
  }, []);

  const onBody = useCallback((html: string) => {
    body.current = html;
    setBodyRev((r) => r + 1);
    setBodyDirty(bodyKey(html) !== bodySaved.current);
  }, []);

  const commit = async () => {
    setConfirm(null);
    const was = current;
    const saved = await save('manual');
    if (!saved) return;
    if (saved.status === 'published') toast.notify(was === 'published' ? 'Article mis à jour.' : 'Article publié.');
    else if (saved.status === 'scheduled') toast.notify(`Publication programmée pour le ${dayTime(saved.scheduled_at)}.`);
    else toast.notify(was === 'published' ? 'Article retiré du site, repassé en brouillon.' : 'Brouillon enregistré.');
  };

  const onPrimary = () => {
    if (!form.title.trim()) return toast.fail('Le titre est obligatoire.');
    if (desired !== 'draft') {
      if (emptyBody(body.current)) return toast.fail('Le contenu est obligatoire pour publier.');
      if (!form.category) return toast.fail('Choisissez une catégorie avant de publier.');
    }
    if (desired === 'scheduled') {
      if (!scheduledAt) return toast.fail("Choisissez la date et l'heure de publication.");
      if (scheduleMoved && scheduledAt.getTime() <= Date.now()) return toast.fail('La date de programmation doit être dans le futur.');
    }
    if (current === 'published' && desired !== 'published') return setConfirm('unpublish');
    if (desired === 'published' && current !== 'published') return setConfirm('publish');
    void commit();
  };

  // A draft offers « Publier » next to its save button: without it, publishing
  // meant finding the status list first.
  const publishDraft = () => {
    if (!form.title.trim()) return toast.fail('Le titre est obligatoire.');
    if (emptyBody(body.current)) return toast.fail('Le contenu est obligatoire pour publier.');
    if (!form.category) return toast.fail('Choisissez une catégorie avant de publier.');
    setDesired('published');
    setConfirm('publish');
  };

  const primaryLabel =
    desired === 'draft'
      ? 'Enregistrer le brouillon'
      : desired === 'scheduled'
        ? current === 'scheduled' && !scheduleMoved
          ? 'Mettre à jour'
          : 'Programmer'
        : current === 'published'
          ? 'Mettre à jour'
          : 'Publier';

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('slug', server?.slug || '');
      data.append('type', 'image');
      const res = await api<{ url: string }>('/upload/article-cover', { form: data });
      set('featuredImage', res.url);
    } catch (e) {
      toast.fail(errorMessage(e));
    } finally {
      setUploadingCover(false);
    }
  };

  const addTag = (raw: string) => {
    const pieces = raw
      .split(',')
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (pieces.length === 0) return;
    setForm((f) => {
      const known = new Set(f.tags.map((t) => t.toLowerCase()));
      const fresh = pieces.filter((t) => !known.has(t.toLowerCase()) && known.add(t.toLowerCase()));
      return fresh.length ? { ...f, tags: [...f.tags, ...fresh] } : f;
    });
    setTagInput('');
  };

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setTagInput('');
      setAddingTag(false);
    } else if (e.key === 'Backspace' && tagInput === '' && form.tags.length > 0) {
      set('tags', form.tags.slice(0, -1));
    }
  };

  const chooseStatus = (next: ArticleStatus) => setDesired(next);

  const restore = async (version: ArticleVersion) => {
    if (!id) return;
    busy.current = true;
    setSaving('manual');
    try {
      const restored = await api<ArticleDetail>(`/articles/${id}/versions/${version.id}/restore`, { method: 'POST' });
      adopt(restored);
      setSavedAt(Date.now());
      setRestoring(null);
      setVersionsOpen(false);
      toast.notify('Version restaurée.');
      void mutateVersions();
    } catch (e) {
      if ((e as { code?: string }).code !== 'reauth_cancelled') toast.fail(errorMessage(e));
    } finally {
      busy.current = false;
      setSaving(null);
    }
  };

  if (articleId === null && !can('articles.write')) {
    return (
      <>
        <EditorHeader title="Nouvel article" />
        <main className="contenu">
          <Empty>Votre rôle ne permet pas d&apos;écrire un article.</Empty>
        </main>
      </>
    );
  }
  if (loadError) {
    return (
      <>
        <EditorHeader title="Article" />
        <main className="contenu">
          <Empty>{loadError}</Empty>
        </main>
      </>
    );
  }
  if (articleId !== null && !server) {
    return (
      <>
        <EditorHeader title="Article" />
        <main className="edition" aria-busy="true">
          <div className="edition-col">
            <Skeleton height={210} />
            <Skeleton height={48} />
            <Skeleton height={320} />
          </div>
          <div className="edition-col">
            <Skeleton height={220} />
            <Skeleton height={120} />
          </div>
        </main>
      </>
    );
  }

  const saveText = saving
    ? 'Enregistrement…'
    : autoError
      ? null
      : dirty
        ? 'Modifications non enregistrées'
        : savedAt
          ? `Enregistré ${since(savedAt)}`
          : server
            ? `Modifié ${ago(server.updated_at)}`
            : '';

  const scheduleLabel = scheduledAt
    ? `Programmé pour le ${dayTime(scheduledAt)}`
    : current === 'scheduled' && server?.scheduled_at
      ? `Programmé pour le ${dayTime(server.scheduled_at)}`
      : 'Programmer…';
  const categories = meta?.categories || [];
  const authors = meta?.authors || [];
  const authorKnown = form.author_id !== null && authors.some((a) => a.id === form.author_id);
  const list = versions?.versions || [];
  const seoTitle = form.seo_title.trim() || form.title.trim();
  const snippet = form.description.trim() || form.subtitle.trim();
  const address = server?.public_path || '';

  return (
    <>
      <EditorHeader
        title={title}
        chip={
          server ? <Chip tone={STATUS_TONE[current]}>{STATUS_LABEL[current]}</Chip> : <Chip tone="gris">Non enregistré</Chip>
        }
      >
        {autoError ? (
          <span className="erreur" role="alert">
            Enregistrement automatique impossible : {autoError.message}
          </span>
        ) : (
          <span className="faible" aria-live="polite">
            {saveText}
          </span>
        )}
        {server?.public_url && (
          <a className="btn btn-s" href={server.public_url} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            Voir sur le site
          </a>
        )}
        {canEdit && (
          <button
            type="button"
            className={`btn ${desired === 'draft' && current !== 'published' ? 'btn-s' : 'btn-p'}`}
            disabled={Boolean(saving) || (!dirty && !statusMoves && id !== null)}
            onClick={onPrimary}
          >
            {primaryLabel}
          </button>
        )}
        {canEdit && desired === 'draft' && current !== 'published' && (
          <button type="button" className="btn btn-p" disabled={Boolean(saving)} onClick={publishDraft}>
            Publier
          </button>
        )}
      </EditorHeader>

      <main className="edition">
        <div className="edition-col">
          {!canEdit && (
            <div className="bandeau">
              <Lock aria-hidden="true" />
              <span>
                {can('articles.write')
                  ? `Lecture seule : cet article est signé ${server?.author || 'un autre auteur'}. Seuls son auteur et les administrateurs peuvent le modifier.`
                  : 'Lecture seule : votre rôle ne permet pas de modifier les articles.'}
              </span>
            </div>
          )}

          <div className="couv">
            {form.featuredImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.featuredImage} alt="Image de couverture" />
            ) : (
              <>
                <ImageIcon aria-hidden="true" style={{ width: 28, height: 28 }} strokeWidth={1.6} />
                <span style={{ fontWeight: 500 }}>Image de couverture</span>
                {form.credit && <span style={{ fontSize: 12 }}>Crédit : {form.credit}</span>}
              </>
            )}
            {canEdit && (
              <div className="couv-actions">
                <button type="button" className="btn btn-s" disabled={uploadingCover} onClick={() => coverInput.current?.click()}>
                  {uploadingCover ? 'Envoi…' : form.featuredImage ? 'Remplacer' : 'Ajouter une image'}
                </button>
                {form.featuredImage && (
                  <button type="button" className="btn btn-s" onClick={() => set('featuredImage', '')}>
                    Retirer
                  </button>
                )}
              </div>
            )}
            <input
              ref={coverInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              hidden
              onChange={(e) => {
                void uploadCover(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          <div className="bloc">
            <label className="lab" htmlFor="art-credit">
              Crédit de l&apos;image
            </label>
            <input
              id="art-credit"
              className="ta"
              type="text"
              value={form.credit}
              disabled={!canEdit}
              onChange={(e) => set('credit', e.target.value)}
            />
          </div>
          {server?.videoUrl && (
            <p className="info">
              Cet article a aussi une vidéo de couverture, ajoutée hors du back-office : elle est conservée telle quelle.
            </p>
          )}

          <div className="bloc">
            <label className="lab" htmlFor="art-title">
              Titre
            </label>
            <textarea
              id="art-title"
              ref={titleRef}
              className="ta titre-article"
              rows={1}
              value={form.title}
              disabled={!canEdit}
              onChange={(e) => set('title', e.target.value.replace(/\n/g, ' '))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
            />
          </div>

          <div className="bloc">
            <label className="lab" htmlFor="art-subtitle">
              Chapô
            </label>
            <textarea
              id="art-subtitle"
              className="ta"
              style={{ color: 'var(--ink-2)' }}
              rows={3}
              value={form.subtitle}
              disabled={!canEdit}
              onChange={(e) => set('subtitle', e.target.value)}
            />
          </div>

          <RichText
            key={editorKey}
            initial={initialBody}
            editable={canEdit}
            slug={server?.slug || ''}
            onReady={onBodyReady}
            onChange={onBody}
          />

          <div className="bloc">
            <span className="lab" id="art-tags">
              Mots-clés
            </span>
            <div className="tags-edition" role="group" aria-labelledby="art-tags">
              {form.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                  {canEdit && (
                    <button type="button" aria-label={`Retirer le mot-clé ${tag}`} onClick={() => set('tags', form.tags.filter((t) => t !== tag))}>
                      <X aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))}
              {form.tags.length === 0 && !canEdit && <span className="faible">Aucun mot-clé</span>}
              {canEdit &&
                (addingTag ? (
                  <input
                    className="tag ajout"
                    autoFocus
                    aria-label="Nouveau mot-clé"
                    placeholder="Entrée pour valider"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKey}
                    onBlur={() => {
                      addTag(tagInput);
                      setAddingTag(false);
                    }}
                  />
                ) : (
                  <button type="button" className="tag ajout" onClick={() => setAddingTag(true)}>
                    + Ajouter
                  </button>
                ))}
            </div>
          </div>
        </div>

        <aside className="edition-col" aria-label="Réglages de l'article">
          <section className="carte">
            <div className="carte-t">
              <h2>Publication</h2>
            </div>
            <div className="carte-c">
              <div className="bloc">
                <label className="lab" htmlFor="art-status">
                  Statut
                </label>
                <select
                  id="art-status"
                  className="sel"
                  value={desired}
                  disabled={!canEdit}
                  onChange={(e) => chooseStatus(e.target.value as ArticleStatus)}
                >
                  <option value="draft">{current === 'published' ? 'Brouillon (retirer du site)' : 'Brouillon'}</option>
                  <option value="scheduled">{scheduleLabel}</option>
                  <option value="published">
                    {current === 'published' && server
                      ? `Publié le ${dayYear(server.created_at)} à ${time(server.created_at)}`
                      : 'Publier maintenant'}
                  </option>
                </select>
              </div>
              <div className="ligne">
                <span id="art-schedule">{current === 'draft' ? 'Programmer la publication' : 'Programmer une autre date'}</span>
                <Toggle
                  label={current === 'draft' ? 'Programmer la publication' : 'Programmer une autre date'}
                  checked={desired === 'scheduled'}
                  disabled={!canEdit}
                  onChange={(on) => chooseStatus(on ? 'scheduled' : current === 'scheduled' ? 'draft' : current)}
                />
              </div>
              {desired === 'scheduled' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="bloc">
                      <label className="lab" htmlFor="art-date">
                        Date
                      </label>
                      <input
                        id="art-date"
                        className="saisie"
                        type="date"
                        min={dateInput(new Date())}
                        value={date}
                        disabled={!canEdit}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                    <div className="bloc">
                      <label className="lab" htmlFor="art-time">
                        Heure
                      </label>
                      <input id="art-time" className="saisie" type="time" value={clock} disabled={!canEdit} onChange={(e) => setClock(e.target.value)} />
                    </div>
                  </div>
                  <p className="aide">
                    Heure de cet appareil.{' '}
                    {current === 'published'
                      ? "L'article sera retiré du site jusqu'à cette date, qui deviendra sa date de publication."
                      : "L'article sortira tout seul à cette heure, à la minute près."}
                  </p>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="bloc">
                  <label className="lab" htmlFor="art-category">
                    Catégorie
                  </label>
                  <select id="art-category" className="sel" value={form.category} disabled={!canEdit} onChange={(e) => set('category', e.target.value)}>
                    <option value="">Aucune</option>
                    {form.category && !categories.includes(form.category) && <option value={form.category}>{form.category}</option>}
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bloc">
                  <label className="lab" htmlFor="art-game">
                    Jeu
                  </label>
                  <select
                    id="art-game"
                    className="sel"
                    value={form.game_id ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => set('game_id', e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Aucun jeu</option>
                    {(meta?.games || []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bloc">
                <label className="lab" htmlFor="art-author">
                  Auteur
                </label>
                {canChooseAuthor && canEdit ? (
                  <select
                    id="art-author"
                    className="sel"
                    value={form.author_id ?? ''}
                    onChange={(e) => set('author_id', e.target.value ? Number(e.target.value) : baseline.author_id)}
                  >
                    {!authorKnown && <option value={form.author_id ?? ''}>{server?.author || 'Sans auteur'}</option>}
                    {authors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id="art-author" className="ta fixe" type="text" readOnly value={server ? server.author || '—' : me.user.name} />
                )}
              </div>
            </div>
          </section>

          <section className="carte">
            <div className="carte-t">
              <h2>Notification push</h2>
              <div className="droite">
                <PushChip article={server} notify={notify} />
              </div>
            </div>
            <div className="carte-c">
              <div className="ligne">
                <span>Notifier à la publication</span>
                <Toggle
                  label="Notifier à la publication"
                  checked={notify}
                  disabled={!canEdit || published || Boolean(server?.notified_at)}
                  onChange={(next) => set('notify_on_publish', next)}
                />
              </div>
              <p className="faible" style={{ fontSize: 12.5 }}>
                <PushSentence article={server} notify={notify} />
              </p>
            </div>
          </section>

          <section className="carte">
            <div className="carte-t">
              <h2>Référencement</h2>
            </div>
            <div className="carte-c">
              <div className="bloc">
                <label className="lab" htmlFor="art-seo-title">
                  Titre SEO{' '}
                  <span>
                    {form.seo_title.length} / {SEO_TITLE_MAX}
                  </span>
                </label>
                <input
                  id="art-seo-title"
                  className="ta"
                  type="text"
                  maxLength={SEO_TITLE_MAX}
                  value={form.seo_title}
                  disabled={!canEdit}
                  aria-describedby="art-seo-title-help"
                  onChange={(e) => set('seo_title', e.target.value)}
                />
                <div className="jauge" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, (form.seo_title.length / SEO_TITLE_MAX) * 100)}%` }} />
                </div>
                <span className="aide" id="art-seo-title-help">
                  Vide, Google reçoit le titre de l&apos;article.
                </span>
              </div>
              <div className="bloc">
                <label className="lab" htmlFor="art-description">
                  Description{' '}
                  <span style={form.description.length > DESCRIPTION_TARGET ? { color: 'var(--amber)' } : undefined}>
                    {form.description.length} / {DESCRIPTION_TARGET}
                  </span>
                </label>
                <textarea
                  id="art-description"
                  className="ta"
                  style={{ fontSize: 12.5 }}
                  rows={3}
                  value={form.description}
                  disabled={!canEdit}
                  onChange={(e) => set('description', e.target.value)}
                />
              </div>
              <div className="bloc">
                <span className="lab">Adresse</span>
                <div className="ta fixe mono" style={{ fontSize: 11.5 }}>
                  {address || 'Créée à partir du titre au premier enregistrement'}
                </div>
                {server && !published && (
                  <span className="aide">Suit le titre jusqu&apos;à la première publication, puis ne change plus. Le jour de publication s&apos;y ajoute.</span>
                )}
              </div>
              <div className="apercu-google">
                <span className="faible" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>
                  Aperçu Google
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{siteHost} › article</span>
                <span style={{ fontSize: 16, color: '#1A0DAB', lineHeight: 1.3 }}>{seoTitle || '—'}</span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                  {published && server ? `${dayYear(server.created_at)} — ` : ''}
                  {snippet || '—'}
                </span>
              </div>
            </div>
          </section>

          {gsc?.configured && (
            <section className="carte">
              <div className="carte-t">
                <h2>Google · 28 jours</h2>
                <div className="droite">
                  <span className="faible" style={{ fontSize: 12 }}>
                    Search Console
                  </span>
                </div>
              </div>
              <div className="carte-c">
                <div className="kv">
                  <div>
                    <b>{num(gsc.clicks)}</b>
                    <span>clics</span>
                  </div>
                  <div>
                    <b>{num(gsc.impressions)}</b>
                    <span>impressions</span>
                  </div>
                  <div>
                    <b>{dec1(gsc.position)}</b>
                    <span>position</span>
                  </div>
                </div>
                {gsc.queries && gsc.queries.length > 0 && (
                  <ul className="liste fine">
                    {gsc.queries.slice(0, 3).map((q) => (
                      <li key={q.query}>
                        <span>{q.query}</span>
                        <span className="faible">
                          {num(q.clicks)} {q.clicks > 1 ? 'clics' : 'clic'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          <section className="carte">
            <div className="carte-t">
              <h2>Versions</h2>
              {list.length > 0 && (
                <div className="droite">
                  <button
                    type="button"
                    className="lien"
                    style={{ fontSize: 12.5, border: 0, background: 'none', padding: 0 }}
                    onClick={() => setVersionsOpen(true)}
                  >
                    Tout voir
                  </button>
                </div>
              )}
            </div>
            {list.length > 0 ? (
              <ul className="liste fine" style={{ padding: '6px 14px 10px' }}>
                {list.slice(0, 3).map((v) => (
                  <VersionLine key={v.id} version={v} />
                ))}
              </ul>
            ) : (
              <p className="faible" style={{ padding: '10px 14px 12px', fontSize: 12.5 }}>
                {id ? 'Aucune version enregistrée depuis le back-office.' : 'Les versions apparaîtront au premier enregistrement.'}
              </p>
            )}
          </section>
        </aside>
      </main>

      {confirm === 'publish' && (
        <ConfirmModal title="Publier l'article" confirmLabel="Publier" busy={Boolean(saving)} onClose={() => setConfirm(null)} onConfirm={() => void commit()}>
          <p>L&apos;article sera visible sur le site tout de suite, daté d&apos;aujourd&apos;hui.</p>
          <p>
            {server?.notified_at
              ? 'Sa notification est déjà partie : aucune autre ne sera envoyée.'
              : notify
                ? 'Une notification push partira vers tous les appareils. Elle ne peut pas être rappelée.'
                : 'Aucune notification push ne sera envoyée.'}
          </p>
        </ConfirmModal>
      )}

      {confirm === 'unpublish' && (
        <ConfirmModal
          title="Retirer l'article du site"
          confirmLabel={desired === 'scheduled' ? 'Retirer et programmer' : 'Retirer du site'}
          danger
          busy={Boolean(saving)}
          onClose={() => setConfirm(null)}
          onConfirm={() => void commit()}
        >
          <p>
            Son adresse renverra une erreur 404{desired === 'scheduled' ? " jusqu'à la date programmée" : " tant qu'il n'est pas republié"}. À sa
            prochaine publication, sa date de publication sera celle du jour, et son adresse changera avec elle.
          </p>
        </ConfirmModal>
      )}

      {versionsOpen && (
        <Modal title="Versions de l'article" wide onClose={() => setVersionsOpen(false)}>
          <p className="faible">
            Les 30 derniers enregistrements sont gardés. Restaurer une version remet son titre, son texte, ses mots-clés, son image, son jeu,
            son auteur et son référencement ; le statut, l&apos;adresse et la date de publication ne bougent pas.
          </p>
          <ul className="liste" style={{ border: '1px solid var(--line-soft)', borderRadius: 10 }}>
            {list.map((v, i) => (
              <li key={v.id}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontWeight: 500 }}>{v.label || 'modification'}</b>
                  <span className="sous">
                    {v.actor_name || 'Système'} · {dayTime(v.created_at)}
                  </span>
                </span>
                {i === 0 ? (
                  <span className="faible" style={{ fontSize: 12 }}>
                    Dernier enregistrement
                  </span>
                ) : (
                  canEdit && (
                    <button type="button" className="btn btn-s" style={{ height: 28 }} onClick={() => setRestoring(v)}>
                      Restaurer
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {restoring && (
        <ConfirmModal
          title="Restaurer cette version"
          confirmLabel="Restaurer"
          busy={Boolean(saving)}
          onClose={() => setRestoring(null)}
          onConfirm={() => void restore(restoring)}
        >
          <p>
            L&apos;article reprend son contenu du {dayTime(restoring.created_at)} ({restoring.label || 'modification'}).
            {published ? ' Le changement est visible sur le site aussitôt.' : ''}
          </p>
          {dirty && <p className="erreur">Vos modifications non enregistrées seront perdues.</p>}
        </ConfirmModal>
      )}
    </>
  );
}

function EditorHeader({ title, chip, children }: { title: string; chip?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="top">
      <div className="fil">
        <Link href="/articles">Articles</Link>
        <span aria-hidden="true">/</span>
      </div>
      <h1 className="titre-edition">{title}</h1>
      {chip}
      {children && <div className="top-d">{children}</div>}
    </header>
  );
}

function VersionLine({ version }: { version: ArticleVersion }) {
  return (
    <li>
      <span title={`${version.actor_name || 'Système'} · ${version.label}`}>
        {version.actor_name || 'Système'} · {version.label || 'modification'}
      </span>
      <span className="faible">
        {day(version.created_at)} {time(version.created_at)}
      </span>
    </li>
  );
}

function PushChip({ article, notify }: { article: ArticleDetail | null; notify: boolean }) {
  if (article?.push.status === 'sent') return <Chip tone="vert">Envoyée</Chip>;
  if (article?.status === 'published') return <Chip tone="gris">Non envoyée</Chip>;
  return notify ? <Chip tone="bleu">À la publication</Chip> : <Chip tone="gris">Désactivée</Chip>;
}

function PushSentence({ article, notify }: { article: ArticleDetail | null; notify: boolean }) {
  const push = article?.push;
  if (push?.status === 'sent') {
    const reach =
      push.sent !== null && push.sent !== undefined
        ? ` à ${num(push.sent)} ${push.sent > 1 ? 'appareils' : 'appareil'}${
            push.delivered !== null && push.delivered !== undefined ? `, ${num(push.delivered)} ${push.delivered > 1 ? 'remises' : 'remise'}` : ''
          }`
        : '';
    return (
      <>
        Envoyée le {dayTime(push.sent_at)}
        {reach}. Une mise à jour de l&apos;article ne renvoie rien.
      </>
    );
  }
  if (article?.status === 'published') return <>Aucune notification n&apos;est partie pour cet article. Une mise à jour ne renvoie rien.</>;
  if (notify) return <>Une notification partira vers tous les appareils au moment de la publication, une seule fois.</>;
  return <>Aucune notification ne sera envoyée à la publication.</>;
}
