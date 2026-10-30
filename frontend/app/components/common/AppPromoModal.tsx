'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useIsDarkTheme } from '@/app/hooks/useIsDarkTheme';
import { APP_PROMO_SEEN_KEY, APP_STORE_URL, PLAY_STORE_URL, shouldShowAppPromo } from '@/app/lib/appPromo';
import { COOKIE_CONSENT_EVENT, COOKIE_CONSENT_KEY } from '@/app/lib/cookieConsent';
import AppQrCode from './AppQrCode';
import { barlow, CONDENSED } from './appPromoFonts';
import { AppleIcon, PlayIcon } from './storeIcons';
import { articleService } from '@/app/services/articleService';
import { articleHref } from '@/app/lib/articleUrl';
import type { NewsItem } from '@/app/types';

// Long enough for the page to paint and settle before anything covers it.
const OPEN_DELAY_MS = 1200;
// Must match the promo-out / slide-down durations in globals.css.
const CLOSE_DURATION_MS = 250;
// Artboard of the "01 Broadcast" mockup: on a smaller viewport the whole
// board is scaled down, never reflowed, so every value below stays exact.
const BOARD_W = 1120;
const BOARD_H = 620;
const BOARD_MARGIN = 32;
// Shown at 80 % of the artboard (Kenan found 1:1 too big), smaller if the viewport needs it.
const BOARD_SCALE = 0.8;

const THEMES = {
  dark: {
    accent: '#FF2E4D',
    bg: '#080A10',
    text: '#EEF1F7',
    ring: '#1C2130',
    panel: '#0C0E16',
    thinBarOpacity: 0.55,
    hairline: '#EEF1F7',
    hairlineOpacity: 0.12,
    liveStroke: 'rgba(238,241,247,0.14)',
    phoneShadow: 'drop-shadow(0 32px 36px rgba(0,0,0,0.75))',
    muted: '#A9B1C3',
    closeBorder: '#2A3040',
    closeBg: 'transparent',
    qrRing: 'none',
    qrInk: '#080A10',
    storeBg: '#161A26',
    storeText: '#EEF1F7',
    storeSub: '#A9B1C3',
    tickerBg: '#0F121B',
    tickerBorder: '#1C2130',
    tickerLabelBg: '#FF2E4D',
    tickerText: '#C9D0DE',
  },
  light: {
    accent: '#E0213F',
    bg: '#F6F7FA',
    text: '#0B0D14',
    ring: '#DDE1E9',
    panel: '#E8EBF2',
    thinBarOpacity: 0.45,
    hairline: '#0B0D14',
    hairlineOpacity: 0.1,
    liveStroke: 'rgba(11,13,20,0.14)',
    phoneShadow: 'drop-shadow(0 32px 30px rgba(11,13,20,0.5))',
    muted: '#4A5266',
    closeBorder: '#C9CED9',
    closeBg: '#FFFFFF',
    qrRing: 'inset 0 0 0 1px #D5D9E2',
    qrInk: '#0B0D14',
    storeBg: '#0B0D14',
    storeText: '#FFFFFF',
    storeSub: '#C9D0DE',
    tickerBg: '#FFFFFF',
    tickerBorder: '#DDE1E9',
    tickerLabelBg: '#0B0D14',
    tickerText: '#2A3142',
  },
};
type Theme = (typeof THEMES)['dark'];

const CHAMFER = 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)';

function StoreButton({
  href,
  label,
  name,
  icon,
  theme,
  style,
}: {
  href: string;
  label: string;
  name: string;
  icon: React.ReactNode;
  theme: Theme;
  style?: React.CSSProperties;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={name}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: 180,
        height: 58,
        padding: '0 16px',
        boxSizing: 'border-box',
        background: theme.storeBg,
        color: theme.storeText,
        textDecoration: 'none',
        clipPath: CHAMFER,
        ...style,
      }}
    >
      {icon}
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span style={{ fontSize: 11, color: theme.storeSub }}>{label}</span>
        <span style={{ fontSize: 19, fontWeight: 700 }}>{name}</span>
      </span>
    </a>
  );
}

function FeatureIcon({ accent, d }: { accent: string; d: string[] }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export default function AppPromoModal() {
  const t = useTranslations('layout.app_promo');
  const tStore = useTranslations('layout.footer');
  const pathname = usePathname();
  const isDark = useIsDarkTheme();
  const theme = isDark ? THEMES.dark : THEMES.light;
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [scale, setScale] = useState(1);
  const [articles, setArticles] = useState<NewsItem[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      timer = setTimeout(() => {
        try {
          sessionStorage.setItem(APP_PROMO_SEEN_KEY, '1');
        } catch {}
        setOpen(true);
      }, OPEN_DELAY_MS);
    };
    try {
      const show = shouldShowAppPromo(pathname, sessionStorage.getItem(APP_PROMO_SEEN_KEY));
      if (!show) return;
      if (localStorage.getItem(COOKIE_CONSENT_KEY)) {
        schedule();
        return () => clearTimeout(timer);
      }
    } catch {
      return;
    }
    // First visit: the cookie banner is up, one prompt at a time.
    window.addEventListener(COOKIE_CONSENT_EVENT, schedule, { once: true });
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, schedule);
      clearTimeout(timer);
    };
  }, [pathname]);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => {
      setDesktop(query.matches);
      setScale(Math.min(BOARD_SCALE, (window.innerWidth - BOARD_MARGIN) / BOARD_W, (window.innerHeight - BOARD_MARGIN) / BOARD_H));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const close = useCallback(() => setClosing(true), []);

  useEffect(() => {
    if (!open || !desktop) return;
    let cancelled = false;
    articleService
      .getAllArticles({ limit: 10 })
      .then((items) => {
        if (!cancelled) setArticles(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, desktop]);

  useEffect(() => {
    if (!closing) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, reduced ? 0 : CLOSE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    if (!desktop) return () => document.removeEventListener('keydown', onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, desktop, close]);

  if (!open) return null;

  const stores = (style?: React.CSSProperties) => (
    <>
      <StoreButton href={APP_STORE_URL} label={tStore('telecharger_sur')} name="App Store" icon={<AppleIcon size={24} />} theme={theme} style={style} />
      <StoreButton href={PLAY_STORE_URL} label={tStore('disponible_sur')} name="Google Play" icon={<PlayIcon size={22} />} theme={theme} style={style} />
    </>
  );

  // Google treats a full-screen interstitial on mobile as a ranking signal
  // (app-install popups are its own example), so phones get a sheet that
  // leaves the page readable.
  if (!desktop) {
    return (
      <div className={`fixed inset-x-0 bottom-0 z-[70] p-3 ${closing ? 'animate-slide-down' : 'animate-slide-up'} ${barlow.className}`}>
        <div
          role="dialog"
          aria-labelledby="app-promo-title"
          className="relative overflow-hidden rounded-md p-4 shadow-2xl"
          style={{ background: theme.bg, color: theme.text, boxShadow: `0 0 0 1px ${theme.ring}` }}
        >
          <button
            type="button"
            onClick={close}
            aria-label={t('close')}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center"
            style={{ border: `1px solid ${theme.closeBorder}`, background: theme.closeBg, color: theme.text, borderRadius: 2 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="flex gap-4">
            <div className="relative h-[120px] w-[58px] shrink-0">
              <Image src="/app-phone.webp" alt="" fill sizes="58px" className="object-contain" />
            </div>
            <div className="min-w-0 flex-1 pr-10">
              <h2
                id="app-promo-title"
                style={{ fontFamily: CONDENSED, fontWeight: 800, fontStyle: 'italic', fontSize: 30, lineHeight: 0.9, letterSpacing: '-0.01em', textTransform: 'uppercase', margin: 0 }}
              >
                {t('title_1')} <span style={{ color: theme.accent }}>{t('title_2')}</span> {t('title_3')}
              </h2>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.45, color: theme.muted }}>{t('description')}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">{stores({ width: '100%', height: 52, padding: '0 12px', gap: 10 })}</div>
        </div>
      </div>
    );
  }

  const features: { key: 'feature_live' | 'feature_alerts' | 'feature_news'; d: string[] }[] = [
    { key: 'feature_live', d: ['M3 12h4l3-8 4 16 3-8h4'] },
    { key: 'feature_alerts', d: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'] },
    { key: 'feature_news', d: ['M4 4h13v16H6a2 2 0 0 1-2-2z', 'M17 8h3v10a2 2 0 0 1-2 2', 'M8 8h5M8 12h5M8 16h3'] },
  ];
  // Latest articles in the band; two generic lines until they arrive (or if
  // the API is down) so it never scrolls empty.
  const tickerItems: { key: string; label: string; href?: string }[] = articles.length
    ? articles.map((a) => ({ key: a.slug, label: a.title, href: articleHref(a) }))
    : [
        { key: 'alerts', label: t('ticker_alerts') },
        { key: 'news', label: t('ticker_news') },
      ];
  const tickerDuration = `${Math.max(24, tickerItems.length * 9)}s`;
  const condensedLabel = (size: number, weight: number, spacing: string): React.CSSProperties => ({
    fontFamily: CONDENSED,
    fontWeight: weight,
    fontSize: size,
    letterSpacing: spacing,
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div
        className={`absolute inset-0 bg-[#060B13]/75 backdrop-blur-sm ${closing ? 'animate-promo-backdrop-out' : 'animate-promo-backdrop-in'}`}
        onClick={close}
        aria-hidden="true"
      />
      <div className={`relative ${closing ? 'animate-promo-out' : 'animate-promo-in'}`} style={{ width: BOARD_W * scale, height: BOARD_H * scale }}>
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-promo-title"
          className={`outline-none ${barlow.className}`}
          style={{
            width: BOARD_W,
            height: BOARD_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 6,
            background: theme.bg,
            color: theme.text,
            boxShadow: `0 0 0 1px ${theme.ring}`,
          }}
        >
          {/* Left panel: diagonal bars, outlined LIVE, the phone */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: 460, height: 572, overflow: 'hidden', background: theme.panel, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* clip-path runs in each bar's own rotated frame, so the sweep follows the diagonal. */}
            <div aria-hidden="true" className="animate-promo-bar" style={{ position: 'absolute', left: 150, top: -200, width: 170, height: 1000, background: theme.accent, transform: 'rotate(14deg)' }} />
            <div aria-hidden="true" className="animate-promo-bar animate-promo-bar-2" style={{ position: 'absolute', left: 346, top: -200, width: 16, height: 1000, background: theme.accent, opacity: theme.thinBarOpacity, transform: 'rotate(14deg)' }} />
            <div aria-hidden="true" className="animate-promo-bar animate-promo-bar-3" style={{ position: 'absolute', left: 50, top: -200, width: 6, height: 1000, background: theme.hairline, opacity: theme.hairlineOpacity, transform: 'rotate(14deg)' }} />
            <div
              aria-hidden="true"
              className="animate-promo-live"
              style={{ position: 'absolute', left: -14, bottom: -40, fontFamily: CONDENSED, fontWeight: 800, fontStyle: 'italic', fontSize: 210, lineHeight: 1, letterSpacing: '-0.02em', color: 'transparent', WebkitTextStroke: `1.5px ${theme.liveStroke}` }}
            >
              LIVE
            </div>
            <div style={{ position: 'relative', width: 250, height: 520, flexShrink: 0, filter: theme.phoneShadow }}>
              <Image src="/app-phone.webp" alt={t('mockup_alt')} fill sizes="250px" priority className="object-contain" />
            </div>
          </div>

          {/* Right panel */}
          <div style={{ position: 'absolute', left: 460, top: 0, right: 0, height: 572, boxSizing: 'border-box', padding: '36px 48px 32px 56px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 30,
                  padding: '0 16px 0 14px',
                  background: theme.accent,
                  color: '#FFFFFF',
                  ...condensedLabel(15, 700, '0.1em'),
                  clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                }}
              >
                <span className="animate-promo-pulse" style={{ width: 8, height: 8, borderRadius: 4, background: '#FFFFFF' }} />
                {t('badge_live')}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label={t('close')}
                className="focus:outline-none focus-visible:ring-2"
                style={{ marginLeft: 'auto', width: 44, height: 44, border: `1px solid ${theme.closeBorder}`, background: theme.closeBg, color: theme.text, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 2 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <h1
              id="app-promo-title"
              style={{ margin: '26px 0 0', fontFamily: CONDENSED, fontWeight: 800, fontStyle: 'italic', fontSize: 72, lineHeight: 0.9, letterSpacing: '-0.01em', textTransform: 'uppercase' }}
            >
              {t('title_1')}
              <br />
              <span style={{ color: theme.accent }}>{t('title_2')}</span>
              <br />
              {t('title_3')}
            </h1>

            <p style={{ margin: '20px 0 0', maxWidth: 470, fontSize: 17, lineHeight: 1.5, color: theme.muted }}>{t('description')}</p>

            <div style={{ marginTop: 22, display: 'flex', gap: 22, ...condensedLabel(15, 700, '0.08em'), textTransform: 'uppercase' }}>
              {features.map(({ key, d }) => (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FeatureIcon accent={theme.accent} d={d} />
                  {t(key)}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 24 }}>
              <div
                style={{
                  width: 108,
                  height: 108,
                  background: '#FFFFFF',
                  padding: 9,
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  boxShadow: theme.qrRing,
                  clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)',
                }}
              >
                <AppQrCode className="block h-[90px] w-[90px]" style={{ color: theme.qrInk }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ ...condensedLabel(14, 700, '0.12em'), color: theme.muted, textTransform: 'uppercase' }}>← {t('scan_hint')}</div>
                <div style={{ display: 'flex', gap: 12 }}>{stores()}</div>
              </div>
            </div>
          </div>

          {/* Bottom ticker */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48, background: theme.tickerBg, borderTop: `1px solid ${theme.tickerBorder}`, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                padding: '0 22px 0 20px',
                display: 'flex',
                alignItems: 'center',
                background: theme.tickerLabelBg,
                color: '#FFFFFF',
                ...condensedLabel(15, 800, '0.12em'),
                flexShrink: 0,
                clipPath: 'polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {t('ticker_label')}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                className="animate-promo-ticker"
                style={{ display: 'flex', gap: 40, whiteSpace: 'nowrap', width: 'max-content', animationDuration: tickerDuration, ...condensedLabel(15, 600, '0.06em'), color: theme.tickerText, textTransform: 'uppercase', paddingLeft: 28 }}
              >
                {[0, 1].map((copy) =>
                  tickerItems.map((item) => (
                    <span key={`${copy}-${item.key}`} style={{ display: 'contents' }} aria-hidden={copy === 1 || undefined}>
                      {item.href ? (
                        <Link href={item.href} onClick={close} tabIndex={copy === 1 ? -1 : undefined} style={{ color: 'inherit', textDecoration: 'none' }} className="hover:underline">
                          {item.label}
                        </Link>
                      ) : (
                        <span>{item.label}</span>
                      )}
                      <span style={{ color: theme.accent }}>///</span>
                    </span>
                  )),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
