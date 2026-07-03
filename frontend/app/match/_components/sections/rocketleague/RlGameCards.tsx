'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../../lib/imageProxy';
import { pickThemeLogo } from '../../../../hooks/useIsDarkTheme';
import { rlArenaImage } from './rlAssets';
import { teamHref } from '../../../../lib/gameLinks';
import { parseGameWinner, type MatchSectionProps } from '../shared';
import type { PandaGame } from '../../../../types';

type TeamData = NonNullable<NonNullable<MatchSectionProps['match']['opponents']>[number]['opponent']>;

const OpponentSide = ({
  opponent,
  isSolo,
  url,
  isDark,
  winner,
  reverse,
}: {
  opponent?: TeamData | null;
  isSolo: boolean;
  url: string | null;
  isDark: boolean;
  winner: boolean;
  reverse: boolean;
}) => {
  const logo = isSolo ? null : pickThemeLogo(isDark, opponent?.image_url, opponent?.dark_image_url);

  const inner = (
    <>
      {/* Les matchs solo (1v1) n'ont pas de logo d'équipe */}
      {!isSolo && (
        <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl bg-[#060B13]/70 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 backdrop-blur-sm">
          {logo ? (
            <img src={proxyImageUrl(logo)} alt="" className="w-3/4 h-3/4 object-contain" loading="lazy" />
          ) : (
            <Shield className="w-4 h-4 text-white/30" />
          )}
        </div>
      )}
      <span
        className={`hidden sm:block text-sm md:text-base font-bold truncate transition-colors group-hover/team:text-accent ${
          reverse ? 'text-right' : ''
        } ${winner ? 'text-white' : 'text-white/80'}`}
      >
        {opponent?.acronym || opponent?.name || '-'}
      </span>
    </>
  );

  const cls = `flex items-center gap-2.5 md:gap-3.5 min-w-0 group/team ${reverse ? 'flex-row-reverse' : ''}`;

  // Pas de lien pour les opponents solo (pas de page équipe)
  if (url && !isSolo) {
    return <Link href={url} className={cls}>{inner}</Link>;
  }
  return <div className={cls}>{inner}</div>;
};

// Rocket League overtime : `ot` est "true" ou "t" (deux variantes observées),
// `otlength` est une chaîne au format "+M:SS" (ex. "+0:14", "+1:32").
function parseOT(extradata: Record<string, unknown>): { isOT: boolean; otlength: string | null } {
  const ot = extradata.ot;
  const isOT = ot === 'true' || ot === 't' || ot === true;
  const otlength = typeof extradata.otlength === 'string' ? extradata.otlength : null;
  return { isOT, otlength };
}

// Largeur du centre adaptée aux noms d'arènes RL plus longs que les maps CS.
const CENTER_WIDTH = 'min-w-[7rem] md:min-w-[10rem]';

export default function RlGameCards({ match, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');

  const homeOpp = match.opponents?.[0];
  const awayOpp = match.opponents?.[1];
  const homeTeam = homeOpp?.opponent;
  const awayTeam = awayOpp?.opponent;
  const isSoloHome = homeOpp?.type === 'solo';
  const isSoloAway = awayOpp?.type === 'solo';

  const homeUrl = homeTeam && !isSoloHome
    ? teamHref({
        wiki: match.wiki,
        template: homeTeam.template,
        id: homeTeam.id,
        name: homeTeam.name,
        acronym: homeTeam.acronym,
        image_url: homeTeam.image_url,
      })
    : null;

  const awayUrl = awayTeam && !isSoloAway
    ? teamHref({
        wiki: match.wiki,
        template: awayTeam.template,
        id: awayTeam.id,
        name: awayTeam.name,
        acronym: awayTeam.acronym,
        image_url: awayTeam.image_url,
      })
    : null;

  if (!match.games?.length) return null;

  return (
    <div className="space-y-4">
      {match.games.map((game: PandaGame) => {
        const winnerData = parseGameWinner(game.winner);
        const gameWinnerTeam = winnerData?.id
          ? match.opponents?.find((o) => o.opponent?.id === winnerData.id)?.opponent
          : null;
        const isHomeWin = !!gameWinnerTeam && gameWinnerTeam.id === homeTeam?.id;
        const isAwayWin = !!gameWinnerTeam && gameWinnerTeam.id === awayTeam?.id;
        const isGameLive = game.status === 'running';
        const isGameFinished = game.finished;
        const isUpcoming = !isGameFinished && !isGameLive;

        const homeMapScore = game.scores?.[0];
        const awayMapScore = game.scores?.[1];
        const hasScores = homeMapScore !== undefined && awayMapScore !== undefined;

        const splash = rlArenaImage(game.map);
        const { isOT, otlength } = parseOT(game.extradata ?? {});

        return (
          <div
            key={game.id}
            className={`rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 ${
              isGameLive ? 'ring-1 ring-[var(--color-status-live)]/40' : ''
            }`}
          >
            {/* Arena hero */}
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
                // Dégradé navy de substitution quand aucune image d'arène n'est disponible
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 ${
                    isUpcoming ? 'opacity-50' : ''
                  }`}
                />
              )}

              {/* Dégradé latéral pour lisibilité des scores */}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,11,19,0.96)_0%,rgba(6,11,19,0.6)_35%,rgba(6,11,19,0.25)_50%,rgba(6,11,19,0.6)_65%,rgba(6,11,19,0.96)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,19,0.35)_0%,transparent_30%,transparent_70%,rgba(6,11,19,0.45)_100%)]" />

              {/* Liseré côté gagnant */}
              {isHomeWin && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {isAwayWin && <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {isGameLive && (
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-status-live)] animate-pulse" />
              )}

              <div className="relative h-full flex items-center px-4 md:px-6 gap-3">
                {/* Côté home */}
                <div className="flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0">
                  <div className={isGameFinished && !isHomeWin ? 'opacity-50 min-w-0' : 'min-w-0'}>
                    <OpponentSide
                      opponent={homeTeam}
                      isSolo={isSoloHome}
                      url={homeUrl}
                      isDark={isDark}
                      winner={isHomeWin}
                      reverse={false}
                    />
                  </div>
                  {hasScores && (
                    <span
                      className={`ml-auto text-3xl md:text-5xl font-black tabular-nums ${
                        isHomeWin
                          ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]'
                          : 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]'
                      }`}
                    >
                      {homeMapScore}
                    </span>
                  )}
                </div>

                {/* Centre : numéro de game, nom d'arène, badge OT */}
                <div
                  className={`flex flex-col items-center justify-center flex-shrink-0 ${CENTER_WIDTH} text-center`}
                >
                  {isGameLive ? (
                    <span className="text-[10px] font-bold text-[var(--color-status-live)] uppercase tracking-[0.2em] animate-pulse mb-1">
                      {t('status_running')}
                    </span>
                  ) : (
                    <span className="text-[9px] md:text-[10px] font-bold text-white/90 uppercase tracking-[0.2em] mb-1">
                      {t('game_label')} {game.position}
                    </span>
                  )}

                  {game.map && (
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="hidden md:block w-4 h-px bg-white/30 flex-shrink-0" />
                      {/* Les noms d'arènes RL sont plus longs que les maps CS → text-[10px] */}
                      <span className="text-[10px] md:text-xs font-black text-white uppercase tracking-[0.2em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] leading-tight">
                        {game.map}
                      </span>
                      <span className="hidden md:block w-4 h-px bg-white/30 flex-shrink-0" />
                    </div>
                  )}

                  {isUpcoming && (
                    <span className="text-[10px] text-white/50 mt-0.5">{t('game_status_upcoming')}</span>
                  )}

                  {/* Badge OT : affiché uniquement sur les games terminées ou en cours */}
                  {isOT && !isUpcoming && (
                    <div className="mt-1">
                      <span className="inline-flex items-center px-1.5 py-px rounded-full bg-accent/15 border border-accent/30 text-[9px] font-bold text-accent uppercase tracking-wider">
                        {otlength ? `OT ${otlength}` : 'OT'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Côté away */}
                <div className="flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0 justify-end">
                  {hasScores && (
                    <span
                      className={`mr-auto text-3xl md:text-5xl font-black tabular-nums ${
                        isAwayWin
                          ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]'
                          : 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]'
                      }`}
                    >
                      {awayMapScore}
                    </span>
                  )}
                  <div className={isGameFinished && !isAwayWin ? 'opacity-50 min-w-0' : 'min-w-0'}>
                    <OpponentSide
                      opponent={awayTeam}
                      isSolo={isSoloAway}
                      url={awayUrl}
                      isDark={isDark}
                      winner={isAwayWin}
                      reverse={true}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
