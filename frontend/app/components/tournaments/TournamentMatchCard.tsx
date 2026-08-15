'use client';

import React from 'react';
import { matchHref } from '../../lib/gameLinks';
import { gameByWiki, gameIconByWiki } from '../../lib/gameRegistry';
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

  const hs = Number(homeScore);
  const as = Number(awayScore);
  const scoresKnown = isFinished && !Number.isNaN(hs) && !Number.isNaN(as);
  const homeWon = scoresKnown && hs > as;
  const awayWon = scoresKnown && as > hs;

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

  const gameIcon = gameIconByWiki(match.wiki);
  const gameName = match.wiki ? gameByWiki(match.wiki)?.name : undefined;

  const homeLogo = pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url);
  const awayLogo = pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url);

  return (
    <Link href={matchHref(match)}>
      <div className="group relative w-full flex items-center gap-2 sm:gap-3 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/40 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-bg-tertiary)]/40 transition-all duration-200 cursor-pointer">
        {/* Live wash — subtle tinted glow instead of a hard accent bar */}
        {isLive && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[var(--color-status-live)]/12 to-transparent" />
        )}

        {/* Game icon — hors de la grille pour ne pas décaler le score du centre */}
        {gameIcon && (
          <div
            title={gameName}
            className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border-primary)]/50 flex items-center justify-center flex-shrink-0"
          >
            <img src={gameIcon} alt={gameName || ''} className="w-4 h-4 sm:w-[18px] sm:h-[18px] object-contain" loading="lazy" />
          </div>
        )}

        {/* Grid: 1fr [score] 1fr → score always dead center */}
        <div className="relative flex-1 grid grid-cols-[1fr_auto_1fr] items-center min-w-0">

          {/* ── Left half: status + home team ── */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Status pill / time */}
            <div className="flex-shrink-0 w-11 sm:w-24 flex justify-center">
              {isLive ? (
                <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--color-status-live)]/15 rounded-full">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-status-live)]" />
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-[var(--color-status-live)] uppercase tracking-wide">Live</span>
                </div>
              ) : (
                <div className="flex flex-col items-center leading-tight">
                  <span className="text-[11px] sm:text-xs text-[var(--color-text-primary)] font-semibold tabular-nums">
                    {timeStr || '--:--'}
                  </span>
                  {dateFormatted && (
                    <span className="text-[9px] sm:text-[10px] text-[var(--color-text-muted)] tabular-nums">
                      {dateFormatted}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Home team */}
            <div className={`flex-1 flex items-center gap-2 sm:gap-2.5 min-w-0 justify-end transition-opacity ${awayWon ? 'opacity-50' : ''}`}>
              <span className={`hidden sm:block text-sm truncate ${homeWon ? 'font-bold text-[var(--color-text-primary)]' : 'font-semibold text-[var(--color-text-secondary)]'}`}>
                {homeTeam?.name || 'TBD'}
              </span>
              <div
                onClick={teamClick(homeTeam)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border-primary)]/50 hover:ring-[var(--color-accent)]/60 flex items-center justify-center overflow-hidden flex-shrink-0 transition cursor-pointer"
              >
                {homeLogo ? (
                  <img src={proxyImageUrl(homeLogo)} alt="" className="w-7 h-7 object-contain" loading="lazy" />
                ) : (
                  <Trophy className="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
              </div>
            </div>
          </div>

          {/* ── Score — dead center ── */}
          <div className="flex items-center justify-center mx-1.5 sm:mx-3">
            {isFinished || isLive ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--color-bg-primary)]/60 text-lg font-bold tabular-nums text-[#F22E62]">
                <span className="w-5 text-right">{homeScore}</span>
                <span className="text-[var(--color-text-muted)] text-sm">-</span>
                <span className="w-5 text-left">{awayScore}</span>
              </div>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-[var(--color-bg-primary)]/50 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">VS</span>
            )}
          </div>

          {/* ── Right half: away team + tournament ── */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {/* Away team */}
            <div className={`flex-1 flex items-center gap-2 sm:gap-2.5 min-w-0 transition-opacity ${homeWon ? 'opacity-50' : ''}`}>
              <div
                onClick={teamClick(awayTeam)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border-primary)]/50 hover:ring-[var(--color-accent)]/60 flex items-center justify-center overflow-hidden flex-shrink-0 transition cursor-pointer"
              >
                {awayLogo ? (
                  <img src={proxyImageUrl(awayLogo)} alt="" className="w-7 h-7 object-contain" loading="lazy" />
                ) : (
                  <Trophy className="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
              </div>
              <span className={`hidden sm:block text-sm truncate ${awayWon ? 'font-bold text-[var(--color-text-primary)]' : 'font-semibold text-[var(--color-text-secondary)]'}`}>
                {awayTeam?.name || 'TBD'}
              </span>
            </div>

            {/* Tournament info */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="hidden md:block text-xs text-[var(--color-text-secondary)] font-medium truncate max-w-36">
                {match.league?.name || match.tournament?.name || match.name}
              </span>
              {leagueImg && (
                <div className="w-7 h-7 rounded-full bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border-primary)]/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img src={proxyImageUrl(leagueImg)} alt="" className="w-5 h-5 object-contain" loading="lazy" />
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
