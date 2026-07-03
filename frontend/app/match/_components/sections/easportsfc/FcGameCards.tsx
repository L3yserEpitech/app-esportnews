'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../../lib/imageProxy';
import { pickThemeLogo } from '../../../../hooks/useIsDarkTheme';
import { teamHref } from '../../../../lib/gameLinks';
import { parseGameWinner, type MatchSectionProps } from '../shared';

type Team = NonNullable<NonNullable<MatchSectionProps['match']['opponents']>[number]['opponent']>;

// penaltyscores est un objet Lua {"1": <home>, "2": <away>} — pas un array.
// Clé "1" = side home (opponents[0]), "2" = side away (opponents[1]).
function parsePenalties(
  extradata: Record<string, unknown> | undefined,
): { home: number; away: number } | null {
  const raw = extradata?.penaltyscores;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const home = Number(obj['1']);
  const away = Number(obj['2']);
  if (isNaN(home) || isNaN(away)) return null;
  return { home, away };
}

const TeamSide = ({
  team,
  url,
  isDark,
  winner,
  reverse,
}: {
  team?: Team | null;
  url: string | null;
  isDark: boolean;
  winner: boolean;
  reverse: boolean;
}) => {
  const logo = pickThemeLogo(isDark, team?.image_url, team?.dark_image_url);
  const inner = (
    <>
      <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-[#060B13]/70 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 backdrop-blur-sm">
        {logo ? (
          <img
            src={proxyImageUrl(logo)}
            alt=""
            className="w-3/4 h-3/4 object-contain"
            loading="lazy"
          />
        ) : (
          <Shield className="w-4 h-4 text-white/30" />
        )}
      </div>
      <span
        className={`hidden sm:block text-sm md:text-base font-bold truncate transition-colors group-hover/team:text-accent ${
          reverse ? 'text-right' : ''
        } ${winner ? 'text-white' : 'text-white/80'}`}
      >
        {team?.acronym || team?.name || '-'}
      </span>
    </>
  );
  const cls = `flex items-center gap-2.5 md:gap-3.5 min-w-0 group/team ${
    reverse ? 'flex-row-reverse' : ''
  }`;
  return url ? (
    <Link href={url} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
};

// Cartes de score football par game, sans image de stade (EA FC n'expose pas
// d'arènes via l'API v3). Le fond dégradé navy remplace le hero image des autres jeux.
// La pill tirs au but (penaltyscores) est le différenciateur visuel de ce rendu.
export default function FcGameCards({ match, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const homeUrl = homeTeam
    ? teamHref({
        wiki: match.wiki,
        template: homeTeam.template,
        id: homeTeam.id,
        name: homeTeam.name,
        acronym: homeTeam.acronym,
        image_url: homeTeam.image_url,
      })
    : null;
  const awayUrl = awayTeam
    ? teamHref({
        wiki: match.wiki,
        template: awayTeam.template,
        id: awayTeam.id,
        name: awayTeam.name,
        acronym: awayTeam.acronym,
        image_url: awayTeam.image_url,
      })
    : null;

  return (
    <div className="space-y-4">
      {match.games!.map((game) => {
        const winnerData = parseGameWinner(game.winner);
        const gameWinnerTeam = winnerData?.id
          ? match.opponents?.find((o) => o.opponent?.id === winnerData.id)?.opponent
          : null;
        const isHomeWin = !!gameWinnerTeam && gameWinnerTeam.id === homeTeam?.id;
        const isAwayWin = !!gameWinnerTeam && gameWinnerTeam.id === awayTeam?.id;
        const isGameLive = game.status === 'running';
        const isGameFinished = game.finished;
        const isUpcoming = !isGameFinished && !isGameLive;
        const homeScore = game.scores?.[0];
        const awayScore = game.scores?.[1];
        const hasScores = homeScore !== undefined && awayScore !== undefined;
        const penalties = parsePenalties(game.extradata);
        const penHomeWin = penalties ? penalties.home > penalties.away : false;
        const penAwayWin = penalties ? penalties.away > penalties.home : false;

        // Couleur du score : accent + glow pour le gagnant, white/45 pour le perdant
        // (uniquement une fois le game terminé — live garde les deux en blanc normal).
        const homeScoreClass = isHomeWin
          ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]'
          : isGameFinished && isAwayWin
            ? 'text-white/45'
            : 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]';
        const awayScoreClass = isAwayWin
          ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]'
          : isGameFinished && isHomeWin
            ? 'text-white/45'
            : 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]';

        return (
          <div
            key={game.id}
            className={`rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 ${
              isGameLive ? 'ring-1 ring-[var(--color-status-live)]/40' : ''
            }`}
          >
            {/* Hero dégradé navy (pas d'image de stade disponible dans l'API) */}
            <div
              className={`group relative bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 ${
                isUpcoming ? 'h-[72px] md:h-[84px]' : 'h-[104px] md:h-[132px]'
              }`}
            >
              {isHomeWin && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {isAwayWin && <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {isGameLive && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-status-live)] animate-pulse" />
              )}

              <div className="relative h-full flex items-center px-4 md:px-6 gap-3">
                {/* Equipe home */}
                <div className="flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0">
                  <div className={isGameFinished && !isHomeWin ? 'opacity-50 min-w-0' : 'min-w-0'}>
                    <TeamSide
                      team={homeTeam}
                      url={homeUrl}
                      isDark={isDark}
                      winner={isHomeWin}
                      reverse={false}
                    />
                  </div>
                  {hasScores && (
                    <span
                      className={`ml-auto text-3xl md:text-5xl font-black tabular-nums ${homeScoreClass}`}
                    >
                      {homeScore}
                    </span>
                  )}
                </div>

                {/* Centre : label "Game N" + badge live ou "À venir" */}
                <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[6rem] md:min-w-[9rem] text-center">
                  {isGameLive ? (
                    <span className="text-[10px] font-bold text-[var(--color-status-live)] uppercase tracking-[0.2em] animate-pulse">
                      {t('status_running')}
                    </span>
                  ) : (
                    <span className="text-[9px] md:text-[10px] font-bold text-white/70 uppercase tracking-[0.25em]">
                      {t('game_label')} {game.position}
                    </span>
                  )}
                  {isUpcoming && (
                    <span className="text-[10px] text-white/50 mt-0.5">
                      {t('game_status_upcoming')}
                    </span>
                  )}
                </div>

                {/* Equipe away */}
                <div className="flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0 justify-end">
                  {hasScores && (
                    <span
                      className={`mr-auto text-3xl md:text-5xl font-black tabular-nums ${awayScoreClass}`}
                    >
                      {awayScore}
                    </span>
                  )}
                  <div className={isGameFinished && !isAwayWin ? 'opacity-50 min-w-0' : 'min-w-0'}>
                    <TeamSide
                      team={awayTeam}
                      url={awayUrl}
                      isDark={isDark}
                      winner={isAwayWin}
                      reverse={true}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Pill tirs au but — uniquement quand penaltyscores est présent dans l'API */}
            {penalties && (
              <div className="bg-[var(--color-bg-secondary)]/40 border-t border-[var(--color-border-primary)]/20 px-4 md:px-5 py-2.5 flex items-center justify-center gap-3">
                <span className="text-[9px] font-bold text-text-muted uppercase tracking-[0.15em]">
                  {t('penalties')}
                </span>
                <div className="flex items-center gap-1.5 rounded-full bg-[var(--color-bg-primary)]/60 border border-[var(--color-border-primary)]/25 px-3.5 py-1">
                  <span
                    className={`text-sm font-black tabular-nums ${
                      penHomeWin ? 'text-accent' : 'text-text-secondary'
                    }`}
                  >
                    {penalties.home}
                  </span>
                  <span className="text-[10px] text-text-muted/50 mx-0.5">–</span>
                  <span
                    className={`text-sm font-black tabular-nums ${
                      penAwayWin ? 'text-accent' : 'text-text-secondary'
                    }`}
                  >
                    {penalties.away}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
