'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Trophy } from 'lucide-react';
import { PandaTournament } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';

interface TournamentCardProps {
  tournament: PandaTournament;
  showGameBadge?: boolean;
}

const getTierColor = (tier: string | null | undefined): string => {
  if (!tier) return 'bg-[var(--color-tier-d)]';
  switch (tier.toLowerCase()) {
    case 's': return 'bg-[var(--color-tier-s)]';
    case 'a': return 'bg-[var(--color-tier-a)]';
    case 'b': return 'bg-[var(--color-tier-b)]';
    case 'c': return 'bg-[var(--color-tier-c)]';
    case 'd': return 'bg-[var(--color-tier-d)]';
    default: return 'bg-[var(--color-tier-d)]';
  }
};

const getTierDotColor = (tier: string | null | undefined): string => {
  if (!tier) return 'bg-[var(--color-tier-d)]';
  switch (tier.toLowerCase()) {
    case 's': return 'bg-[var(--color-tier-s)]';
    case 'a': return 'bg-[var(--color-tier-a)]';
    case 'b': return 'bg-[var(--color-tier-b)]';
    case 'c': return 'bg-[var(--color-tier-c)]';
    case 'd': return 'bg-[var(--color-tier-d)]';
    default: return 'bg-[var(--color-tier-d)]';
  }
};

const formatDateCompact = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
};

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, showGameBadge = false }) => {
  const t = useTranslations();
  const [iconError, setIconError] = useState(false);
  const iconUrl = tournament.icon_dark_url || tournament.icon_url;
  const leagueUrl = tournament.league?.image_url;
  const resolvedIcon = iconUrl && !iconError ? proxyImageUrl(iconUrl) : leagueUrl ? proxyImageUrl(leagueUrl) : null;

  const isLive =
    tournament.begin_at &&
    tournament.end_at &&
    new Date(tournament.begin_at) <= new Date() &&
    new Date(tournament.end_at) > new Date();

  const dateRange = (() => {
    if (!tournament.begin_at) return null;
    const start = formatDateCompact(tournament.begin_at);
    if (!tournament.end_at) return start;
    const end = formatDateCompact(tournament.end_at);
    return `${start} — ${end}`;
  })();

  return (
    <a
      href={`/tournois/${tournament.id}`}
      className="group relative flex overflow-hidden rounded-xl border border-border-primary/30 bg-[#F22E62]/[0.02] transition-all duration-300 hover:bg-[#F22E62]/[0.06] hover:border-[#F22E62]/30 hover:shadow-lg hover:shadow-[#F22E62]/10"
    >
      {/* ── Content ── */}
      <div className="flex flex-1 min-w-0 items-center px-5 py-4 gap-4">
        {/* Tier badge */}
        {tournament.tier && (
          <span className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold text-white uppercase tracking-wider flex-shrink-0 ${getTierColor(tournament.tier)}`}>
            {tournament.tier.toUpperCase()}
          </span>
        )}

        {/* Icon */}
        <div className="flex-shrink-0 hidden sm:block">
          <div className="w-12 h-12 rounded-lg bg-bg-tertiary/60 border border-border-primary/30 overflow-hidden flex items-center justify-center">
            {resolvedIcon ? (
              <Image
                src={resolvedIcon}
                alt={tournament.name}
                width={40}
                height={40}
                className="object-contain p-1"
                unoptimized
                onError={() => setIconError(true)}
              />
            ) : (
              <Trophy className="w-5 h-5 text-text-muted" />
            )}
          </div>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name + badges */}
          <div className="flex items-start gap-2 mb-1">
            <h3 className="text-base font-bold text-text-primary truncate">
              {tournament.name}
            </h3>
          </div>

          {/* Row 2: Meta line */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-text-muted">
            {tournament.league?.name && (
              <span className="truncate max-w-[200px]">{tournament.league.name}</span>
            )}
            {tournament.league?.name && dateRange && (
              <span className="w-px h-3 bg-border-primary/50" />
            )}
            {dateRange && (
              <span className="text-text-secondary whitespace-nowrap">{dateRange}</span>
            )}
            {tournament.region && (
              <>
                <span className="w-px h-3 bg-border-primary/50" />
                <span className="capitalize whitespace-nowrap">{tournament.region}</span>
              </>
            )}
          </div>
        </div>

        {/* Right side: Game + Prizepool + Status */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Game badge */}
          {tournament.videogame?.slug && (
            <span className="hidden md:inline-flex px-2.5 py-1 rounded-md text-[11px] font-semibold text-text-secondary bg-bg-tertiary/50 border border-border-primary/30 uppercase tracking-wide">
              {tournament.videogame.slug.toUpperCase()}
            </span>
          )}

          {/* Prizepool */}
          {tournament.prizepool && (
            <span className="hidden sm:inline-flex text-sm font-bold text-[#F22E62] whitespace-nowrap">
              {tournament.prizepool}
            </span>
          )}

          {/* Tier dot indicator */}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${getTierDotColor(tournament.tier)}`} />
          </div>

          {/* Live indicator */}
          {isLive && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/15 border border-red-500/25 rounded-md text-[11px] font-bold text-red-400 uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              {t('pages.home.tournaments.live_badge')}
            </span>
          )}

          {/* Arrow */}
          <svg
            className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </a>
  );
};

export default TournamentCard;
