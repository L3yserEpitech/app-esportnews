'use client';

import { useTranslations } from 'next-intl';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/app/lib/appPromo';

interface StoreBadgesProps {
  className?: string;
  badgeClassName?: string;
}

export default function StoreBadges({ className = 'flex flex-wrap gap-3', badgeClassName = '' }: StoreBadgesProps) {
  const t = useTranslations('layout.footer');
  const badge = `inline-flex items-center gap-2.5 rounded-xl border bg-black px-3.5 py-2 text-white transition-transform duration-200 hover:scale-[1.03] ${badgeClassName}`;

  return (
    <div className={className}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="App Store"
        style={{ borderColor: 'var(--color-border-primary)' }}
        className={badge}
      >
        <svg className="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] font-normal opacity-80">{t('telecharger_sur')}</span>
          <span className="whitespace-nowrap text-base font-semibold -mt-0.5">App Store</span>
        </span>
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Google Play"
        style={{ borderColor: 'var(--color-border-primary)' }}
        className={badge}
      >
        <svg className="w-6 h-6 shrink-0" viewBox="0 0 512 512" aria-hidden="true">
          <path fill="#00d3ff" d="M47.6 30.5C40.3 34.9 36 42.9 36 53.6v404.8c0 10.7 4.3 18.7 11.6 23.1l238.4-225.7z" />
          <path fill="#00f076" d="M47.6 30.5 286 255.8 356.3 189 96.5 42.8C79.5 33.4 62.3 30.2 47.6 30.5z" />
          <path fill="#ffce00" d="M356.3 189 286 255.8l70.3 66.8 78.5-44.2c22.2-12.5 22.2-42.7 0-55.2z" />
          <path fill="#ff3c3c" d="M47.6 481.1c14.7.3 31.9-2.9 48.9-12.3l259.8-146.2L286 255.8z" />
        </svg>
        <span className="flex flex-col leading-tight">
          <span className="text-[10px] font-normal opacity-80">{t('disponible_sur')}</span>
          <span className="whitespace-nowrap text-base font-semibold -mt-0.5">Google Play</span>
        </span>
      </a>
    </div>
  );
}
