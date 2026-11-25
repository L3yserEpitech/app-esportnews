'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import {
  Activity,
  Bell,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LineChart,
  ListTree,
  Megaphone,
  Menu as MenuIcon,
  Search,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { fetcher } from '@/lib/api';
import { ROLE_TITLE, useSession, type Perm } from '@/lib/session';
import { until } from '@/lib/format';
import { Avatar, Dot, Menu } from './ui';
import { CommandPalette } from './CommandPalette';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: Perm;
  badge?: 'articles' | 'health' | 'push';
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Pilotage',
    items: [
      { href: '/', label: 'Tableau de bord', icon: LayoutDashboard },
      { href: '/sante', label: 'Santé du système', icon: Activity, perm: 'health.read', badge: 'health' },
    ],
  },
  {
    group: 'Contenu',
    items: [
      { href: '/articles', label: 'Articles', icon: FileText, badge: 'articles' },
      { href: '/medias', label: 'Médias', icon: ImageIcon, perm: 'media.manage' },
      { href: '/publicites', label: 'Publicités', icon: Megaphone, perm: 'ads.manage' },
    ],
  },
  {
    group: 'Audience',
    items: [
      { href: '/analytics', label: 'Analytics', icon: LineChart, perm: 'analytics.read' },
      { href: '/utilisateurs', label: 'Utilisateurs', icon: Users, perm: 'users.manage' },
      { href: '/notifications', label: 'Notifications push', icon: Bell, badge: 'push' },
    ],
  },
  {
    group: 'Système',
    items: [
      { href: '/equipe', label: 'Équipe et rôles', icon: ShieldCheck, perm: 'team.manage' },
      { href: '/journal', label: "Journal d'audit", icon: ListTree, perm: 'audit.read' },
    ],
  },
];

interface NavSummary {
  articles: number;
  health_alerts: number | null;
  push_alerts: number | null;
}

function isCurrent(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const { me, can, logout } = useSession();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const { data: summary } = useSWR<NavSummary>('/nav', fetcher, { refreshInterval: 120_000 });

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const badge = (kind: NavItem['badge']) => {
    if (!summary || !kind) return null;
    if (kind === 'articles') return <span className="nav-count">{summary.articles.toLocaleString('fr-FR')}</span>;
    const n = kind === 'health' ? summary.health_alerts : summary.push_alerts;
    return n ? <span className="nav-count alerte">{n}</span> : null;
  };

  const production = me.env === 'production';

  return (
    <div className="bo">
      <aside className={`side ${open ? 'ouvert' : ''}`} aria-label="Navigation">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px 6px 4px' }}>
          <Brand />
        </div>
        <button
          type="button"
          onClick={() => setPalette(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 34,
            padding: '0 8px 0 10px',
            borderRadius: 8,
            background: '#fff',
            border: '1px solid var(--line)',
            color: 'inherit',
            font: 'inherit',
            textAlign: 'left',
          }}
        >
          <Search style={{ width: 15, height: 15 }} aria-hidden="true" />
          <span style={{ flex: 1 }}>Rechercher</span>
          <span
            style={{
              font: '500 11px/1 var(--font-inter), sans-serif',
              color: 'var(--muted)',
              border: '1px solid var(--line)',
              borderRadius: 5,
              padding: '3px 5px',
              background: 'var(--surface-2)',
            }}
          >
            ⌘ K
          </span>
        </button>
        <nav className="nav">
          {NAV.map((section) => {
            const items = section.items.filter((i) => !i.perm || can(i.perm));
            if (items.length === 0) return null;
            return (
              <div key={section.group} style={{ display: 'contents' }}>
                <span className="nav-group">{section.group}</span>
                {items.map((item) => (
                  <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}>
                    <item.icon strokeWidth={1.8} aria-hidden="true" />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {badge(item.badge)}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 6px 2px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <Avatar name={me.user.name} team size={30} />
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
            <b style={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {me.user.name}
            </b>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ROLE_TITLE[me.user.role]}</span>
          </div>
          <Menu label="Menu personnel" up>
            {(close) => (
              <>
                <Link href="/compte" role="menuitem" onClick={close}>
                  Mon compte et sécurité
                </Link>
                <hr />
                <button type="button" role="menuitem" onClick={() => void logout()}>
                  Se déconnecter
                </button>
              </>
            )}
          </Menu>
        </div>
      </aside>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(24,24,27,.35)', zIndex: 44 }}
          aria-hidden="true"
        />
      )}

      <div className="main">
        <div className="env">
          <button type="button" className="ico-btn burger" aria-label="Ouvrir la navigation" onClick={() => setOpen(true)}>
            <MenuIcon />
          </button>
          <Dot tone={production ? 'vert' : 'ambre'} />
          {production ? 'Production' : 'Développement'}
          <span className="faible" style={{ marginLeft: 'auto' }}>
            {typeof window !== 'undefined' ? window.location.host : ''}
          </span>
        </div>
        {!me.totp_enabled && (
          <div style={{ padding: '12px 24px 0' }}>
            <div className="bandeau">
              <ShieldCheck aria-hidden="true" />
              <span style={{ flex: 1 }}>
                Activez la double authentification : sans elle, votre accès sera bloqué{' '}
                {me.totp_deadline ? until(me.totp_deadline) : 'bientôt'}.
              </span>
              <Link className="btn btn-s" href="/compte">
                Activer
              </Link>
            </div>
          </div>
        )}
        {children}
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}

export function Brand() {
  return (
    <>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: '#060B13',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '700 13px/1 var(--font-inter), system-ui, sans-serif',
          letterSpacing: '-.03em',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        EN
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, lineHeight: 1.25 }}>
        <b style={{ fontWeight: 600, fontSize: 13.5 }}>Esport News</b>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Administration</span>
      </span>
    </>
  );
}

// The title bar of a screen: optional breadcrumb, title, chips, then actions on the right.
export function PageHeader({
  title,
  parent,
  chips,
  children,
}: {
  title: string;
  parent?: { href: string; label: string };
  chips?: ReactNode;
  children?: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} · Back-office Esport News`;
  }, [title]);
  return (
    <header className="top">
      {parent && (
        <div className="fil">
          <Link href={parent.href}>{parent.label}</Link>
          <span aria-hidden="true">/</span>
        </div>
      )}
      <h1>{title}</h1>
      {chips}
      {children && <div className="top-d">{children}</div>}
    </header>
  );
}
