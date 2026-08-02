'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { proxyImageUrl } from '../../../../lib/imageProxy';
import { pickThemeLogo } from '../../../../hooks/useIsDarkTheme';
import { r6MapImage, r6OperatorIcon, R6_SIDE_CLASS } from './r6Assets';
import { teamHref } from '../../../../lib/gameLinks';
import { parseGameWinner, type MatchSectionProps } from '../shared';
import type { PandaGame } from '../../../../types';

type Team = NonNullable<NonNullable<MatchSectionProps['match']['opponents']>[number]['opponent']>;

const TeamSide = ({ team, url, isDark, winner, reverse }: {
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
          <img src={proxyImageUrl(logo)} alt="" className="w-3/4 h-3/4 object-contain" loading="lazy" />
        ) : (
          <Shield className="w-4 h-4 text-white/30" />
        )}
      </div>
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

// Tables Lua en objet {"1": "Azami"} (parfois array) — valeurs remises en ordre.
function orderedValues(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const out: string[] = [];
    for (let i = 1; obj[String(i)] !== undefined; i++) out.push(String(obj[String(i)]));
    return out;
  }
  return [];
}

const num = (v: unknown): number | null => {
  const s = String(v ?? '').trim();
  return s !== '' && !isNaN(+s) ? +s : null;
};

// Split ATK/DEF des rounds gagnés par une équipe (t{n}halfs = {atk, def} agrégé,
// pas de mi-temps séquentielles ni d'OT dans l'API v3). t{n}firstside.rt donne
// le côté joué en premier en temps réglementaire.
type SideSplit = { atk: number | null; def: number | null; first: string | null };

function sideSplit(game: PandaGame, teamIndex: 1 | 2): SideSplit | null {
  const ed = game.extradata;
  if (!ed) return null;
  const halfs = ed[`t${teamIndex}halfs`] as Record<string, unknown> | undefined;
  if (!halfs || typeof halfs !== 'object') return null;
  const atk = num(halfs.atk);
  const def = num(halfs.def);
  if (atk === null && def === null) return null;
  const firstRaw = ed[`t${teamIndex}firstside`] as Record<string, unknown> | undefined;
  const first = firstRaw && typeof firstRaw === 'object' ? String(firstRaw.rt ?? '').toLowerCase() || null : null;
  return { atk, def, first };
}

type Ban = { operator: string; side: string };

function bans(game: PandaGame, teamIndex: 1 | 2): Ban[] {
  const ed = game.extradata;
  if (!ed) return [];
  const ops = orderedValues(ed[`t${teamIndex}bans`]);
  const types = orderedValues(ed[`t${teamIndex}bantypes`]).map(s => s.toLowerCase());
  return ops
    .map((operator, i) => ({ operator: operator.trim(), side: types[i] || '' }))
    .filter(b => b.operator !== '');
}

// Chip d'un ban : icône opérateur (barrée/grisée) + nom + mini-badge atk/def.
const BanTile = ({ ban, reverse }: { ban: Ban; reverse: boolean }) => {
  const icon = r6OperatorIcon(ban.operator);
  const sideCls = R6_SIDE_CLASS[ban.side] || 'text-text-muted';
  return (
    <div className={`group/op flex flex-col items-center gap-1 opacity-60`} title={`${ban.operator}${ban.side ? ` — ${ban.side}` : ''}`}>
      <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-lg overflow-hidden border border-[var(--color-border-primary)]/40 bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 flex items-center justify-center">
        {icon ? (
          <img src={icon} alt={ban.operator} className="w-3/4 h-3/4 object-contain grayscale" loading="lazy" />
        ) : (
          <span className="text-[8px] font-bold text-text-secondary px-0.5 text-center leading-tight">{ban.operator}</span>
        )}
        <span className="absolute inset-0 bg-[linear-gradient(45deg,transparent_46%,rgba(242,46,98,0.9)_48%,rgba(242,46,98,0.9)_52%,transparent_54%)]" />
        {ban.side && (
          <span className={`absolute bottom-0 ${reverse ? 'left-0 rounded-tr' : 'right-0 rounded-tl'} px-0.5 text-[7px] font-black uppercase bg-[#060B13]/85 leading-tight ${sideCls}`}>
            {ban.side}
          </span>
        )}
      </div>
      <span className="text-[8px] font-semibold uppercase tracking-wide text-text-muted max-w-12 truncate">{ban.operator}</span>
    </div>
  );
};

// Split ATK/DEF d'une équipe, dans l'ordre du côté joué en premier.
const SideSplitChip = ({ split, reverse, label }: { split: SideSplit; reverse: boolean; label: string }) => {
  const atk = <span className={`font-black tabular-nums ${R6_SIDE_CLASS.atk}`}>{split.atk ?? '-'}</span>;
  const def = <span className={`font-black tabular-nums ${R6_SIDE_CLASS.def}`}>{split.def ?? '-'}</span>;
  const atkLabel = <span className={`text-[8px] font-bold uppercase tracking-wider ${R6_SIDE_CLASS.atk}`}>ATK</span>;
  const defLabel = <span className={`text-[8px] font-bold uppercase tracking-wider ${R6_SIDE_CLASS.def}`}>DEF</span>;
  const atkGroup = <span className="flex items-center gap-1">{atkLabel}{atk}</span>;
  const defGroup = <span className="flex items-center gap-1">{defLabel}{def}</span>;
  const first = split.first === 'def' ? [defGroup, atkGroup] : [atkGroup, defGroup];
  const groups = reverse ? [...first].reverse() : first;
  return (
    <div className={`flex items-center gap-2.5 rounded-full bg-[var(--color-bg-primary)]/60 border border-[var(--color-border-primary)]/25 px-3 py-1.5 text-xs ${reverse ? 'flex-row-reverse' : ''}`}>
      <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary max-w-20 truncate">{label}</span>
      {groups[0]}
      <span className="text-[10px] text-text-muted/40">·</span>
      {groups[1]}
    </div>
  );
};

// Blocs par map : hero (screenshot de la map + score en rounds) + détail attaché
// (bans d'opérateurs + split ATK/DEF de CETTE map). Pas de stat joueur sur l'API
// v3 R6 (halfs agrégés atk/def uniquement, pas de scoreboard).
export default function R6GameCards({ match, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
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
        const splash = r6MapImage(game.map);
        const homeBans = bans(game, 1);
        const awayBans = bans(game, 2);
        const hasBans = homeBans.length > 0 || awayBans.length > 0;
        const homeSplit = sideSplit(game, 1);
        const awaySplit = sideSplit(game, 2);
        const hasSplit = !!homeSplit || !!awaySplit;
        const hasDetails = hasBans || hasSplit;

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
                <div className="flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0">
                  <div className={isGameFinished && !isHomeWin ? 'opacity-50 min-w-0' : 'min-w-0'}>
                    <TeamSide team={homeTeam} url={homeUrl} isDark={isDark} winner={isHomeWin} reverse={false} />
                  </div>
                  {hasScores && (
                    <span className={`ml-auto text-3xl md:text-5xl font-black tabular-nums ${
                      isHomeWin ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]' : 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]'
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
                    <span className="text-[9px] md:text-[10px] font-bold text-white/90 uppercase tracking-[0.2em] mb-1">
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

                <div className="flex items-center gap-2.5 md:gap-3.5 flex-1 min-w-0 justify-end">
                  {hasScores && (
                    <span className={`mr-auto text-3xl md:text-5xl font-black tabular-nums ${
                      isAwayWin ? 'text-accent drop-shadow-[0_0_12px_rgba(242,46,98,0.45)]' : 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]'
                    }`}>
                      {awayMapScore}
                    </span>
                  )}
                  <div className={isGameFinished && !isAwayWin ? 'opacity-50 min-w-0' : 'min-w-0'}>
                    <TeamSide team={awayTeam} url={awayUrl} isDark={isDark} winner={isAwayWin} reverse={true} />
                  </div>
                </div>
              </div>
            </div>

            {/* Détail : bans d'opérateurs + split ATK/DEF */}
            {hasDetails && (
              <div className="bg-[var(--color-bg-secondary)]/40 border-t border-[var(--color-border-primary)]/20 p-4 md:p-5 space-y-5">
                {hasBans && (
                  <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-wrap gap-2 md:gap-2.5">
                      {homeBans.length > 0 && (
                        <span className="w-full text-[8px] font-semibold uppercase tracking-widest text-text-muted">{t('draft_bans')}</span>
                      )}
                      {homeBans.map((b, i) => <BanTile key={`${b.operator}-${i}`} ban={b} reverse={false} />)}
                    </div>
                    <div className="flex flex-wrap gap-2 md:gap-2.5 justify-end">
                      {awayBans.length > 0 && (
                        <span className="w-full text-right text-[8px] font-semibold uppercase tracking-widest text-text-muted">{t('draft_bans')}</span>
                      )}
                      {awayBans.map((b, i) => <BanTile key={`${b.operator}-${i}`} ban={b} reverse={true} />)}
                    </div>
                    <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black text-text-muted/30 tracking-widest">VS</span>
                    </div>
                  </div>
                )}

                {hasSplit && (
                  <div className="flex flex-wrap items-center justify-between gap-2 md:gap-2.5">
                    {homeSplit && <SideSplitChip split={homeSplit} reverse={false} label={homeTeam?.acronym || homeTeam?.name || '-'} />}
                    {awaySplit && <SideSplitChip split={awaySplit} reverse={true} label={awayTeam?.acronym || awayTeam?.name || '-'} />}
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
