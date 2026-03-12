'use client';

import React from 'react';
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

  return (
    <Link href={`/match/${match.match2id || match.id}${match.wiki ? `?wiki=${match.wiki}` : ''}`}>
      <div className="group relative cursor-pointer rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)]/50 hover:border-[var(--color-accent)]/40 transition-all duration-200">

        {/* Header: tournament + status */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {leagueImg && (
              <div className="w-5 h-5 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={proxyImageUrl(leagueImg)} alt="" className="w-4 h-4 object-contain" loading="lazy" />
              </div>
            )}
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium truncate">
              {match.league?.name || match.tournament?.name || match.name}
            </span>
          </div>

          {/* Status badge */}
          {isLive ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--color-status-live)]/15 rounded flex-shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-status-live)] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-status-live)]" />
              </span>
              <span className="text-[10px] font-bold text-[var(--color-status-live)] uppercase">Live</span>
            </div>
          ) : isFinished ? (
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase px-2 py-0.5 bg-[var(--color-bg-primary)]/40 rounded flex-shrink-0">
              Terminé
            </span>
          ) : timeStr ? (
            <span className="text-[11px] font-semibold text-[var(--color-text-primary)] tabular-nums flex-shrink-0">
              {timeStr}
            </span>
          ) : null}
        </div>

        {/* Match content: logos + score */}
        <div className="flex items-center justify-between px-5 py-5">

          {/* Home team */}
          <div
            className="flex-1 flex flex-col items-center gap-2 min-w-0 cursor-pointer"
            onClick={teamClick(homeTeam)}
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-[var(--color-bg-primary)]/60 border border-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden hover:border-[var(--color-accent)]/40 transition-colors">
              {pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url) ? (
                <img
                  src={proxyImageUrl(pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url)!)}
                  alt={homeTeam?.name || ''}
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                  loading="lazy"
                />
              ) : (
                <Trophy className="w-5 h-5 text-[var(--color-text-muted)]" />
              )}
            </div>
            <span className="text-xs font-bold text-[var(--color-text-primary)] truncate max-w-full text-center hover:text-[var(--color-accent)] transition-colors">
              {homeTeam?.name || 'TBD'}
            </span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center gap-1.5 px-3">
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
              <span className="text-[10px] text-[var(--color-text-muted)] font-medium bg-[var(--color-bg-primary)]/60 px-2 py-0.5 rounded">
                BO{match.number_of_games}
              </span>
            )}
          </div>

          {/* Away team */}
          <div
            className="flex-1 flex flex-col items-center gap-2 min-w-0 cursor-pointer"
            onClick={teamClick(awayTeam)}
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-[var(--color-bg-primary)]/60 border border-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden hover:border-[var(--color-accent)]/40 transition-colors">
              {pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url) ? (
                <img
                  src={proxyImageUrl(pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url)!)}
                  alt={awayTeam?.name || ''}
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                  loading="lazy"
                />
              ) : (
                <Trophy className="w-5 h-5 text-[var(--color-text-muted)]" />
              )}
            </div>
            <span className="text-xs font-bold text-[var(--color-text-primary)] truncate max-w-full text-center hover:text-[var(--color-accent)] transition-colors">
              {awayTeam?.name || 'TBD'}
            </span>
          </div>
        </div>

        {/* Footer: game name */}
        <div className="flex items-center justify-center gap-2 px-4 pb-3 pt-0">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {match.videogame?.name || 'Esport'}
          </span>
        </div>
      </div>
    </Link>
  );
}
