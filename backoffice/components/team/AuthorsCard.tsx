'use client';

import { useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { Plus } from 'lucide-react';
import { api, errorMessage, fetcher, SITE_URL } from '@/lib/api';
import { ConfirmModal, Empty, Menu, Modal, Skeleton, useToast } from '@/components/ui';

export interface Author {
  slug: string;
  name: string;
  aliases: string[];
  user_id?: number;
}

interface Member {
  id: number;
  name: string;
}

// The author pages of the site (/auteurs/<slug>): who has one, under which
// spellings their articles are signed, and which team account it belongs to.
export function AuthorsCard({ members, onChange }: { members: Member[]; onChange: () => void }) {
  const toast = useToast();
  const { data, error, mutate } = useSWR<{ authors: Author[] }>('/authors', fetcher);
  const [editing, setEditing] = useState<Author | 'new' | null>(null);
  const [removing, setRemoving] = useState<Author | null>(null);
  const [busy, setBusy] = useState(false);

  const done = async (message: string) => {
    toast.notify(message);
    setEditing(null);
    setRemoving(null);
    await mutate();
    onChange();
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/authors/${removing.slug}`, { method: 'DELETE' });
      await done('Fiche auteur supprimée.');
    } catch (e) {
      toast.fail(errorMessage(e));
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  const authors = data?.authors;
  const memberName = (id?: number) => members.find((m) => m.id === id)?.name;

  return (
    <section className="carte">
      <div className="carte-t">
        <h2>Fiches auteur</h2>
        <div className="droite">
          <span className="faible" style={{ fontSize: 12 }}>
            pages /auteurs du site
          </span>
          <button type="button" className="btn btn-s" style={{ height: 28 }} onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            Nouvelle fiche
          </button>
        </div>
      </div>
      <div className="box-scroll">
        <table className="tbl serre">
          <thead>
            <tr>
              <th>Nom affiché</th>
              <th>Page</th>
              <th>Autres signatures</th>
              <th>Compte d&apos;équipe</th>
              <th style={{ width: 46 }}>
                <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!authors && !error && (
              <tr>
                <td colSpan={5}>
                  <Skeleton height={18} />
                </td>
              </tr>
            )}
            {authors?.map((a) => (
              <tr key={a.slug}>
                <td>
                  <b style={{ fontWeight: 500 }}>{a.name}</b>
                </td>
                <td>
                  <a className="lien" href={`${SITE_URL}/auteurs/${a.slug}`} target="_blank" rel="noreferrer">
                    /auteurs/{a.slug}
                  </a>
                </td>
                <td className="faible">{a.aliases.length > 0 ? a.aliases.join(', ') : '—'}</td>
                <td>{memberName(a.user_id) || <span className="faible">—</span>}</td>
                <td>
                  <Menu label={`Actions pour la fiche de ${a.name}`}>
                    {(close) => (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            close();
                            setEditing(a);
                          }}
                        >
                          Modifier
                        </button>
                        <hr />
                        <button
                          type="button"
                          role="menuitem"
                          className="danger"
                          onClick={() => {
                            close();
                            setRemoving(a);
                          }}
                        >
                          Supprimer
                        </button>
                      </>
                    )}
                  </Menu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <Empty>{errorMessage(error)}</Empty>}
      {authors && authors.length === 0 && <Empty>Aucune fiche auteur.</Empty>}

      {editing && (
        <AuthorModal
          author={editing === 'new' ? null : editing}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={() => void done(editing === 'new' ? 'Fiche auteur créée.' : 'Fiche auteur enregistrée.')}
        />
      )}
      {removing && (
        <ConfirmModal title="Supprimer la fiche auteur" confirmLabel="Supprimer" danger busy={busy} onClose={() => setRemoving(null)} onConfirm={() => void remove()}>
          <p>
            La page /auteurs/{removing.slug} disparaîtra du site. La suppression est refusée tant que des articles portent cette
            signature.
          </p>
        </ConfirmModal>
      )}
    </section>
  );
}

function AuthorModal({
  author,
  members,
  onClose,
  onSaved,
}: {
  author: Author | null;
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(author?.name || '');
  const [aliases, setAliases] = useState((author?.aliases || []).join('\n'));
  const [userId, setUserId] = useState<number>(author?.user_id || 0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { name, aliases: aliases.split('\n').map((a) => a.trim()).filter(Boolean), user_id: userId };
    try {
      if (author) await api(`/authors/${author.slug}`, { method: 'PUT', body });
      else await api('/authors', { body });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={author ? `Fiche de ${author.name}` : 'Nouvelle fiche auteur'} onClose={onClose}>
      <form method="post" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="champ">
          <label htmlFor="auteur-nom">
            Nom affiché <span>sur les articles et sa page</span>
          </label>
          <input id="auteur-nom" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          {!author && <span className="aide">L&apos;adresse de la page est tirée de ce nom et ne change plus ensuite.</span>}
        </div>
        <div className="champ">
          <label htmlFor="auteur-alias">
            Autres signatures <span>une par ligne</span>
          </label>
          <textarea id="auteur-alias" rows={3} value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="Samuel C" />
          <span className="aide">Les graphies déjà présentes sur d&apos;anciens articles. Ils sont rattachés à cette fiche.</span>
        </div>
        <div className="champ">
          <label htmlFor="auteur-compte">Compte d&apos;équipe</label>
          <select id="auteur-compte" value={userId} onChange={(e) => setUserId(Number(e.target.value))}>
            <option value={0}>Aucun</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <span className="aide">Ce membre peut modifier les articles signés de cette fiche.</span>
        </div>
        {error && (
          <p className="erreur" role="alert">
            {error}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-s" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-p" disabled={busy}>
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}
