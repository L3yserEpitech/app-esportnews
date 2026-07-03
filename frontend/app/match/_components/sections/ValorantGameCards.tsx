'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { valorantMapSplash, valorantAgentIcon } from '../../../lib/valorantAssets';
import { teamHref } from '../../../lib/gameLinks';
import { parseGameWinner, type MatchSectionProps } from './shared';
import { parseDraft } from './draft';
import { buildPlayerRows } from './statColumns';
import type { PandaGame } from '../../../types';

type Team = NonNullable<NonNullable<MatchSectionProps['match']['opponents']>[number]['opponent']>;

const TeamSide = ({ team, url, isDark, winner, reverse }: {
  team?: Team | null;
  url: string | null;
  isDark: boolean;
  winner: boolean;
  reverse: boolean;
}) => {
  const inner = (
    <>
      <SideLogo team={team} isDark={isDark} />
      <span className={`hidden sm:block text-sm md:text-base font-bold truncate transition-colors group-hover/team:text-accent ${
        reverse ? 'text-right' : ''
      } ${winner ? 'text-white' : 'text-white/80'}`}>
        {team?.acronym || team?.name || '-'}
      </span>
    </>
  );
  const cls = `flex items-center gap-2.5 md:gap-3.5 min-w-0 group/team ${reverse ? 'flex-row-reverse' : ''}`;
  return url ? <Link href={url} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
};

const SideLogo = ({ team, isDark }: { team?: Team | null; isDark: boolean }) => {
  const logo = pickThemeLogo(isDark, team?.image_url, team?.dark_image_url);
  return (
    <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-[#060B13]/70 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 backdrop-blur-sm">
      {logo ? (
        <img src={proxyImageUrl(logo)} alt="" className="w-3/4 h-3/4 object-contain" loading="lazy" />
      ) : (
        <Shield className="w-4 h-4 text-white/30" />
      )}
    </div>
  );
};

const AgentTile = ({ name }: { name: string }) => {
  const icon = valorantAgentIcon(name);
  return (
    <div className="group/agent flex flex-col items-center gap-1" title={name}>
      <div className="w-9 h-9 md:w-11 md:h-11 rounded-lg overflow-hidden border border-[var(--color-border-primary)]/40 bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 flex items-center justify-center transition-all duration-300 group-hover/agent:border-accent/50 group-hover/agent:scale-105">
        {icon ? (
          <img src={icon} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-[9px] font-bold text-text-secondary px-0.5 text-center leading-tight">{name}</span>
        )}
      </div>
      <span className="text-[8px] font-semibold uppercase tracking-wide text-text-muted">{name}</span>
    </div>
  );
};

const StatsTable = ({ game, wiki, teamIndex }: { game: PandaGame; wiki: string; teamIndex: 1 | 2 }) => {
  const t = useTranslations('pages_detail.match_detail');
  const { team1, team2, columns } = buildPlayerRows(game, wiki);
  const rows = teamIndex === 1 ? team1 : team2;
  if (columns.length === 0 || rows.length === 0) return null;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-text-muted uppercase tracking-wider text-[10px]">
          <th className="text-left py-1.5 px-2">{t('stat_col.player')}</th>
          {columns.map(c => <th key={c.key} className="text-right py-1.5 px-2">{t(`stat_col.${c.label}`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-[var(--color-border-primary)]/15">
            <td className="text-left py-1.5 px-2 font-semibold text-text-primary truncate">{r.player}</td>
            {columns.map(c => <td key={c.key} className="text-right py-1.5 px-2 tabular-nums text-text-secondary">{r.cells[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// Per-map blocks: the map splash hero (score) with that game's draft and player
// stats nested right below it. Valorant-only replacement for the generic
// gameResults + draft + playerStats trio.
export default function ValorantGameCards({ match, isDark, game: gameEntry }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const wiki = match.wiki || gameEntry?.wiki || 'valorant';
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const homeUrl = homeTeam ? teamHref({ wiki: match.wiki, template: homeTeam.template, id: homeTeam.id, name: homeTeam.name, acronym: homeTeam.acronym, image_url: homeTeam.image_url }) : null;
  const awayUrl = awayTeam ? teamHref({ wiki: match.wiki, template: awayTeam.template, id: awayTeam.id, name: awayTeam.name, acronym: awayTeam.acronym, image_url: awayTeam.image_url }) : null;

  return (
    <div className="space-y-4">
      {match.games!.map((game) => {
        const winnerData = parseGameWinner(game.winner);
        const gameWinnerTeam = winnerData?.id
          ? match.opponents?.find(o => o.opponent?.id === winnerData.id)?.opponent
          : null;
        const isHomeWin = !!gameWinnerTeam && gameWinnerTeam.id === homeTeam?.id;
        const isAwayWin = !!gameWinnerTeam && gameWinnerTeam.id === awayTeam?.id;
        const isGameLive = game.status === 'running';
        const isGameFinished = game.finished;
        const isUpcoming = !isGameFinished && !isGameLive;
        const homeMapScore = game.scores?.[0];
        const awayMapScore = game.scores?.[1];
        const hasScores = homeMapScore !== undefined && awayMapScore !== undefined;
        const splash = valorantMapSplash(game.map);
        const draft = parseDraft(game);
        const { team1: statRows1, team2: statRows2, columns } = buildPlayerRows(game, wiki);
        const hasStats = columns.length > 0 && (statRows1.length > 0 || statRows2.length > 0);
        const hasDetails = !!draft || hasStats;

        return (
          <div
            key={game.id}
            className={`rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 ${
              isGameLive ? 'ring-1 ring-[var(--color-status-live)]/40' : ''
            }`}
          >
            {/* Map hero */}
            <div className={`group relative ${isUpcoming ? 'h-[72px] md:h-[84px]' : 'h-[104px] md:h-[132px]'}`}>
              {splash ? (
                <img
                  src={splash}
                  alt=""
                  loading="lazy"
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 ${
                    isUpcoming ? 'grayscale opacity-50' : ''
                  }`}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#091626] to-[#182859]/40" />
              )}

              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,11,19,0.96)_0%,rgba(6,11,19,0.6)_35%,rgba(6,11,19,0.25)_50%,rgba(6,11,19,0.6)_65%,rgba(6,11,19,0.96)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,19,0.35)_0%,transparent_30%,transparent_70%,rgba(6,11,19,0.45)_100%)]" />

              {isHomeWin && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {isAwayWin && <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {isGameLive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-status-live)] animate-pulse" />}

              <div className="relative h-full flex items-center px-4 md:px-6 gap-3">
                <div className={`flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0 ${isGameFinished && !isHomeWin ? 'opacity-50' : ''}`}>
                  <TeamSide team={homeTeam} url={homeUrl} isDark={isDark} winner={isHomeWin} reverse={false} />
                  {hasScores && (
                    <span className={`ml-auto text-3xl md:text-5xl font-black tabular-nums ${
                      isHomeWin ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]' : 'text-white/45'
                    }`}>
                      {homeMapScore}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[6rem] md:min-w-[9rem] text-center">
                  {isGameLive ? (
                    <span className="text-[10px] font-bold text-[var(--color-status-live)] uppercase tracking-[0.2em] animate-pulse mb-1">
                      {t('status_running')}
                    </span>
                  ) : (
                    <span className="text-[9px] md:text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mb-1">
                      {t('game_label')} {game.position}
                    </span>
                  )}
                  {game.map && (
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="hidden md:block w-5 h-px bg-white/30" />
                      <span className="text-sm md:text-lg font-black text-white uppercase tracking-[0.25em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                        {game.map}
                      </span>
                      <span className="hidden md:block w-5 h-px bg-white/30" />
                    </div>
                  )}
                  {isUpcoming && (
                    <span className="text-[10px] text-white/50 mt-0.5">{t('game_status_upcoming')}</span>
                  )}
                </div>

                <div className={`flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0 justify-end ${isGameFinished && !isAwayWin ? 'opacity-50' : ''}`}>
                  {hasScores && (
                    <span className={`mr-auto text-3xl md:text-5xl font-black tabular-nums ${
                      isAwayWin ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]' : 'text-white/45'
                    }`}>
                      {awayMapScore}
                    </span>
                  )}
                  <TeamSide team={awayTeam} url={awayUrl} isDark={isDark} winner={isAwayWin} reverse={true} />
                </div>
              </div>
            </div>

            {/* Draft + stats for this map */}
            {hasDetails && (
              <div className="bg-[var(--color-bg-secondary)]/40 border-t border-[var(--color-border-primary)]/20 p-4 md:p-5 space-y-5">
                {draft && (draft.team1.picks.length > 0 || draft.team2.picks.length > 0) && (
                  <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-wrap gap-2 md:gap-2.5">
                      {draft.team1.picks.map((p, i) => <AgentTile key={`${p}-${i}`} name={p} />)}
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-2.5 justify-end">
                      {draft.team2.picks.map((p, i) => <AgentTile key={`${p}-${i}`} name={p} />)}
                    </div>
                    <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black text-text-muted/30 tracking-widest">VS</span>
                    </div>
                  </div>
                )}
                {hasStats && (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-[var(--color-border-primary)]/25 bg-[var(--color-bg-primary)]/30 p-2 overflow-x-auto">
                      <StatsTable game={game} wiki={wiki} teamIndex={1} />
                    </div>
                    <div className="rounded-lg border border-[var(--color-border-primary)]/25 bg-[var(--color-bg-primary)]/30 p-2 overflow-x-auto">
                      <StatsTable game={game} wiki={wiki} teamIndex={2} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
