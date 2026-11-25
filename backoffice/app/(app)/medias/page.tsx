'use client';

import { useCallback, useRef, useState, type DragEvent } from 'react';
import useSWRInfinite from 'swr/infinite';
import { CloudOff, Upload, X } from 'lucide-react';
import { api, ApiError, errorMessage, fetcher } from '@/lib/api';
import { useSession } from '@/lib/session';
import { PageHeader } from '@/components/Shell';
import { Empty, Modal, Skeleton, useToast } from '@/components/ui';
import { fileName, MediaCard, type MediaItem } from '@/components/media/MediaCard';
import { acceptFor, refusal, uploadWithProgress, type MediaKind } from '@/components/media/upload';

interface Folder {
  path: string;
  label: string;
  accept: string[];
}

interface Page {
  configured: boolean;
  folder?: string;
  folders?: Folder[];
  items?: MediaItem[];
  next_cursor?: string | null;
}

interface Transfer {
  id: number;
  name: string;
  progress: number;
  error?: string;
}

const PAGE_SIZE = 60;
const R2_VARIABLES = [
  'CLOUDFLARE_R2_ENDPOINT',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
  'CLOUDFLARE_R2_PUBLIC_URL',
];

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');

export default function MediaPage() {
  const { can } = useSession();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const nextId = useRef(1);
  const [folderPath, setFolderPath] = useState('');
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [added, setAdded] = useState<MediaItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState<MediaItem | null>(null);

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<Page>(
    (index, previous) => {
      if (previous && !previous.next_cursor) return null;
      const p = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (folderPath) p.set('folder', folderPath);
      if (previous?.next_cursor) p.set('cursor', previous.next_cursor);
      return `/media?${p.toString()}`;
    },
    fetcher,
    { revalidateFirstPage: false, revalidateOnFocus: false, keepPreviousData: true },
  );

  const first = data?.[0];
  const notConnected = first?.configured === false;
  const folders = first?.folders ?? [];
  const current = folders.find((f) => f.path === (folderPath || first?.folder));
  const canUpload = Boolean(current && current.accept.length > 0);
  // While another folder loads, SWR still holds the previous one: keep its
  // pills, not its files.
  const switching = Boolean(folderPath && first?.folder && first.folder !== folderPath);
  const loaded = switching ? [] : (data?.flatMap((p) => p.items ?? []) ?? []);
  const loadedKeys = new Set(loaded.map((i) => i.key));
  // S3 lists by name: a file just sent may sit on a page not loaded yet.
  const fresh = current ? added.filter((i) => i.key.startsWith(current.path + '/') && !loadedKeys.has(i.key)) : [];
  const items = [...fresh, ...loaded];
  const hasMore = Boolean(data && !switching && data[data.length - 1].next_cursor);
  const loading = (!data && !error) || switching;
  const sending = transfers.some((t) => !t.error && t.progress < 1);

  const patch = (id: number, change: Partial<Transfer>) =>
    setTransfers((list) => list.map((t) => (t.id === id ? { ...t, ...change } : t)));

  const send = async (files: File[]) => {
    if (!current || files.length === 0) return;
    if (!canUpload) {
      toast.fail('Ce dossier se remplit depuis le site : aucun envoi ici.');
      return;
    }
    const queue = files.map((file) => ({ file, id: nextId.current++ }));
    setTransfers((list) => [
      ...list.filter((t) => t.error || t.progress < 1),
      ...queue.map(({ file, id }) => ({ id, name: file.name, progress: 0, error: refusal(file, current.accept) || undefined })),
    ]);
    let done = 0;
    for (const { file, id } of queue) {
      if (refusal(file, current.accept)) continue;
      const form = new FormData();
      form.append('folder', current.path);
      form.append('file', file);
      try {
        const res = await uploadWithProgress<{ url: string; key: string; kind: MediaKind; size: number }>('/upload/media', form, (ratio) =>
          patch(id, { progress: Math.min(ratio, 0.99) }),
        );
        patch(id, { progress: 1 });
        setAdded((list) => [{ key: res.key, url: res.url, size: res.size, kind: res.kind, last_modified: new Date().toISOString() }, ...list]);
        done++;
      } catch (e) {
        patch(id, { error: errorMessage(e) });
      }
    }
    if (done > 0) {
      toast.notify(done > 1 ? `${done} fichiers ajoutés.` : 'Fichier ajouté.');
      setTransfers((list) => list.filter((t) => t.error || t.progress < 1));
      void mutate();
    }
  };

  const copy = async (item: MediaItem) => {
    try {
      await navigator.clipboard.writeText(item.url);
      toast.notify('Adresse copiée.');
    } catch {
      toast.fail("Le navigateur a refusé la copie. Ouvrez le fichier pour copier son adresse.");
    }
  };

  const closeRemoval = useCallback(() => setRemoving(null), []);

  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void send(Array.from(e.dataTransfer.files));
  };

  return (
    <>
      <PageHeader title="Médias">
        {!notConnected && (
          <>
            <input
              ref={inputRef}
              type="file"
              hidden
              multiple
              accept={current ? acceptFor(current.accept) : undefined}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                void send(files);
              }}
            />
            <button
              type="button"
              className="btn btn-p"
              disabled={!canUpload || sending}
              title={current && !canUpload ? 'Ce dossier se remplit depuis le site' : undefined}
              onClick={() => inputRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              Ajouter des fichiers
            </button>
          </>
        )}
      </PageHeader>

      <main
        className="contenu"
        onDragEnter={(e) => {
          if (notConnected || !hasFiles(e)) return;
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => {
          if (!notConnected && hasFiles(e)) e.preventDefault();
        }}
        onDragLeave={(e) => {
          if (notConnected || !hasFiles(e)) return;
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={notConnected ? undefined : onDrop}
      >
        {notConnected ? (
          <section className="carte">
            <div className="med-absent">
              <CloudOff aria-hidden="true" />
              <h2>Le stockage des médias n&apos;est pas connecté</h2>
              <p>
                Ce serveur n&apos;a pas accès au bucket Cloudflare R2 : la médiathèque et les envois de fichiers sont à l&apos;arrêt. Renseignez
                ces variables d&apos;environnement sur le serveur, puis redémarrez-le.
              </p>
              <ul>
                {R2_VARIABLES.map((v) => (
                  <li key={v} className="mono">
                    {v}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Dossier">
              {folders.length === 0 && !error && <Skeleton width={420} height={28} />}
              {folders.map((f) => {
                const on = f.path === current?.path;
                return (
                  <button
                    key={f.path}
                    type="button"
                    className={`filtre ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      if (on) return;
                      setFolderPath(f.path);
                      void setSize(1);
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            {transfers.length > 0 && (
              <section className="carte" aria-label="Envois">
                <ul className="liste">
                  {transfers.map((t) => (
                    <li key={t.id}>
                      <span className="mono med-nom" style={{ flex: 1, minWidth: 0 }} title={t.name}>
                        {t.name}
                      </span>
                      {t.error ? (
                        <>
                          <span className="erreur" role="alert">
                            {t.error}
                          </span>
                          <button
                            type="button"
                            className="ico-btn"
                            aria-label={`Retirer ${t.name} de la liste`}
                            onClick={() => setTransfers((list) => list.filter((x) => x.id !== t.id))}
                          >
                            <X />
                          </button>
                        </>
                      ) : (
                        <>
                          <div
                            className="med-progres"
                            style={{ width: 160 }}
                            role="progressbar"
                            aria-label={`Envoi de ${t.name}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(t.progress * 100)}
                          >
                            <i style={{ width: `${Math.round(t.progress * 100)}%` }} />
                          </div>
                          <span className="faible mono" style={{ width: 40, textAlign: 'right' }}>
                            {Math.round(t.progress * 100)} %
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className={`med-depot ${dragging ? 'survol' : ''}`}>
              {dragging && (
                <div className="med-depot-msg" aria-hidden="true">
                  <Upload />
                  {canUpload ? `Déposez pour ajouter à « ${current?.label} »` : 'Ce dossier ne reçoit pas de fichier'}
                </div>
              )}

              {error && (
                <div className="box">
                  <Empty>{errorMessage(error)}</Empty>
                </div>
              )}

              {loading && (
                <ul className="med-grille" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <li key={i} className="med-carte">
                      <div className="med-vignette squelette" />
                      <div className="med-pied">
                        <Skeleton width="70%" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="box">
                  <Empty>
                    {canUpload
                      ? 'Aucun fichier dans ce dossier. Glissez des fichiers ici ou utilisez « Ajouter des fichiers ».'
                      : 'Aucun fichier dans ce dossier.'}
                  </Empty>
                </div>
              )}

              {!loading && items.length > 0 && (
                <ul className="med-grille">
                  {items.map((item) => (
                    <MediaCard
                      key={item.key}
                      item={item}
                      fresh={fresh.includes(item)}
                      onCopy={copy}
                      onDelete={can('articles.write_any') ? setRemoving : undefined}
                    />
                  ))}
                </ul>
              )}
            </div>

            {!loading && !error && items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                {hasMore && (
                  <button type="button" className="btn btn-s" disabled={isValidating} onClick={() => void setSize(size + 1)}>
                    Afficher la suite
                  </button>
                )}
                <span className="faible" style={{ fontSize: 12 }}>
                  Le stockage range les fichiers par nom : les plus récents viennent en tête de chaque série de {PAGE_SIZE}.
                  {canUpload ? ' JPG, PNG, WebP, GIF ou MP4, 10 Mo au plus par fichier.' : ''}
                </span>
              </div>
            )}
          </>
        )}
      </main>

      {removing && (
        <DeleteModal
          item={removing}
          onClose={closeRemoval}
          onDeleted={() => {
            const gone = removing.key;
            setRemoving(null);
            setAdded((list) => list.filter((i) => i.key !== gone));
            toast.notify('Média supprimé.');
            void mutate();
          }}
        />
      )}
    </>
  );
}

function DeleteModal({ item, onClose, onDeleted }: { item: MediaItem; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [refusalText, setRefusalText] = useState('');
  const [inUse, setInUse] = useState(false);
  const name = fileName(item.key);

  const confirm = async () => {
    setBusy(true);
    setRefusalText('');
    try {
      await api('/media', { method: 'DELETE', body: { url: item.url } });
      onDeleted();
    } catch (e) {
      setInUse(e instanceof ApiError && e.code === 'media_in_use');
      setRefusalText(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Supprimer ce média"
      onClose={onClose}
      footer={
        inUse ? (
          <button type="button" className="btn btn-s" onClick={onClose}>
            Fermer
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-s" onClick={onClose}>
              Annuler
            </button>
            <button type="button" className="btn btn-r" disabled={busy} onClick={() => void confirm()}>
              Supprimer
            </button>
          </>
        )
      }
    >
      <p>
        <span className="mono">{name}</span> sera effacé du stockage. Cette action est définitive : une page qui l&apos;affiche encore
        montrerait une image cassée.
      </p>
      {refusalText && (
        <p className="erreur" role="alert">
          {refusalText}
        </p>
      )}
    </Modal>
  );
}
