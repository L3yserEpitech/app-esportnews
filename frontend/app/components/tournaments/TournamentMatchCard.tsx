'use client';

import React from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { PandaMatch } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';

interface TournamentMatchCardProps {
  match: PandaMatch;
}

export default function TournamentMatchCard({ match }: TournamentMatchCardProps) {
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;

  const homeScore = match.results?.find(r => r.team_id === homeTeam?.id)?.score ?? '-';
  const awayScore = match.results?.find(r => r.team_id === awayTeam?.id)?.score ?? '-';

  const isLive = match.status === 'running';
  const isFinished = match.status === 'finished';

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const dateStr = match.begin_at || match.scheduled_at;
  const timeStr = dateStr ? formatTime(dateStr) : null;

  // Left accent bar color
  const accentBar = isLive
    ? 'bg-[var(--color-status-live)]'
    : isFinished
      ? 'bg-[var(--color-text-muted)]/40'
      : 'bg-blue-500';

  return (
    <Link href={`/match/${match.id}${match.wiki ? `?wiki=${match.wiki}` : ''}`}>
      <div className="group relative w-full flex items-stretch rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/50 hover:border-[var(--color-accent)]/30 transition-all duration-200 cursor-pointer">
        {/* Left accent bar */}
        <div className={`w-[3px] flex-shrink-0 ${accentBar}`} />

        <div className="flex-1 flex items-center py-3 px-3 sm:px-4 gap-2 sm:gap-3 min-w-0">
          {/* Time / Status column */}
          <div className="flex-shrink-0 w-14 sm:w-16 text-center">
            {isLive ? (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--color-status-live)]/15 rounded">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-status-live)]" />
                </span>
                <span className="text-[11px] font-bold text-[var(--color-status-live)] uppercase">Live</span>
              </div>
            ) : (
              <span className="text-xs text-[var(--color-text-muted)] font-medium">
                {timeStr || '--:--'}
              </span>
            )}
          </div>

          {/* Home team */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end">
            <span className={`text-sm font-semibold truncate ${isFinished ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}`}>
              {homeTeam?.name || 'TBD'}
            </span>
            <div className="w-8 h-8 rounded bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
              {homeTeam?.image_url ? (
                <img src={proxyImageUrl(homeTeam.image_url)} alt="" className="w-6 h-6 object-contain" loading="lazy" />
              ) : (
                <Trophy className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              )}
            </div>
          </div>

          {/* Score */}
          <div className="flex-shrink-0 w-20 sm:w-24 flex items-center justify-center gap-1.5">
            {isFinished || isLive ? (
              <div className={`flex items-center gap-2 text-lg font-bold tabular-nums ${isLive ? 'text-[var(--color-status-live)]' : 'text-[var(--color-text-primary)]'}`}>
                <span className="w-5 text-right">{homeScore}</span>
                <span className="text-[var(--color-text-muted)] text-sm">-</span>
                <span className="w-5 text-left">{awayScore}</span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">VS</span>
            )}
          </div>

          {/* Away team */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
              {awayTeam?.image_url ? (
                <img src={proxyImageUrl(awayTeam.image_url)} alt="" className="w-6 h-6 object-contain" loading="lazy" />
              ) : (
                <Trophy className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              )}
            </div>
            <span className={`text-sm font-semibold truncate ${isFinished ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}`}>
              {awayTeam?.name || 'TBD'}
            </span>
          </div>

          {/* BO + match name */}
          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {match.number_of_games && (
              <span className="text-[11px] text-[var(--color-text-muted)] font-medium bg-[var(--color-bg-primary)]/60 px-2 py-0.5 rounded">
                BO{match.number_of_games}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-muted)] truncate max-w-32">{match.name}</span>
          </div>

          {/* Arrow */}
          <svg
            className="w-3.5 h-3.5 text-[var(--color-text-muted)]/50 group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0 ml-1"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
