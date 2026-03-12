'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { PandaMatch } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';
import { useIsDarkTheme, pickThemeLogo } from '../../hooks/useIsDarkTheme';

interface TournamentMatchCardProps {
  match: PandaMatch;
}

export default function TournamentMatchCard({ match }: TournamentMatchCardProps) {
  const router = useRouter();
  const isDark = useIsDarkTheme();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const dateStr = match.begin_at || match.scheduled_at;
  const timeStr = dateStr ? formatTime(dateStr) : null;
  const dateFormatted = dateStr ? formatDate(dateStr) : null;

  const accentBar = isLive
    ? 'bg-[var(--color-status-live)]'
    : isFinished
      ? 'bg-[var(--color-text-muted)]/40'
      : 'bg-blue-500';

  const teamClick = (team: typeof homeTeam) => (e: React.MouseEvent) => {
    if (team?.template && match.wiki) {
      e.preventDefault();
      e.stopPropagation();
      const params = new URLSearchParams({ wiki: match.wiki });
      if (team.name) params.set('name', team.name);
      if (team.acronym) params.set('acronym', String(team.acronym));
      if (team.image_url) params.set('logo', team.image_url);
      router.push(`/equipe/${encodeURIComponent(team.template)}?${params.toString()}`);
    }
  };

  const leagueImg = isDark
    ? (match.tournament?.icon_dark_url || match.league?.image_url || match.tournament?.icon_url)
    : (match.tournament?.icon_url || match.league?.image_url);

  return (
    <Link href={`/match/${match.match2id || match.id}${match.wiki ? `?wiki=${match.wiki}` : ''}`}>
      <div className="group relative w-full flex items-stretch rounded-lg overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/50 hover:border-[var(--color-accent)]/30 transition-all duration-200 cursor-pointer">
        {/* Left accent bar */}
        <div className={`w-[3px] flex-shrink-0 ${accentBar}`} />

        {/* Grid: 1fr [score] 1fr → score always dead center */}
        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center py-3 px-3 sm:py-3 sm:px-4">

          {/* ── Left half: time + home team ── */}
          <div className="flex items-center gap-1 sm:gap-3 min-w-0">
            {/* Time + Date / Live */}
            <div className="flex-shrink-0 w-10 sm:w-28 text-center">
              {isLive ? (
                <div className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 bg-[var(--color-status-live)]/15 rounded">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-status-live)]" />
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-[var(--color-status-live)] uppercase">Live</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center sm:gap-1.5">
                  <span className="text-[10px] sm:text-xs text-[var(--color-text-primary)] font-semibold tabular-nums">
                    {timeStr || '--:--'}
                  </span>
                  {dateFormatted && (
                    <span className="text-[9px] sm:text-[10px] text-[var(--color-text-muted)] tabular-nums leading-tight">
                      {dateFormatted}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Home team */}
            <div
              className="flex-1 flex items-center gap-2 min-w-0 justify-end cursor-pointer"
              onClick={teamClick(homeTeam)}
            >
              <span className={`hidden sm:block text-sm font-semibold truncate hover:text-[var(--color-accent)] transition-colors ${isFinished ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}`}>
                {homeTeam?.name || 'TBD'}
              </span>
              <div className="w-9 h-9 sm:w-8 sm:h-8 rounded bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                {pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url) ? (
                  <img src={proxyImageUrl(pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url)!)} alt="" className="w-6 h-6 sm:w-6 sm:h-6 object-contain" loading="lazy" />
                ) : (
                  <Trophy className="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
              </div>
            </div>
          </div>

          {/* ── Score — dead center ── */}
          <div className="w-16 sm:w-20 flex items-center justify-center mx-1 sm:mx-2">
            {isFinished || isLive ? (
              <div className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-lg font-bold tabular-nums text-[#F22E62]">
                <span className="w-5 sm:w-5 text-right">{homeScore}</span>
                <span className="text-[var(--color-text-muted)] text-xs sm:text-sm">-</span>
                <span className="w-5 sm:w-5 text-left">{awayScore}</span>
              </div>
            ) : (
              <span className="text-xs sm:text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">VS</span>
            )}
          </div>

          {/* ── Right half: away team + tournament ── */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Away team */}
            <div
              className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
              onClick={teamClick(awayTeam)}
            >
              <div className="w-9 h-9 sm:w-8 sm:h-8 rounded bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                {pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url) ? (
                  <img src={proxyImageUrl(pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url)!)} alt="" className="w-6 h-6 sm:w-6 sm:h-6 object-contain" loading="lazy" />
                ) : (
                  <Trophy className="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
              </div>
              <span className={`hidden sm:block text-sm font-semibold truncate hover:text-[var(--color-accent)] transition-colors ${isFinished ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-primary)]'}`}>
                {awayTeam?.name || 'TBD'}
              </span>
            </div>

            {/* Tournament info */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {match.number_of_games && (
                <span className="hidden md:inline text-[11px] text-[var(--color-text-muted)] font-medium bg-[var(--color-bg-primary)]/60 px-2 py-0.5 rounded">
                  BO{match.number_of_games}
                </span>
              )}
              <span className="hidden md:block text-xs text-[var(--color-text-primary)] font-medium truncate max-w-36">
                {match.league?.name || match.tournament?.name || match.name}
              </span>
              {leagueImg && (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={proxyImageUrl(leagueImg)} alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" loading="lazy" />
                </div>
              )}
            </div>

            {/* Arrow — desktop only */}
            <svg
              className="hidden sm:block w-3.5 h-3.5 text-[var(--color-text-muted)]/50 group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>

        </div>
      </div>
    </Link>
  );
}
