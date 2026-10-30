'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { APP_BANNER_CLOSED_KEY, APP_STORE_URL, PLAY_STORE_URL, isAppPromoPath } from '@/app/lib/appPromo';
import { barlow, CONDENSED } from './appPromoFonts';
import { AppleIcon, PlayIcon } from './storeIcons';

const CHAMFER = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const condensed = { fontFamily: CONDENSED };
// clip-path also clips outlines, so chamfered links show focus with an underline.
const chamferedLink = 'outline-none transition-opacity hover:opacity-85 focus-visible:underline underline-offset-4';

function StoreLink({ href, name, icon }: { href: string; name: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex h-[38px] items-center gap-2 bg-[var(--ab-store-bg)] pl-3 pr-3.5 text-sm font-bold text-[var(--ab-store-text)] ${chamferedLink}`}
      style={{ clipPath: CHAMFER }}
    >
      {icon}
      {name}
    </a>
  );
}

function CloseButton({ label, onClick, className }: { label: string; onClick: () => void; className: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-[var(--ab-muted)] outline-none transition-colors hover:text-[var(--ab-text)] focus-visible:ring-2 focus-visible:ring-[var(--ab-accent)] ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

// "Top banner compacte" mockups (Claude Design): a strip pinned above the
// navbar, 52 px under lg, 56 px from lg up. The outer element keeps its height
// in the page flow so content starts below it. It is server-rendered so it
// never shifts the page; a visitor who closed it this session is hidden before
// first paint by the inline script in app/layout.tsx. Colours and the navbar
// offset live in globals.css (.app-banner, --app-banner-offset).
export default function AppTopBanner() {
  const t = useTranslations('layout.app_promo');
  const pathname = usePathname();
  const [closed, setClosed] = useState(false);
  const visible = !closed && isAppPromoPath(pathname);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(APP_BANNER_CLOSED_KEY)) setClosed(true);
    } catch {}
  }, []);

  const close = useCallback(() => {
    try {
      sessionStorage.setItem(APP_BANNER_CLOSED_KEY, '1');
    } catch {}
    document.documentElement.setAttribute('data-app-banner', 'off');
    setClosed(true);
  }, []);

  if (!visible) return null;

  return (
    <div id="app-banner" className="h-[52px] lg:h-14">
      <div
        role="region"
        aria-label={t('banner_label')}
        className={`app-banner fixed inset-x-0 top-0 z-50 h-[52px] overflow-hidden border-b border-[var(--ab-border)] bg-[var(--ab-bg)] text-[var(--ab-text)] lg:h-14 ${barlow.className}`}
      >
        {/* Mobile and tablet: one line and a single install button. /app picks the store from the user agent. */}
        <div className="flex h-full items-center lg:hidden">
          <div
            className="flex h-full w-[38px] shrink-0 items-center justify-center bg-[var(--ab-accent)] pr-2"
            style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}
          >
            <span role="img" aria-label={t('badge_live')} className="animate-promo-pulse h-[7px] w-[7px] rounded-full bg-white" />
          </div>
          <p className="ml-2.5 min-w-0 flex-1 truncate text-base min-[380px]:text-lg font-extrabold uppercase italic leading-none" style={condensed}>
            {t('banner_short_1')} <span className="text-[var(--ab-accent)]">{t('banner_short_2')}</span>
          </p>
          <a
            href="/app"
            className={`ml-2 flex h-9 shrink-0 items-center bg-[var(--ab-install-bg)] px-2.5 min-[380px]:px-3.5 text-[15px] font-extrabold uppercase tracking-[0.08em] text-white ${chamferedLink}`}
            style={{ ...condensed, clipPath: CHAMFER }}
          >
            {t('banner_install')}
          </a>
          <CloseButton label={t('banner_close')} onClick={close} className="mx-0.5" />
        </div>

        {/* Desktop: live tag, title and tagline, both stores. */}
        <div className="hidden h-full items-center lg:flex">
          <div
            className="relative z-[1] flex h-full shrink-0 items-center gap-2 bg-[var(--ab-accent)] pl-5 pr-[30px] text-base font-extrabold uppercase tracking-[0.1em] text-white"
            style={{ ...condensed, clipPath: 'polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%)' }}
          >
            <span className="animate-promo-pulse h-[7px] w-[7px] rounded-full bg-white" />
            {t('badge_live')}
          </div>
          <div
            aria-hidden="true"
            className="-ml-2.5 h-full w-6 shrink-0 bg-[var(--ab-accent)] opacity-[var(--ab-echo-opacity)]"
            style={{ clipPath: 'polygon(10px 0, 24px 0, 8px 100%, 0 100%)' }}
          />
          <div className="ml-[18px] flex min-w-0 flex-1 items-baseline gap-3.5 overflow-hidden whitespace-nowrap">
            <p className="shrink-0 text-[22px] font-extrabold uppercase italic leading-none" style={condensed}>
              {t('title_1')} <span className="text-[var(--ab-accent)]">{t('title_2')}</span> {t('title_3')}
            </p>
            <p className="hidden truncate text-sm text-[var(--ab-muted)] xl:block">{t('banner_tagline')}</p>
          </div>
          <div className="ml-6 flex shrink-0 gap-2">
            <StoreLink href={APP_STORE_URL} name="App Store" icon={<AppleIcon size={17} />} />
            <StoreLink href={PLAY_STORE_URL} name="Google Play" icon={<PlayIcon size={15} />} />
          </div>
          <div aria-hidden="true" className="ml-4 mr-2 h-7 w-px shrink-0 bg-[var(--ab-divider)]" />
          <CloseButton label={t('banner_close')} onClick={close} className="mr-2" />
        </div>
      </div>
    </div>
  );
}
