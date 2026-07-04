'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Trophy, ChevronRight } from 'lucide-react';
import { PandaTournament } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';

interface TournamentCardProps {
  tournament: PandaTournament;
  showGameBadge?: boolean;
}

const tierVar = (tier: string | null | undefined): string => {
  const t = tier?.toLowerCase();
  return ['s', 'a', 'b', 'c', 'd'].includes(t || '')
    ? `var(--color-tier-${t})`
    : 'var(--color-tier-d)';
};

const formatDateCompact = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
};

// Les noms de ligue Liquipedia sont des pagenames ("BLAST_Premier")
const cleanLeagueName = (name: string) => name.replace(/_/g, ' ');

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, showGameBadge = false }) => {
  const t = useTranslations();
  const [iconError, setIconError] = useState(false);
  const iconUrl = tournament.icon_dark_url || tournament.icon_url;
  const leagueUrl = tournament.league?.image_url;
  const resolvedIcon = iconUrl && !iconError ? proxyImageUrl(iconUrl) : leagueUrl ? proxyImageUrl(leagueUrl) : null;

  const now = Date.now();
  const beginTs = tournament.begin_at ? new Date(tournament.begin_at).getTime() : null;
  const endTs = tournament.end_at ? new Date(tournament.end_at).getTime() : null;

  const isLive = tournament.status
    ? tournament.status === 'running'
    : beginTs !== null && endTs !== null && beginTs <= now && endTs > now;
  const isFinished = tournament.status === 'finished' || (endTs !== null && endTs <= now);

  // Progression temporelle du tournoi (uniquement quand il est en cours)
  const progress =
    isLive && beginTs !== null && endTs !== null && endTs > beginTs
      ? Math.min(Math.max((now - beginTs) / (endTs - beginTs), 0.03), 1)
      : null;

  const dateRange = (() => {
    if (!tournament.begin_at) return null;
    const start = formatDateCompact(tournament.begin_at);
    if (!tournament.end_at) return start;
    const end = formatDateCompact(tournament.end_at);
    return `${start} — ${end}`;
  })();

  const tierColor = tierVar(tournament.tier);

  return (
    <a
      href={`/tournois/${tournament.id}`}
      className={`group relative flex overflow-hidden rounded-xl border border-border-primary/30 bg-[var(--color-bg-secondary)]/40 transition-all duration-300 hover:bg-[var(--color-bg-hover)] hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 ${
        isFinished ? 'opacity-75 hover:opacity-100' : ''
      }`}
    >
      {/* Liseré tier */}
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: tierColor }} />

      <div className="flex flex-1 min-w-0 items-center pl-4 pr-4 md:pl-5 md:pr-5 py-4 gap-3.5 md:gap-4">
        {/* Tier badge */}
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold uppercase flex-shrink-0 ring-1"
          style={{
            color: tierColor,
            backgroundColor: `color-mix(in srgb, ${tierColor} 12%, transparent)`,
            // ring-1 lit ce var pour la bordure teintée
            ['--tw-ring-color' as string]: `color-mix(in srgb, ${tierColor} 30%, transparent)`,
          }}
        >
          {tournament.tier ? tournament.tier.toUpperCase() : '?'}
        </span>

        {/* Icon */}
        <div className="flex-shrink-0 hidden sm:block">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-primary)]/60 border border-border-primary/25 overflow-hidden flex items-center justify-center">
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
              <Trophy className="w-5 h-5 text-text-muted/50" />
            )}
          </div>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] md:text-base font-bold text-text-primary truncate transition-colors group-hover:text-accent">
            {tournament.name}
          </h3>

          <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
            {tournament.league?.name && (
              <span className="truncate max-w-[200px]">{cleanLeagueName(tournament.league.name)}</span>
            )}
            {tournament.league?.name && dateRange && (
              <span className="w-px h-3 bg-border-primary/50 flex-shrink-0" />
            )}
            {dateRange && (
              <span className="text-text-secondary whitespace-nowrap tabular-nums">{dateRange}</span>
            )}
            {tournament.type && (
              <>
                <span className="hidden md:block w-px h-3 bg-border-primary/50 flex-shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">{tournament.type}</span>
              </>
            )}
          </div>

          {/* Progression du tournoi en cours */}
          {progress !== null && (
            <div className="mt-2 h-[3px] w-full max-w-[220px] rounded-full bg-[var(--color-bg-primary)]/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent/70"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2.5 md:gap-3 flex-shrink-0">
          {showGameBadge && tournament.videogame?.slug && (
            <span className="hidden md:inline-flex px-2 py-1 rounded-md text-[10px] font-bold text-text-secondary bg-[var(--color-bg-primary)]/50 border border-border-primary/30 uppercase tracking-widest">
              {tournament.videogame.slug.toUpperCase()}
            </span>
          )}

          {tournament.prizepool && (
            <span className="hidden sm:inline-flex text-sm font-black text-accent tabular-nums whitespace-nowrap drop-shadow-[0_0_10px_rgba(242,46,98,0.25)]">
              {tournament.prizepool}
            </span>
          )}

          {isLive && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-status-live)]/12 border border-[var(--color-status-live)]/25 rounded-full text-[10px] font-bold text-[var(--color-status-live)] uppercase tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-status-live)]" />
              </span>
              <span className="hidden sm:inline">{t('pages.home.tournaments.live_badge')}</span>
            </span>
          )}

          <ChevronRight className="w-4 h-4 text-text-muted/50 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
        </div>
      </div>
    </a>
  );
};

export default TournamentCard;
