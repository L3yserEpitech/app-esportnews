'use client';
import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { valorantMapSplash } from '../../../lib/valorantAssets';
import { parseGameWinner, type MatchSectionProps } from './shared';

type Team = NonNullable<NonNullable<MatchSectionProps['match']['opponents']>[number]['opponent']>;

const SideLogo = ({ team, isDark, dimmed }: { team?: Team | null; isDark: boolean; dimmed: boolean }) => {
  const logo = pickThemeLogo(isDark, team?.image_url, team?.dark_image_url);
  return (
    <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl bg-[#060B13]/70 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 backdrop-blur-sm transition-opacity ${dimmed ? 'opacity-40' : ''}`}>
      {logo ? (
        <img src={proxyImageUrl(logo)} alt="" className="w-3/4 h-3/4 object-contain" loading="lazy" />
      ) : (
        <Shield className="w-4 h-4 text-white/30" />
      )}
    </div>
  );
};

// "Map Hero" cards — the map splash fills the card, darkened towards the edges
// so scores stay readable. Valorant-only variant of the game details list.
export default function ValorantGameCards({ match, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;

  return (
    <div className="space-y-3">
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

        return (
          <div
            key={game.id}
            className={`group relative rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 ${
              isUpcoming ? 'h-[72px] md:h-[84px]' : 'h-[104px] md:h-[132px]'
            } ${isGameLive ? 'ring-1 ring-[var(--color-status-live)]/40' : ''}`}
          >
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
                <SideLogo team={homeTeam} isDark={isDark} dimmed={false} />
                <span className={`hidden sm:block text-sm md:text-base font-bold truncate ${isHomeWin ? 'text-white' : 'text-white/80'}`}>
                  {homeTeam?.acronym || homeTeam?.name || '-'}
                </span>
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
                <span className={`hidden sm:block text-sm md:text-base font-bold truncate text-right ${isAwayWin ? 'text-white' : 'text-white/80'}`}>
                  {awayTeam?.acronym || awayTeam?.name || '-'}
                </span>
                <SideLogo team={awayTeam} isDark={isDark} dimmed={false} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
