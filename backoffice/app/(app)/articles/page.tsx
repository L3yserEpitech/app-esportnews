'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { FolderInput, Gamepad2, Plus, Search, Trash2 } from 'lucide-react';
import { api, errorMessage, fetcher } from '@/lib/api';
import { day, dayTime, num } from '@/lib/format';
import { useSession } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { Chip, ConfirmModal, Empty, FilterMenu, Modal, Pager, Skeleton, Tabs, useToast } from '@/components/ui';
import type { ArticleList, ArticleMeta, ArticleRow, ArticleStatus, GscArticles } from '@/components/articles/types';

const LIMIT = 25;

type Tab = 'all' | ArticleStatus;
type Bulk = 'game' | 'category' | 'delete';

interface BulkResult {
  changed: number;
  refused: number[];
  missing: number[];
}

const articles = (n: number) => `${num(n)} ${n > 1 ? 'articles' : 'article'}`;

export default function ArticlesPage() {
  const { can } = useSession();
  const toast = useToast();
  const canWrite = can('articles.write');

  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [gameId, setGameId] = useState<number | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [noGame, setNoGame] = useState(false);
  // The dashboard's « articles sans jeu » line lands here with the filter on.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sans_jeu') === '1') setNoGame(true);
  }, []);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<Bulk | null>(null);
  const [bulkGame, setBulkGame] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const filters = useMemo(() => {
    const p = new URLSearchParams();
    if (tab !== 'all') p.set('status', tab);
    if (query) p.set('q', query);
    if (category) p.set('category', category);
    if (noGame) p.set('no_game', '1');
    else if (gameId) p.set('game_id', String(gameId));
    if (author) p.set('author', author);
    return p.toString();
  }, [tab, query, category, gameId, author, noGame]);

  // A new selection of rows starts on its first page, with nothing ticked.
  useEffect(() => {
    setOffset(0);
    setSelected(new Set());
  }, [filters]);

  const { data: meta } = useSWR<ArticleMeta>('/articles/meta', fetcher);
  const { data, error, mutate } = useSWR<ArticleList>(`/articles?limit=${LIMIT}&offset=${offset}&${filters}`, fetcher, {
    keepPreviousData: true,
  });

  const rows = data?.articles;
  const publishedSlugs = useMemo(
    () => (rows || []).filter((a) => a.status === 'published' && a.slug).map((a) => encodeURIComponent(a.slug)),
    [rows],
  );
  // Search Console is wired by the analytics module; without it the column shows a dash.
  const { data: gsc } = useSWR<GscArticles>(
    publishedSlugs.length ? `/analytics/gsc/articles?slugs=${publishedSlugs.join(',')}` : null,
    fetcher,
    { shouldRetryOnError: false },
  );

  const gameName = useMemo(() => new Map((meta?.games || []).map((g) => [g.id, g.name])), [meta]);
  const editable = useMemo(() => (rows || []).filter((a) => a.can_edit), [rows]);
  const allSelected = editable.length > 0 && editable.every((a) => selected.has(a.id));

  const headBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = selected.size > 0 && !allSelected;
  }, [selected, allSelected]);

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await api<BulkResult>('/articles/bulk', { body: { ids: [...selected], ...body } });
      const left = res.refused.length + res.missing.length;
      const done = body.action === 'delete' ? (res.changed > 1 ? 'supprimés' : 'supprimé') : res.changed > 1 ? 'modifiés' : 'modifié';
      const text = `${articles(res.changed)} ${done}.${left ? ` ${articles(left)} laissé${left > 1 ? 's' : ''} tel${left > 1 ? 's' : ''} quel${left > 1 ? 's' : ''}.` : ''}`;
      if (res.changed === 0 && left > 0) toast.fail(text);
      else toast.notify(text);
      setBulk(null);
      setSelected(new Set());
      await mutate();
    } catch (e) {
      if ((e as { code?: string }).code !== 'reauth_cancelled') toast.fail(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const columns = canWrite ? 9 : 8;
  const counts = data?.counts;

  return (
    <>
      <PageHeader title="Articles">
        {canWrite && (
          <Link className="btn btn-p" href="/articles/nouveau">
            <Plus aria-hidden="true" />
            Nouvel article
          </Link>
        )}
      </PageHeader>
      <main className="contenu">
        <Tabs<Tab>
          label="Statut"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'Tous', count: counts?.all },
            { value: 'published', label: 'Publiés', count: counts?.published },
            { value: 'scheduled', label: 'Programmés', count: counts?.scheduled },
            { value: 'draft', label: 'Brouillons', count: counts?.draft },
          ]}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label className="inp" style={{ width: 280 }}>
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Titre, slug ou mot-clé"
              aria-label="Rechercher par titre, slug ou mot-clé"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <FilterMenu
            label="Catégorie"
            value={category}
            onChange={setCategory}
            options={(meta?.categories || []).map((c) => ({ value: c, label: c }))}
          />
          <FilterMenu
            label="Jeu"
            value={noGame ? null : gameId}
            onChange={(id) => {
              setGameId(id);
              if (id) setNoGame(false);
            }}
            options={(meta?.games || []).map((g) => ({ value: g.id, label: g.name }))}
          />
          <FilterMenu
            label="Auteur"
            value={author}
            onChange={setAuthor}
            options={(meta?.bylines || []).map((b) => ({ value: b, label: b }))}
          />
          <button
            type="button"
            className={`filtre ${noGame ? 'on' : ''}`}
            aria-pressed={noGame}
            onClick={() => {
              setNoGame((v) => !v);
              setGameId(null);
            }}
          >
            {!noGame && <Plus aria-hidden="true" />}
            Sans jeu
          </button>
          <span className="faible" style={{ marginLeft: 'auto' }}>
            Trié par date de publication
          </span>
        </div>

        <div className="box">
          {selected.size > 0 && (
            <div className="bulk" role="toolbar" aria-label="Actions sur la sélection">
              <b>
                {num(selected.size)} {selected.size > 1 ? 'sélectionnés' : 'sélectionné'}
              </b>
              <button type="button" className={bulk === 'game' ? 'on' : ''} onClick={() => setBulk('game')}>
                <Gamepad2 aria-hidden="true" />
                Attribuer un jeu
              </button>
              <button type="button" className={bulk === 'category' ? 'on' : ''} onClick={() => setBulk('category')}>
                <FolderInput aria-hidden="true" />
                Changer la catégorie
              </button>
              <button type="button" className={bulk === 'delete' ? 'on' : ''} onClick={() => setBulk('delete')}>
                <Trash2 aria-hidden="true" />
                Supprimer
              </button>
              <button type="button" style={{ marginLeft: 'auto' }} onClick={() => setSelected(new Set())}>
                Désélectionner
              </button>
            </div>
          )}
          <div className="box-scroll">
            <table className="tbl serre">
              <thead>
                <tr>
                  {canWrite && (
                    <th style={{ width: 40 }}>
                      <input
                        ref={headBox}
                        type="checkbox"
                        className="cb"
                        aria-label="Tout sélectionner"
                        checked={allSelected}
                        disabled={editable.length === 0}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(editable.map((a) => a.id)))}
                      />
                    </th>
                  )}
                  <th>Titre</th>
                  <th>Jeu</th>
                  <th>Catégorie</th>
                  <th>Auteur</th>
                  <th>Publié le</th>
                  <th className="num">Vues</th>
                  <th className="num">Clics Google · 28 j</th>
                  <th>Push</th>
                </tr>
              </thead>
              <tbody>
                {!rows &&
                  !error &&
                  [0, 1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      <td colSpan={columns}>
                        <Skeleton height={18} />
                      </td>
                    </tr>
                  ))}
                {rows?.map((a) => {
                  const picked = selected.has(a.id);
                  const clicks = a.status === 'published' && gsc?.configured ? gsc.clicks?.[a.slug]?.clicks : undefined;
                  return (
                    <tr key={a.id} className={picked ? 'sel' : ''}>
                      {canWrite && (
                        <td>
                          <input
                            type="checkbox"
                            className="cb"
                            aria-label={`Sélectionner « ${a.title || 'Sans titre'} »`}
                            checked={picked}
                            disabled={!a.can_edit}
                            title={a.can_edit ? undefined : "Vous n'êtes pas l'auteur de cet article"}
                            onChange={() => toggle(a.id)}
                          />
                        </td>
                      )}
                      <td className="titre">
                        <Link href={`/articles/${a.id}`} title={a.title}>
                          {a.title || 'Sans titre'}
                        </Link>
                      </td>
                      <td>
                        <GameCell article={a} names={gameName} loaded={Boolean(meta)} />
                      </td>
                      <td>{a.category || <span className="faible">—</span>}</td>
                      <td>{a.author || <span className="faible">—</span>}</td>
                      <WhenCell article={a} />
                      <td className={`num ${a.status === 'published' ? '' : 'faible'}`}>{a.status === 'published' ? num(a.views) : '—'}</td>
                      <td className={`num ${clicks === undefined ? 'faible' : ''}`}>{clicks === undefined ? '—' : num(clicks)}</td>
                      <td>
                        <PushCell article={a} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {error && <Empty>{errorMessage(error)}</Empty>}
          {rows && rows.length === 0 && (
            <Empty>{filters ? 'Aucun article ne correspond à cette recherche.' : "Aucun article pour l'instant."}</Empty>
          )}
        </div>

        {data && data.total > 0 && (
          <Pager
            offset={offset}
            limit={LIMIT}
            total={data.total}
            onChange={(next) => {
              setOffset(next);
              setSelected(new Set());
            }}
          />
        )}
      </main>

      {bulk === 'game' && (
        <Modal
          title={`Attribuer un jeu à ${articles(selected.size)}`}
          onClose={() => setBulk(null)}
          footer={
            <>
              <button type="button" className="btn btn-s" onClick={() => setBulk(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-p"
                disabled={busy || bulkGame === ''}
                onClick={() => void runBulk({ action: 'set_game', game_id: Number(bulkGame) })}
              >
                Attribuer
              </button>
            </>
          }
        >
          <div className="champ">
            <label htmlFor="bulk-game">Jeu</label>
            <select id="bulk-game" className="sel" value={bulkGame} onChange={(e) => setBulkGame(e.target.value)}>
              <option value="" disabled>
                Choisir un jeu
              </option>
              {(meta?.games || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value="0">Aucun jeu (retirer)</option>
            </select>
            <span className="aide">Sur le site, un article sans jeu n&apos;apparaît que lorsqu&apos;aucun jeu n&apos;est sélectionné.</span>
          </div>
        </Modal>
      )}

      {bulk === 'category' && (
        <Modal
          title={`Changer la catégorie de ${articles(selected.size)}`}
          onClose={() => setBulk(null)}
          footer={
            <>
              <button type="button" className="btn btn-s" onClick={() => setBulk(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-p"
                disabled={busy || bulkCategory === ''}
                onClick={() => void runBulk({ action: 'set_category', category: bulkCategory })}
              >
                Changer
              </button>
            </>
          }
        >
          <div className="champ">
            <label htmlFor="bulk-category">Catégorie</label>
            <select id="bulk-category" className="sel" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
              <option value="" disabled>
                Choisir une catégorie
              </option>
              {(meta?.categories || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="aide">« Actus » range l&apos;article dans les actualités du site, toute autre catégorie dans les articles.</span>
          </div>
        </Modal>
      )}

      {bulk === 'delete' && (
        <ConfirmModal
          title={`Supprimer ${articles(selected.size)}`}
          confirmLabel="Supprimer"
          danger
          busy={busy}
          onClose={() => setBulk(null)}
          onConfirm={() => void runBulk({ action: 'delete' })}
        >
          <p>
            La suppression est définitive : le texte, les versions et l&apos;adresse de chaque article disparaissent. Un article publié
            renverra une erreur 404 sur le site.
          </p>
        </ConfirmModal>
      )}
    </>
  );
}

function GameCell({ article, names, loaded }: { article: ArticleRow; names: Map<number, string>; loaded: boolean }) {
  if (article.game_id === null) return <span className="manque">Aucun jeu</span>;
  const name = names.get(article.game_id);
  if (name) return <span className="tag">{name}</span>;
  return loaded ? <span className="manque">Jeu supprimé</span> : <Skeleton width={90} height={18} />;
}

// Drafts and scheduled articles have no publication date yet: the cell says where they stand.
function WhenCell({ article }: { article: ArticleRow }) {
  if (article.status === 'published') return <td className="faible">{day(article.created_at)}</td>;
  if (article.status === 'scheduled')
    return (
      <td>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Chip tone="bleu">Programmé</Chip>
          <span className="faible">{dayTime(article.scheduled_at)}</span>
        </span>
      </td>
    );
  return (
    <td>
      <Chip tone="gris">Brouillon</Chip>
    </td>
  );
}

function PushCell({ article }: { article: ArticleRow }) {
  if (article.notified_at) return <Chip tone="vert">Envoyé</Chip>;
  if (article.status !== 'published' && article.notify_on_publish) return <Chip tone="gris">À la publication</Chip>;
  return <span className="faible">—</span>;
}
