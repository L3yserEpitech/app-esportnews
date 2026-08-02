'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, Trophy, Globe } from 'lucide-react';
import LiquipediaBadge from '../../../components/common/LiquipediaBadge';
import { proxyImageUrl } from '../../../lib/imageProxy';
import type { TournamentSectionProps } from './shared';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const getTierColor = (tier: string) => {
  const colors: Record<string, string> = {
    's': 'bg-[var(--color-tier-s)] text-gray-950',
    'a': 'bg-[var(--color-tier-a)] text-white',
    'b': 'bg-[var(--color-tier-b)] text-white',
    'c': 'bg-[var(--color-tier-c)] text-white',
    'd': 'bg-[var(--color-tier-d)] text-white',
  };
  return colors[tier.toLowerCase()] || colors['d'];
};

export default function TournamentHeader({ tournament }: TournamentSectionProps) {
  const t = useTranslations('pages_detail.tournament_detail');
  const [bannerError, setBannerError] = useState(false);

  const bannerUrl = tournament.banner_dark_url || tournament.banner_url;
  const hasBanner = bannerUrl && !bannerError;

  const status = (() => {
    if (!tournament.begin_at) return null;
    const now = new Date();
    const begin = new Date(tournament.begin_at);
    const end = new Date(tournament.end_at || tournament.begin_at);
    if (now < begin) return { label: t('status_upcoming'), color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
    if (now > end) return { label: t('status_finished'), color: 'bg-[var(--color-text-muted)]/20 text-[var(--color-text-muted)] border-[var(--color-text-muted)]/30' };
    return { label: t('status_running'), color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  })();

  return (
    <div className="container mx-auto px-4 pt-35">
      <div className="flex items-start gap-4">
        {(tournament.icon_dark_url || tournament.icon_url) && (
          <div className="hidden sm:flex w-14 h-14 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] items-center justify-center overflow-hidden flex-shrink-0">
            <img
              src={proxyImageUrl(tournament.icon_dark_url || tournament.icon_url || '')}
              alt=""
              className="w-10 h-10 object-contain"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {tournament.tier && (
              <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider ${getTierColor(tournament.tier)}`}>
                {tournament.tier.toUpperCase()}
              </span>
            )}
            {status && (
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${status.color}`}>
                {status.label}
              </span>
            )}
            {tournament.videogame?.slug && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] uppercase">
                {tournament.videogame.slug}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] leading-tight">
            {tournament.name}
          </h1>
        </div>

        {hasBanner && (
          <div className="hidden md:block flex-shrink-0 w-64 lg:w-80 overflow-hidden border border-[var(--color-border-primary)]/50">
            <img
              src={proxyImageUrl(bannerUrl)}
              alt=""
              className="w-full h-auto object-contain"
              onError={() => setBannerError(true)}
            />
          </div>
        )}
      </div>

      {/* Meta line */}
      <div className="flex items-center gap-4 flex-wrap mt-3 text-sm text-[var(--color-text-secondary)] pb-6 border-b border-[var(--color-border-primary)]/50">
        {tournament.league?.name && (
          <span className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            {tournament.league.name}
          </span>
        )}
        {tournament.begin_at && (
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            {formatDate(tournament.begin_at)}
            {tournament.end_at && ` — ${formatDate(tournament.end_at)}`}
          </span>
        )}
        {tournament.region && (
          <span className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            <span className="capitalize">{tournament.region}</span>
          </span>
        )}
        {tournament.prizepool && (
          <span className="font-bold text-[var(--color-accent)]">{tournament.prizepool}</span>
        )}
        <LiquipediaBadge />
      </div>
    </div>
  );
}
