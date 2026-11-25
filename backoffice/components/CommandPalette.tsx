'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Search, User } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { NAV } from './Shell';

interface Hit {
  key: string;
  label: string;
  hint: string;
  href: string;
  kind: 'page' | 'article' | 'user';
}

// ⌘K: jump to a screen, an article or a user account.
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { can } = useSession();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const pages = useMemo<Hit[]>(
    () =>
      NAV.flatMap((s) => s.items)
        .filter((i) => !i.perm || can(i.perm))
        .map((i) => ({ key: i.href, label: i.label, hint: 'Écran', href: i.href, kind: 'page' as const })),
    [can],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRemote([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      const found: Hit[] = [];
      try {
        const res = await api<{ articles: { id: number; title: string; status: string }[] }>(
          `/articles?limit=6&q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
        );
        for (const a of res.articles) {
          found.push({ key: `a${a.id}`, label: a.title, hint: 'Article', href: `/articles/${a.id}`, kind: 'article' });
        }
      } catch {
        // The palette still offers the screens.
      }
      if (can('users.manage')) {
        try {
          const res = await api<{ users: { id: number; email: string; name: string }[] }>(
            `/users?limit=5&q=${encodeURIComponent(q)}`,
            { signal: ctrl.signal },
          );
          for (const u of res.users) {
            found.push({ key: `u${u.id}`, label: u.email, hint: u.name || 'Utilisateur', href: `/utilisateurs/${u.id}`, kind: 'user' });
          }
        } catch {
          // Same.
        }
      }
      if (!ctrl.signal.aborted) setRemote(found);
    }, 200);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query, can]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? pages.filter((p) => p.label.toLowerCase().includes(q)) : pages;
    return [...matching, ...remote];
  }, [pages, remote, query]);

  useEffect(() => setActive(0), [query, remote.length]);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    onClose();
    router.push(hit.href);
  };

  return (
    <div
      className="voile"
      style={{ alignItems: 'flex-start', paddingTop: '12vh' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modale large" role="dialog" aria-modal="true" aria-label="Recherche">
        <div className="inp" style={{ height: 46, border: 0, borderBottom: '1px solid var(--line)', borderRadius: 0, boxShadow: 'none' }}>
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            placeholder="Un écran, un article, un utilisateur…"
            aria-label="Rechercher"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') go(hits[active]);
            }}
          />
        </div>
        <ul className="liste" style={{ maxHeight: 360, overflowY: 'auto', padding: 4 }}>
          {hits.length === 0 && <li className="faible">Aucun résultat</li>}
          {hits.map((hit, i) => (
            <li key={hit.key} style={{ padding: 0, border: 0 }}>
              <button
                type="button"
                onClick={() => go(hit)}
                onMouseEnter={() => setActive(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  border: 0,
                  borderRadius: 8,
                  background: i === active ? 'var(--surface-3)' : 'none',
                  font: 'inherit',
                  color: 'inherit',
                  textAlign: 'left',
                }}
              >
                {hit.kind === 'article' ? (
                  <FileText className="ico" aria-hidden="true" />
                ) : hit.kind === 'user' ? (
                  <User className="ico" aria-hidden="true" />
                ) : (
                  <Search className="ico" aria-hidden="true" />
                )}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hit.label}</span>
                <span className="faible" style={{ fontSize: 12 }}>
                  {hit.hint}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
