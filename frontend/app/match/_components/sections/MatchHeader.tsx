'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Trophy, Calendar, RefreshCw } from 'lucide-react';
import LiquipediaBadge from '../../../components/common/LiquipediaBadge';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { teamHref } from '../../../lib/gameLinks';
import { valorantMapSplash } from './valorant/valorantAssets';
import { TeamLogo, parseGameWinner, formatDate, formatTime, type MatchSectionProps } from './shared';

export default function MatchHeader({ match, isLive, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');

  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const homeScore = match.results?.find(r => r.team_id === homeTeam?.id)?.score;
  const awayScore = match.results?.find(r => r.team_id === awayTeam?.id)?.score;
  const isHomeWinner = homeScore !== undefined && awayScore !== undefined && homeScore > awayScore;
  const isAwayWinner = homeScore !== undefined && awayScore !== undefined && awayScore > homeScore;
  const isFinished = match.status === 'finished';
  const statusKey = isLive ? 'status_running' : isFinished ? 'status_finished' : 'status_upcoming';

  const homeUrl = homeTeam ? teamHref({ wiki: match.wiki, template: homeTeam.template, id: homeTeam.id, name: homeTeam.name, acronym: homeTeam.acronym, image_url: homeTeam.image_url }) : null;
  const awayUrl = awayTeam ? teamHref({ wiki: match.wiki, template: awayTeam.template, id: awayTeam.id, name: awayTeam.name, acronym: awayTeam.acronym, image_url: awayTeam.image_url }) : null;

  const backdrop = match.wiki === 'valorant' ? valorantMapSplash(match.games?.[0]?.map) : null;

  return (
    <section className="relative w-full overflow-hidden pt-22 pb-8 md:pt-26 md:pb-10">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[var(--color-bg-secondary)]" />
        {backdrop && (
          <>
            <img src={backdrop} alt="" className="absolute inset-0 w-full h-full object-cover grayscale opacity-[0.16]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--color-bg-primary)_0%,transparent_35%,transparent_60%,var(--color-bg-primary)_100%)] opacity-90" />
          </>
        )}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/25 to-transparent" />
      </div>

      <div className="relative container mx-auto px-4">
        {/* Context pills */}
        <div className="flex items-center justify-center gap-2 mb-7 flex-wrap">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-[0.15em] border ${
            isLive
              ? 'bg-[var(--color-status-live)]/10 text-[var(--color-status-live)] border-[var(--color-status-live)]/25'
              : isFinished
                ? 'bg-[var(--color-status-finished)]/10 text-[var(--color-status-finished)] border-[var(--color-status-finished)]/25'
                : 'bg-[var(--color-status-upcoming)]/10 text-[var(--color-status-upcoming)] border-[var(--color-status-upcoming)]/25'
          }`}>
            {isLive && <span className="w-1.5 h-1.5 bg-[var(--color-status-live)] rounded-full animate-pulse" />}
            {t(statusKey)}
          </div>

          {match.number_of_games && (
            <span className="text-[10px] text-text-muted font-bold bg-[var(--color-bg-primary)]/40 px-2.5 py-1 rounded-md border border-[var(--color-border-primary)]/20">
              {t('bo_prefix')}{match.number_of_games}
            </span>
          )}

          {match.rescheduled && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-status-upcoming)] bg-[var(--color-status-upcoming)]/8 px-2.5 py-1 rounded-md border border-[var(--color-status-upcoming)]/20">
              <RefreshCw className="w-2.5 h-2.5" />
              {t('rescheduled')}
            </span>
          )}
        </div>

        {/* Main scoreboard */}
        <div className="flex items-center justify-center mb-6">
          {/* Home */}
          {(() => {
            const homeContent = (isLink: boolean) => (
              <div className={`flex-1 flex flex-col items-center gap-2 sm:gap-3 sm:flex-row sm:justify-end sm:gap-5 min-w-0 ${isLink ? 'group/home' : ''}`}>
                <div className="text-center sm:text-right order-2 sm:order-1 min-w-0 max-w-full">
                  <p className={`text-base sm:text-lg md:text-2xl lg:text-3xl font-black leading-tight truncate transition-colors ${isLink ? 'group-hover/home:text-accent' : ''} ${
                    isHomeWinner ? 'text-text-primary' : isFinished ? 'text-text-muted/50' : 'text-text-primary'
                  }`}>
                    {homeTeam?.name || '-'}
                  </p>
                  {homeTeam?.acronym && homeTeam.acronym.toUpperCase() !== homeTeam.name.toUpperCase() && (
                    <p className="text-[9px] sm:text-[10px] text-accent/70 font-bold tracking-[0.2em] uppercase mt-0.5 hidden sm:block">{homeTeam.acronym}</p>
                  )}
                </div>
                <div className="order-1 sm:order-2">
                  <TeamLogo team={homeTeam} isDark={isDark} highlight={isHomeWinner} />
                </div>
              </div>
            );
            return homeUrl
              ? <Link href={homeUrl} className="flex-1 min-w-0">{homeContent(true)}</Link>
              : <div className="flex-1 min-w-0">{homeContent(false)}</div>;
          })()}

          {/* Score center */}
          <div className="flex flex-col items-center px-2 sm:px-5 md:px-12 flex-shrink-0">
            {isFinished && homeScore !== undefined && awayScore !== undefined ? (
              <div className="flex items-baseline gap-2 sm:gap-3 md:gap-5">
                <span className={`text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tabular-nums tracking-tight ${isHomeWinner ? 'text-accent' : 'text-text-primary/30'}`}>{homeScore}</span>
                <span className="text-xl sm:text-2xl md:text-3xl font-thin text-text-muted/30 select-none">:</span>
                <span className={`text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tabular-nums tracking-tight ${isAwayWinner ? 'text-accent' : 'text-text-primary/30'}`}>{awayScore}</span>
              </div>
            ) : isLive ? (
              <div className="flex flex-col items-center">
                <div className="flex items-baseline gap-2 sm:gap-3 md:gap-5">
                  <span className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tabular-nums tracking-tight text-accent">{homeScore ?? 0}</span>
                  <span className="text-xl sm:text-2xl md:text-3xl font-thin text-accent/30 select-none">:</span>
                  <span className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tabular-nums tracking-tight text-accent">{awayScore ?? 0}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-text-muted/20 tracking-[-0.05em] select-none">VS</span>
              </div>
            )}

            {isFinished && match.winner && (
              <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2">
                <Trophy className="w-3 h-3 text-accent" />
                <span className="text-[9px] sm:text-[10px] font-bold text-accent uppercase tracking-[0.15em]">
                  {match.winner.acronym || match.winner.name} {t('wins')}
                </span>
              </div>
            )}

            {match.games && match.games.length > 1 && (
              <div className="flex items-center gap-1.5 mt-2 sm:mt-3">
                {match.games.map((game, idx) => {
                  const w = parseGameWinner(game.winner);
                  const isGHomeWin = w?.id === homeTeam?.id;
                  const isGAwayWin = w?.id === awayTeam?.id;
                  const isGameLive = game.status === 'running';
                  return (
                    <div key={idx} title={`Game ${game.position}`} className={`w-2 h-2 rounded-full transition-all ${
                      isGameLive ? 'bg-[var(--color-status-live)] animate-pulse scale-125'
                        : isGHomeWin ? 'bg-accent'
                        : isGAwayWin ? 'bg-[var(--color-bg-tertiary)]'
                        : 'border border-[var(--color-border-primary)]/50'
                    }`} />
                  );
                })}
              </div>
            )}
          </div>

          {/* Away */}
          {(() => {
            const awayContent = (isLink: boolean) => (
              <div className={`flex-1 flex flex-col items-center gap-2 sm:gap-3 sm:flex-row sm:justify-start sm:gap-5 min-w-0 ${isLink ? 'group/away' : ''}`}>
                <TeamLogo team={awayTeam} isDark={isDark} highlight={isAwayWinner} />
                <div className="text-center sm:text-left min-w-0 max-w-full">
                  <p className={`text-base sm:text-lg md:text-2xl lg:text-3xl font-black leading-tight truncate transition-colors ${isLink ? 'group-hover/away:text-accent' : ''} ${
                    isAwayWinner ? 'text-text-primary' : isFinished ? 'text-text-muted/50' : 'text-text-primary'
                  }`}>
                    {awayTeam?.name || '-'}
                  </p>
                  {awayTeam?.acronym && awayTeam.acronym.toUpperCase() !== awayTeam.name.toUpperCase() && (
                    <p className="text-[9px] sm:text-[10px] text-accent/70 font-bold tracking-[0.2em] uppercase mt-0.5 hidden sm:block">{awayTeam.acronym}</p>
                  )}
                </div>
              </div>
            );
            return awayUrl
              ? <Link href={awayUrl} className="flex-1 min-w-0">{awayContent(true)}</Link>
              : <div className="flex-1 min-w-0">{awayContent(false)}</div>;
          })()}
        </div>

        {/* Context info bar */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap text-[10px] sm:text-[11px] text-text-muted">
          {match.tournament?.name && (
            <div className="flex items-center gap-1.5">
              {pickThemeLogo(isDark, (match.tournament as any)?.icon_url, (match.tournament as any)?.icon_dark_url) && (
                <img src={proxyImageUrl(pickThemeLogo(isDark, (match.tournament as any)?.icon_url, (match.tournament as any)?.icon_dark_url)!)} alt="" className="w-3.5 h-3.5 object-contain opacity-60" />
              )}
              <span className="text-text-secondary font-medium">{match.tournament.name}</span>
            </div>
          )}
          {match.begin_at && (
            <>
              <span className="w-0.5 h-0.5 rounded-full bg-text-muted/40" />
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-accent/50" />
                <span>{formatDate(match.begin_at)}</span>
                <span className="text-text-muted/40">/</span>
                <span>{formatTime(match.begin_at)}</span>
              </div>
            </>
          )}
          {match.rescheduled && match.original_scheduled_at && (
            <>
              <span className="w-0.5 h-0.5 rounded-full bg-text-muted/40" />
              <div className="flex items-center gap-1 text-[var(--color-status-upcoming)]">
                <RefreshCw className="w-3 h-3" />
                <span className="line-through opacity-50">{formatDate(match.original_scheduled_at)} {formatTime(match.original_scheduled_at)}</span>
              </div>
            </>
          )}
          <span className="w-0.5 h-0.5 rounded-full bg-text-muted/40" />
          <LiquipediaBadge />
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--color-border-primary)]/40 to-transparent" />
    </section>
  );
}
