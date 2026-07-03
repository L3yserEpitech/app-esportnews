'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../../lib/imageProxy';
import { pickThemeLogo } from '../../../../hooks/useIsDarkTheme';
import { lolChampSplash, lolChampIcon, lolSpellIcon, useLolItemMap, lolItemIcon } from './lolAssets';
import { teamHref } from '../../../../lib/gameLinks';
import { parseGameWinner, formatDuration, type MatchSectionProps } from '../shared';
import { parseDraft } from '../draft';
import type { PandaGame, PandaParticipant } from '../../../../types';

type Team = NonNullable<NonNullable<MatchSectionProps['match']['opponents']>[number]['opponent']>;

const ROLE_ORDER: Record<string, number> = { top: 0, jungle: 1, jgl: 1, mid: 2, bot: 3, adc: 3, support: 4, sup: 4 };
const ROLE_SHORT: Record<string, string> = { top: 'TOP', jungle: 'JGL', jgl: 'JGL', mid: 'MID', bot: 'BOT', adc: 'BOT', support: 'SUP', sup: 'SUP' };

const roleRank = (p: PandaParticipant): number => ROLE_ORDER[(p.role ?? '').toLowerCase()] ?? 9;

const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null;

const kfmt = (v: unknown): string => {
  const n = num(v);
  return n === null ? '-' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
};

const teamParts = (game: PandaGame, teamIndex: 1 | 2): PandaParticipant[] =>
  (game.participants ?? []).filter(p => p.team === teamIndex).slice().sort((a, b) => roleRank(a) - roleRank(b));

// Le champion "star" d'une équipe sur une game — celui dont le splash sert de
// fond au duel : meilleur impact KDA, départagé aux dégâts.
function keyChampion(game: PandaGame, teamIndex: 1 | 2): string | null {
  const parts = (game.participants ?? []).filter(p => p.team === teamIndex && p.character);
  if (!parts.length) {
    const ed = game.extradata;
    return ed ? ((ed[`team${teamIndex}champion1`] as string) ?? null) : null;
  }
  const score = (p: PandaParticipant) =>
    (p.kills ?? 0) * 2 + (p.assists ?? 0) - (p.deaths ?? 0) * 2 + (num(p.extra?.damagedone) ?? 0) / 10000;
  return parts.slice().sort((a, b) => score(b) - score(a))[0].character ?? null;
}

export function lolHeaderBackdrop(game?: PandaGame): string | null {
  return game ? lolChampSplash(keyChampion(game, 1)) : null;
}

const teamKills = (game: PandaGame, teamIndex: 1 | 2): number | null => {
  const parts = (game.participants ?? []).filter(p => p.team === teamIndex);
  if (!parts.length || parts.every(p => p.kills == null)) return null;
  return parts.reduce((s, p) => s + (p.kills ?? 0), 0);
};

const sideDot = (side: unknown) =>
  side === 'blue' ? 'bg-sky-400' : side === 'red' ? 'bg-red-500' : null;

const TeamSide = ({ team, url, isDark, winner, reverse, side }: {
  team?: Team | null;
  url: string | null;
  isDark: boolean;
  winner: boolean;
  reverse: boolean;
  side: unknown;
}) => {
  const dot = sideDot(side);
  const inner = (
    <>
      <SideLogo team={team} isDark={isDark} />
      <span className={`hidden sm:flex items-center gap-1.5 text-sm md:text-base font-bold truncate transition-colors group-hover/team:text-accent ${
        reverse ? 'flex-row-reverse text-right' : ''
      } ${winner ? 'text-white' : 'text-white/80'}`}>
        {team?.acronym || team?.name || '-'}
        {dot && <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dot}`} title={String(side)} />}
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

const ChampTile = ({ name, ban }: { name: string; ban?: boolean }) => {
  const icon = lolChampIcon(name);
  return (
    <div className={`group/champ flex flex-col items-center gap-1 ${ban ? 'opacity-60' : ''}`} title={name}>
      <div className={`relative overflow-hidden border bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 flex items-center justify-center transition-all duration-300 ${
        ban
          ? 'w-7 h-7 md:w-8 md:h-8 rounded-md border-[var(--color-border-primary)]/30'
          : 'w-9 h-9 md:w-11 md:h-11 rounded-lg border-[var(--color-border-primary)]/40 group-hover/champ:border-accent/50 group-hover/champ:scale-105'
      }`}>
        {icon ? (
          <img src={icon} alt={name} className={`w-full h-full object-cover ${ban ? 'grayscale' : ''}`} loading="lazy" />
        ) : (
          <span className="text-[9px] font-bold text-text-secondary px-0.5 text-center leading-tight">{name}</span>
        )}
        {ban && <span className="absolute inset-0 bg-[linear-gradient(45deg,transparent_46%,rgba(242,46,98,0.9)_48%,rgba(242,46,98,0.9)_52%,transparent_54%)]" />}
      </div>
      {!ban && <span className="text-[8px] font-semibold uppercase tracking-wide text-text-muted max-w-12 truncate">{name}</span>}
    </div>
  );
};

// Bande d'objectifs comparés : valeur team1 | label | valeur team2, la valeur
// dominante en gras, teintée par le side (bleu/rouge).
const OBJECTIVE_KEYS = ['towers', 'dragons', 'barons', 'heralds', 'grubs', 'atakhans', 'inhibitors'] as const;

const ObjectivesStrip = ({ game }: { game: PandaGame }) => {
  const t = useTranslations('pages_detail.match_detail.objectives');
  const ed = game.extradata;
  const o1 = ed?.team1objectives as Record<string, unknown> | undefined;
  const o2 = ed?.team2objectives as Record<string, unknown> | undefined;
  if (!o1 && !o2) return null;
  const side1 = ed?.team1side === 'red' ? 'text-red-400' : 'text-sky-400';
  const side2 = ed?.team2side === 'red' ? 'text-red-400' : 'text-sky-400';

  const rows = OBJECTIVE_KEYS
    .map(k => ({ key: k, v1: num(o1?.[k]), v2: num(o2?.[k]) }))
    .filter(r => r.v1 !== null || r.v2 !== null);
  if (!rows.length) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {rows.map(({ key, v1, v2 }) => (
        <div key={key} className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--color-bg-primary)]/50 border border-[var(--color-border-primary)]/25 text-[11px] tabular-nums">
          <span className={`${side1} ${(v1 ?? 0) > (v2 ?? 0) ? 'font-bold' : 'opacity-70'}`}>{v1 ?? '-'}</span>
          <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted">{t(key)}</span>
          <span className={`${side2} ${(v2 ?? 0) > (v1 ?? 0) ? 'font-bold' : 'opacity-70'}`}>{v2 ?? '-'}</span>
        </div>
      ))}
    </div>
  );
};

// Scoreboard op.gg : portrait champion + sorts, rôle, KDA, CS, or, dégâts,
// KP%, build d'items (icônes via item.json Data Dragon).
const TeamScoreboard = ({ game, team, teamIndex, isDark, itemMap }: {
  game: PandaGame;
  team?: Team | null;
  teamIndex: 1 | 2;
  isDark: boolean;
  itemMap: Record<string, string> | null;
}) => {
  const t = useTranslations('pages_detail.match_detail');
  const rows = teamParts(game, teamIndex);
  if (rows.length === 0) return null;
  const logo = pickThemeLogo(isDark, team?.image_url, team?.dark_image_url);

  return (
    <div className="rounded-lg border border-[var(--color-border-primary)]/25 bg-[var(--color-bg-primary)]/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)]/60 border-b border-[var(--color-border-primary)]/25">
        {logo && <img src={proxyImageUrl(logo)} alt="" className="w-4 h-4 object-contain" loading="lazy" />}
        <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">{team?.acronym || team?.name || '-'}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-text-muted uppercase tracking-wider text-[10px] border-b border-[var(--color-border-primary)]/20">
              <th className="text-left py-2 pl-3 pr-2 font-semibold">{t('stat_col.player')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.kda')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.kp')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.cs')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.gold')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.damage')}</th>
              <th className="hidden lg:table-cell text-left py-2 px-2 pr-3 font-semibold">{t('stat_col.items')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const icon = lolChampIcon(p.character);
              const spells = p.extra?.spells as Record<string, string> | undefined;
              const items = p.extra?.items as Record<string, string> | undefined;
              const kp = num(p.extra?.killparticipation);
              const role = ROLE_SHORT[(p.role ?? '').toLowerCase()];
              return (
                <tr key={i} className={`${i % 2 === 1 ? 'bg-[var(--color-bg-secondary)]/30' : ''} border-t border-[var(--color-border-primary)]/10`}>
                  <td className="py-2 pl-3 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-md overflow-hidden border border-[var(--color-border-primary)]/30 bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 flex-shrink-0" title={p.character || ''}>
                        {icon && <img src={icon} alt={p.character || ''} className="w-full h-full object-cover" loading="lazy" />}
                      </div>
                      {spells && (
                        <div className="hidden sm:flex flex-col gap-0.5 flex-shrink-0">
                          {[spells['1'], spells['2']].map((s, j) => {
                            const si = s ? lolSpellIcon(s) : null;
                            return si ? <img key={j} src={si} alt={s} title={s} className="w-3 h-3 rounded-[3px]" loading="lazy" /> : null;
                          })}
                        </div>
                      )}
                      <span className="font-bold text-text-primary truncate">{p.player || '-'}</span>
                      {role && <span className="hidden md:inline text-[9px] font-semibold text-text-muted flex-shrink-0">{role}</span>}
                    </div>
                  </td>
                  <td className="text-center py-2 px-2 tabular-nums whitespace-nowrap">
                    <span className="font-semibold text-text-primary">{p.kills ?? '-'}</span>
                    <span className="text-text-muted"> / </span>
                    <span className="text-[var(--color-accent)] font-semibold">{p.deaths ?? '-'}</span>
                    <span className="text-text-muted"> / </span>
                    <span className="text-text-secondary">{p.assists ?? '-'}</span>
                  </td>
                  <td className="text-center py-2 px-2 tabular-nums text-text-secondary">{kp === null ? '-' : `${Math.round(kp * 100)}%`}</td>
                  <td className="text-center py-2 px-2 tabular-nums text-text-secondary">{num(p.extra?.creepscore) ?? '-'}</td>
                  <td className="text-center py-2 px-2 tabular-nums text-text-secondary">{kfmt(p.extra?.gold)}</td>
                  <td className="text-center py-2 px-2 tabular-nums text-text-secondary">{kfmt(p.extra?.damagedone)}</td>
                  <td className="hidden lg:table-cell py-2 px-2 pr-3">
                    <div className="flex items-center gap-0.5">
                      {items && Object.keys(items).sort().map(k => {
                        const it = items[k];
                        const ii = it ? lolItemIcon(it, itemMap) : null;
                        return ii ? (
                          <img key={k} src={ii} alt={it} title={it} className="w-[22px] h-[22px] rounded border border-[var(--color-border-primary)]/30" loading="lazy" />
                        ) : null;
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Blocs par game : hero "duel de champions" (splash du champion clé de chaque
// équipe, fondu au centre) + draft, objectifs et scoreboards de CETTE game.
export default function LolGameCards({ match, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const itemMap = useLolItemMap();
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
        const homeKills = teamKills(game, 1);
        const awayKills = teamKills(game, 2);
        const hasKills = homeKills !== null && awayKills !== null;
        const leftSplash = lolChampSplash(keyChampion(game, 1));
        const rightSplash = lolChampSplash(keyChampion(game, 2));
        const draft = parseDraft(game);
        const hasStats = (game.participants ?? []).some(p => p.team === 1 || p.team === 2);
        const hasDetails = !!draft || hasStats;
        const ed = game.extradata;

        return (
          <div
            key={game.id}
            className={`rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 ${
              isGameLive ? 'ring-1 ring-[var(--color-status-live)]/40' : ''
            }`}
          >
            {/* Duel hero — un splash par équipe, fondus au centre */}
            <div className={`group relative ${isUpcoming ? 'h-[72px] md:h-[84px]' : 'h-[104px] md:h-[132px]'}`}>
              {leftSplash || rightSplash ? (
                <>
                  <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                    {leftSplash && (
                      <img
                        src={leftSplash}
                        alt=""
                        loading="lazy"
                        className={`w-full h-full object-cover object-[center_20%] transition-transform duration-700 ease-out group-hover:scale-105 ${
                          isUpcoming ? 'grayscale opacity-50' : isGameFinished && !isHomeWin ? 'grayscale-[60%] brightness-75' : ''
                        }`}
                      />
                    )}
                  </div>
                  <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
                    {rightSplash && (
                      <img
                        src={rightSplash}
                        alt=""
                        loading="lazy"
                        className={`w-full h-full object-cover object-[center_20%] transition-transform duration-700 ease-out group-hover:scale-105 ${
                          isUpcoming ? 'grayscale opacity-50' : isGameFinished && !isAwayWin ? 'grayscale-[60%] brightness-75' : ''
                        }`}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#091626] to-[#182859]/40" />
              )}

              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,11,19,0.96)_0%,rgba(6,11,19,0.5)_16%,rgba(6,11,19,0.2)_32%,rgba(6,11,19,0.88)_50%,rgba(6,11,19,0.2)_68%,rgba(6,11,19,0.5)_84%,rgba(6,11,19,0.96)_100%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,11,19,0.35)_0%,transparent_30%,transparent_70%,rgba(6,11,19,0.45)_100%)]" />

              {isHomeWin && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {isAwayWin && <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-accent" />}
              {isGameLive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--color-status-live)] animate-pulse" />}

              <div className="relative h-full flex items-center px-4 md:px-6 gap-3">
                <div className="flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0">
                  <div className={isGameFinished && !isHomeWin ? 'opacity-50 min-w-0' : 'min-w-0'}>
                    <TeamSide team={homeTeam} url={homeUrl} isDark={isDark} winner={isHomeWin} reverse={false} side={ed?.team1side} />
                  </div>
                  {hasKills && (
                    <span className={`ml-auto text-3xl md:text-5xl font-black tabular-nums ${
                      isHomeWin ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]' : 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]'
                    }`}>
                      {homeKills}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[6rem] md:min-w-[9rem] text-center">
                  {isGameLive ? (
                    <span className="text-[10px] font-bold text-[var(--color-status-live)] uppercase tracking-[0.2em] animate-pulse mb-1">
                      {t('status_running')}
                    </span>
                  ) : (
                    <span className="text-[9px] md:text-[10px] font-bold text-white/90 uppercase tracking-[0.2em] mb-1">
                      {t('game_label')} {game.position}
                    </span>
                  )}
                  {hasKills && (
                    <div className="flex items-center gap-2 md:gap-3">
                      <span className="hidden md:block w-5 h-px bg-white/30" />
                      <span className="text-[9px] font-black text-white/70 uppercase tracking-[0.25em] drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                        {t('stat_kills')}
                      </span>
                      <span className="hidden md:block w-5 h-px bg-white/30" />
                    </div>
                  )}
                  {game.length != null && game.length > 0 && (
                    <span className="text-[10px] text-white/60 mt-0.5 tabular-nums">{formatDuration(game.length)}</span>
                  )}
                  {isUpcoming && (
                    <span className="text-[10px] text-white/50 mt-0.5">{t('game_status_upcoming')}</span>
                  )}
                </div>

                <div className="flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0 justify-end">
                  {hasKills && (
                    <span className={`mr-auto text-3xl md:text-5xl font-black tabular-nums ${
                      isAwayWin ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]' : 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]'
                    }`}>
                      {awayKills}
                    </span>
                  )}
                  <div className={isGameFinished && !isAwayWin ? 'opacity-50 min-w-0' : 'min-w-0'}>
                    <TeamSide team={awayTeam} url={awayUrl} isDark={isDark} winner={isAwayWin} reverse={true} side={ed?.team2side} />
                  </div>
                </div>
              </div>
            </div>

            {/* Draft + objectifs + stats de cette game */}
            {hasDetails && (
              <div className="bg-[var(--color-bg-secondary)]/40 border-t border-[var(--color-border-primary)]/20 p-4 md:p-5 space-y-5">
                {draft && (draft.team1.picks.length > 0 || draft.team2.picks.length > 0) && (
                  <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 md:gap-2.5">
                        {draft.team1.picks.map((p, i) => <ChampTile key={`${p}-${i}`} name={p} />)}
                      </div>
                      {draft.team1.bans.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[8px] font-semibold uppercase tracking-widest text-text-muted mr-1">{t('draft_bans')}</span>
                          {draft.team1.bans.map((b, i) => <ChampTile key={`${b}-${i}`} name={b} ban />)}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 md:gap-2.5 justify-end">
                        {draft.team2.picks.map((p, i) => <ChampTile key={`${p}-${i}`} name={p} />)}
                      </div>
                      {draft.team2.bans.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 justify-end">
                          {draft.team2.bans.map((b, i) => <ChampTile key={`${b}-${i}`} name={b} ban />)}
                          <span className="text-[8px] font-semibold uppercase tracking-widest text-text-muted ml-1">{t('draft_bans')}</span>
                        </div>
                      )}
                    </div>
                    <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black text-text-muted/30 tracking-widest">VS</span>
                    </div>
                  </div>
                )}
                <ObjectivesStrip game={game} />
                {hasStats && (
                  <div className="grid gap-4 xl:grid-cols-2">
                    <TeamScoreboard game={game} team={homeTeam} teamIndex={1} isDark={isDark} itemMap={itemMap} />
                    <TeamScoreboard game={game} team={awayTeam} teamIndex={2} isDark={isDark} itemMap={itemMap} />
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
