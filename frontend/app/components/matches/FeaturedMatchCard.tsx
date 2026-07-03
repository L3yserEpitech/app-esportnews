'use client';

import React from 'react';
import { matchHref } from '../../lib/gameLinks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy } from 'lucide-react';
import { PandaMatch } from '../../types';
import { proxyImageUrl } from '../../lib/imageProxy';
import { useIsDarkTheme, pickThemeLogo } from '../../hooks/useIsDarkTheme';

interface FeaturedMatchCardProps {
  match: PandaMatch;
}

export default function FeaturedMatchCard({ match }: FeaturedMatchCardProps) {
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

  const dateStr = match.begin_at || match.scheduled_at;
  const timeStr = dateStr ? formatTime(dateStr) : null;

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

  const homeLogo = pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url);
  const awayLogo = pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url);

  const hs = Number(homeScore);
  const as = Number(awayScore);
  const scoresKnown = isFinished && !Number.isNaN(hs) && !Number.isNaN(as);
  const homeWon = scoresKnown && hs > as;
  const awayWon = scoresKnown && as > hs;

  return (
    <Link href={matchHref(match)}>
      <div className="group relative cursor-pointer rounded-2xl overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/40 hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-bg-tertiary)]/40 transition-all duration-200">

        {/* Live wash — subtle tinted glow from the top */}
        {isLive && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--color-status-live)]/10 to-transparent" />
        )}

        {/* Header: tournament + status */}
        <div className="relative flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {leagueImg && (
              <div className="w-7 h-7 rounded-full bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border-primary)]/50 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={proxyImageUrl(leagueImg)} alt="" className="w-[18px] h-[18px] object-contain" loading="lazy" />
              </div>
            )}
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium truncate">
              {match.league?.name || match.tournament?.name || match.name}
            </span>
          </div>

          {/* Status badge */}
          {isLive ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-status-live)]/15 rounded-full flex-shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-status-live)]" />
              </span>
              <span className="text-[10px] font-bold text-[var(--color-status-live)] uppercase tracking-wide">Live</span>
            </div>
          ) : isFinished ? (
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase px-2.5 py-1 bg-[var(--color-bg-primary)]/50 rounded-full flex-shrink-0">
              Terminé
            </span>
          ) : timeStr ? (
            <span className="text-[11px] font-semibold text-[var(--color-text-primary)] tabular-nums px-2.5 py-1 bg-[var(--color-bg-primary)]/50 rounded-full flex-shrink-0">
              {timeStr}
            </span>
          ) : null}
        </div>

        {/* Match content: logos + score */}
        <div className="relative flex items-center justify-between px-5 py-5">

          {/* Home team */}
          <div className={`flex-1 flex flex-col items-center gap-2.5 min-w-0 transition-opacity ${awayWon ? 'opacity-50' : ''}`}>
            <div
              onClick={teamClick(homeTeam)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border-primary)]/50 hover:ring-[var(--color-accent)]/60 flex items-center justify-center overflow-hidden transition cursor-pointer"
            >
              {homeLogo ? (
                <img
                  src={proxyImageUrl(homeLogo)}
                  alt={homeTeam?.name || ''}
                  className="w-11 h-11 sm:w-14 sm:h-14 object-contain"
                  loading="lazy"
                />
              ) : (
                <Trophy className="w-5 h-5 text-[var(--color-text-muted)]" />
              )}
            </div>
            <span className={`text-xs truncate max-w-full text-center ${homeWon ? 'font-bold text-[var(--color-text-primary)]' : 'font-semibold text-[var(--color-text-secondary)]'}`}>
              {homeTeam?.name || 'TBD'}
            </span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-2 px-3">
            {isFinished || isLive ? (
              <div className="flex items-center gap-2.5 text-2xl sm:text-3xl font-extrabold tabular-nums text-[#F22E62]">
                <span>{homeScore}</span>
                <span className="text-[var(--color-text-muted)] text-base">-</span>
                <span>{awayScore}</span>
              </div>
            ) : (
              <span className="text-base sm:text-lg font-extrabold text-[var(--color-text-muted)] uppercase tracking-wider">VS</span>
            )}
            {match.number_of_games && (
              <span className="text-[10px] text-[var(--color-text-muted)] font-semibold bg-[var(--color-bg-primary)]/60 px-2.5 py-1 rounded-full">
                BO{match.number_of_games}
              </span>
            )}
          </div>

          {/* Away team */}
          <div className={`flex-1 flex flex-col items-center gap-2.5 min-w-0 transition-opacity ${homeWon ? 'opacity-50' : ''}`}>
            <div
              onClick={teamClick(awayTeam)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[var(--color-bg-primary)] ring-1 ring-[var(--color-border-primary)]/50 hover:ring-[var(--color-accent)]/60 flex items-center justify-center overflow-hidden transition cursor-pointer"
            >
              {awayLogo ? (
                <img
                  src={proxyImageUrl(awayLogo)}
                  alt={awayTeam?.name || ''}
                  className="w-11 h-11 sm:w-14 sm:h-14 object-contain"
                  loading="lazy"
                />
              ) : (
                <Trophy className="w-5 h-5 text-[var(--color-text-muted)]" />
              )}
            </div>
            <span className={`text-xs truncate max-w-full text-center ${awayWon ? 'font-bold text-[var(--color-text-primary)]' : 'font-semibold text-[var(--color-text-secondary)]'}`}>
              {awayTeam?.name || 'TBD'}
            </span>
          </div>
        </div>

        {/* Footer: game name */}
        <div className="relative flex items-center justify-center gap-2 px-4 pb-3.5 pt-0">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-[0.2em]">
            {match.videogame?.name || 'Esport'}
          </span>
        </div>
      </div>
    </Link>
  );
}
