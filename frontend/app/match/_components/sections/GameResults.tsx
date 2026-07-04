'use client';
import { useTranslations } from 'next-intl';
import { Gamepad2, Trophy, Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { SectionHeader, parseGameWinner, formatDuration, type MatchSectionProps } from './shared';
import ValorantGameCards from './valorant/ValorantGameCards';
import LolGameCards from './leagueoflegends/LolGameCards';
import CsGameCards from './counterstrike/CsGameCards';
import DotaGameCards from './dota2/DotaGameCards';
import RlGameCards from './rocketleague/RlGameCards';
import R6GameCards from './rainbowsix/R6GameCards';
import OwGameCards from './overwatch/OwGameCards';
import CodGameCards from './callofduty/CodGameCards';
import FcGameCards from './easportsfc/FcGameCards';

export default function GameResults(props: MatchSectionProps) {
  const { match, isDark, game: gameEntry } = props;
  const t = useTranslations('pages_detail.match_detail');

  // Certains events ne renseignent que le score de série sur Liquipedia
  // (match2games vide) — on le dit plutôt que de masquer la section.
  if (!match.games || match.games.length === 0) {
    return (
      <section>
        <SectionHeader icon={Gamepad2} title={t('section_game_details')} />
        <div className="rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 px-4 py-8 flex flex-col items-center gap-2 text-center">
          <Gamepad2 className="w-5 h-5 text-text-muted/40" />
          <span className="text-sm text-text-muted">{t('no_game_details')}</span>
        </div>
      </section>
    );
  }

  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;
  const wiki = match.wiki || gameEntry?.wiki;
  const isValorant = wiki === 'valorant';
  const isLol = wiki === 'leagueoflegends';
  const isCs = wiki === 'counterstrike';
  const isDota = wiki === 'dota2';
  const isRl = wiki === 'rocketleague';
  const isR6 = wiki === 'rainbowsix';
  const isOw = wiki === 'overwatch';
  const isCod = wiki === 'callofduty';
  const isFc = wiki === 'easportsfc';

  return (
    <section>
      <SectionHeader
        icon={Gamepad2}
        title={t('section_game_details')}
        extra={match.number_of_games ? (
          <span className="text-[10px] text-text-muted font-mono tracking-wide">
            {match.games.filter(g => g.finished).length}/{match.number_of_games} {t('stat_games_played')}
          </span>
        ) : undefined}
      />

      {isValorant ? <ValorantGameCards {...props} /> : isLol ? <LolGameCards {...props} /> : isCs ? <CsGameCards {...props} /> : isDota ? <DotaGameCards {...props} /> : isRl ? <RlGameCards {...props} /> : isR6 ? <R6GameCards {...props} /> : isOw ? <OwGameCards {...props} /> : isCod ? <CodGameCards {...props} /> : isFc ? <FcGameCards {...props} /> : (
      <div className="rounded-xl border border-[var(--color-border-primary)]/30 overflow-hidden bg-[var(--color-bg-secondary)]/40">
        {match.games.map((game, idx) => {
          const winnerData = parseGameWinner(game.winner);
          const gameWinnerTeam = winnerData?.id
            ? match.opponents?.find(o => o.opponent?.id === winnerData.id)?.opponent
            : null;
          const isHomeWin = gameWinnerTeam?.id === homeTeam?.id;
          const isAwayWin = gameWinnerTeam?.id === awayTeam?.id;
          const isGameLive = game.status === 'running';
          const isGameFinished = game.finished;
          const isLast = idx === match.games!.length - 1;
          const homeMapScore = game.scores?.[0];
          const awayMapScore = game.scores?.[1];
          const hasScores = homeMapScore !== undefined && awayMapScore !== undefined;

          return (
            <div
              key={game.id}
              className={`px-4 md:px-5 py-3.5 transition-colors hover:bg-[var(--color-bg-hover)] ${
                !isLast ? 'border-b border-[var(--color-border-primary)]/15' : ''
              } ${isGameLive ? 'border-l-2 border-l-[var(--color-status-live)] bg-[var(--color-status-live)]/[0.03]' : 'border-l-2 border-l-transparent'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  isGameLive
                    ? 'bg-[var(--color-status-live)]/12 text-[var(--color-status-live)] ring-1 ring-[var(--color-status-live)]/25'
                    : isGameFinished
                      ? 'bg-[var(--color-bg-primary)]/60 text-text-primary/70 ring-1 ring-[var(--color-border-primary)]/30'
                      : 'bg-[var(--color-bg-primary)]/30 text-text-muted/50 ring-1 ring-[var(--color-border-primary)]/15'
                }`}>
                  {game.position}
                </div>

                <div className={`flex items-center gap-2.5 flex-1 min-w-0 transition-opacity ${isGameFinished && !isHomeWin ? 'opacity-40' : ''}`}>
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-bg-primary)]/60 border border-[var(--color-border-primary)]/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url) ? (
                      <img src={proxyImageUrl(pickThemeLogo(isDark, homeTeam?.image_url, homeTeam?.dark_image_url)!)} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                    ) : (
                      <Shield className="w-3.5 h-3.5 text-text-muted/40" />
                    )}
                  </div>
                  <span className={`text-sm font-semibold truncate ${isHomeWin ? 'text-accent' : 'text-text-primary'}`}>
                    {homeTeam?.acronym || homeTeam?.name || '-'}
                  </span>
                  {hasScores && (
                    <span className={`text-lg font-black tabular-nums ml-auto ${isHomeWin ? 'text-accent' : 'text-text-primary/50'}`}>{homeMapScore}</span>
                  )}
                </div>

                <div className="flex-shrink-0 flex flex-col items-center justify-center min-w-[4rem] sm:min-w-[5rem]">
                  {game.map ? (
                    <span className="text-[11px] font-semibold text-text-secondary">{game.map}</span>
                  ) : isGameLive ? (
                    <span className="w-2 h-2 bg-[var(--color-status-live)] rounded-full animate-pulse" />
                  ) : gameWinnerTeam ? (
                    <Trophy className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <span className="w-3 h-px bg-[var(--color-border-primary)]/40" />
                  )}
                </div>

                <div className={`flex items-center gap-2.5 flex-1 min-w-0 justify-end transition-opacity ${isGameFinished && !isAwayWin ? 'opacity-40' : ''}`}>
                  {hasScores && (
                    <span className={`text-lg font-black tabular-nums mr-auto ${isAwayWin ? 'text-accent' : 'text-text-primary/50'}`}>{awayMapScore}</span>
                  )}
                  <span className={`text-sm font-semibold truncate text-right ${isAwayWin ? 'text-accent' : 'text-text-primary'}`}>
                    {awayTeam?.acronym || awayTeam?.name || '-'}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-bg-primary)]/60 border border-[var(--color-border-primary)]/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url) ? (
                      <img src={proxyImageUrl(pickThemeLogo(isDark, awayTeam?.image_url, awayTeam?.dark_image_url)!)} alt="" className="w-5 h-5 object-contain" loading="lazy" />
                    ) : (
                      <Shield className="w-3.5 h-3.5 text-text-muted/40" />
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 w-14 text-right">
                  {isGameLive ? (
                    <span className="text-[10px] font-bold text-[var(--color-status-live)] uppercase tracking-wider">{t('game_status_running')}</span>
                  ) : game.length ? (
                    <span className="text-[10px] text-text-muted font-mono">{formatDuration(game.length)}</span>
                  ) : isGameFinished ? (
                    <span className="text-[10px] text-text-muted">{t('game_status_finished')}</span>
                  ) : (
                    <span className="text-[10px] text-text-muted/30">—</span>
                  )}
                </div>
              </div>

              {isGameFinished && hasScores && gameWinnerTeam && (
                <div className="flex items-center justify-center mt-1.5">
                  <div className="flex items-center gap-1">
                    <Trophy className="w-2.5 h-2.5 text-accent/60" />
                    <span className="text-[9px] font-bold text-accent/60 uppercase tracking-wider">{gameWinnerTeam.acronym || gameWinnerTeam.name}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}
