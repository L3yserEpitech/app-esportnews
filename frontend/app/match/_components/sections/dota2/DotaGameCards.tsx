'use client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Shield, ExternalLink } from 'lucide-react';
import { proxyImageUrl } from '../../../../lib/imageProxy';
import { pickThemeLogo } from '../../../../hooks/useIsDarkTheme';
import { useDotaAssets, dotaHeroImage, dotaItemIcon, dotaSideDot, DOTA_SIDE_CLASS, type DotaAssetMaps } from './dotaAssets';
import { teamHref } from '../../../../lib/gameLinks';
import { parseGameWinner, formatDuration, type MatchSectionProps } from '../shared';
import { parseDraft } from '../draft';
import type { PandaGame, PandaParticipant } from '../../../../types';

type Team = NonNullable<NonNullable<MatchSectionProps['match']['opponents']>[number]['opponent']>;

const num = (v: unknown): number | null =>
  typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(+v) ? +v : null;

const kfmt = (v: unknown): string => {
  const n = num(v);
  return n === null ? '-' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
};

// Pas de rôles dans les participants Dota → tri Dotabuff par net worth.
const teamParts = (game: PandaGame, teamIndex: 1 | 2): PandaParticipant[] =>
  (game.participants ?? [])
    .filter(p => p.team === teamIndex)
    .slice()
    .sort((a, b) => (num(b.extra?.gold) ?? -1) - (num(a.extra?.gold) ?? -1));

// Le héros "star" d'une équipe sur une game — meilleur impact KDA, départagé
// aux dégâts. Son art sert de fond au duel.
function keyHero(game: PandaGame, teamIndex: 1 | 2): string | null {
  const parts = (game.participants ?? []).filter(p => p.team === teamIndex && p.character);
  if (!parts.length) {
    const ed = game.extradata;
    return ed ? ((ed[`team${teamIndex}hero1`] as string) ?? null) : null;
  }
  const score = (p: PandaParticipant) =>
    (p.kills ?? 0) * 2 + (p.assists ?? 0) - (p.deaths ?? 0) * 2 + (num(p.extra?.damagedone) ?? 0) / 10000;
  return parts.slice().sort((a, b) => score(b) - score(a))[0].character ?? null;
}

export function dotaHeaderBackdropHero(game?: PandaGame): string | null {
  return game ? keyHero(game, 1) : null;
}

// L'ordre réel de la draft (vetophase) : 24 étapes numérotées bans + picks
// intercalés. Présent uniquement sur les matchs à import BigMatch.
type VetoStep = { character: string; team: number; type: string; vetoNumber: number };
type DraftTile = { name: string; order?: number };

function parseVeto(game: PandaGame): VetoStep[] | null {
  const vp = game.extradata?.vetophase;
  if (!vp || typeof vp !== 'object') return null;
  const steps = Object.values(vp as Record<string, VetoStep>)
    .filter(s => s?.character && (s.type === 'ban' || s.type === 'pick') && typeof s.vetoNumber === 'number')
    .sort((a, b) => a.vetoNumber - b.vetoNumber);
  return steps.length ? steps : null;
}

const vetoTiles = (veto: VetoStep[], teamIndex: 1 | 2, type: 'pick' | 'ban'): DraftTile[] =>
  veto.filter(s => s.team === teamIndex && s.type === type).map(s => ({ name: s.character, order: s.vetoNumber }));

const teamKills = (game: PandaGame, teamIndex: 1 | 2): number | null => {
  const parts = (game.participants ?? []).filter(p => p.team === teamIndex);
  if (!parts.length || parts.every(p => p.kills == null)) return null;
  return parts.reduce((s, p) => s + (p.kills ?? 0), 0);
};

const TeamSide = ({ team, url, isDark, winner, reverse, side }: {
  team?: Team | null;
  url: string | null;
  isDark: boolean;
  winner: boolean;
  reverse: boolean;
  side: unknown;
}) => {
  const dot = dotaSideDot(side);
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

// L'art de héros Dota est en paysage (256×144) → tuiles 16/9 plutôt que carrées.
const HeroTile = ({ name, maps, ban, order }: { name: string; maps: DotaAssetMaps | null; ban?: boolean; order?: number }) => {
  const img = dotaHeroImage(name, maps);
  return (
    <div className={`group/hero flex flex-col items-center gap-1 ${ban ? 'opacity-60' : ''}`} title={order ? `${name} — #${order}` : name}>
      <div className={`relative overflow-hidden border bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 flex items-center justify-center transition-all duration-300 ${
        ban
          ? 'w-11 h-[25px] md:w-12 md:h-[27px] rounded-md border-[var(--color-border-primary)]/30'
          : 'w-16 h-9 md:w-[76px] md:h-[43px] rounded-lg border-[var(--color-border-primary)]/40 group-hover/hero:border-accent/50 group-hover/hero:scale-105'
      }`}>
        {img ? (
          <img src={img} alt={name} className={`w-full h-full object-cover ${ban ? 'grayscale' : ''}`} loading="lazy" />
        ) : (
          <span className="text-[8px] font-bold text-text-secondary px-0.5 text-center leading-tight">{name}</span>
        )}
        {ban && <span className="absolute inset-0 bg-[linear-gradient(45deg,transparent_46%,rgba(242,46,98,0.9)_48%,rgba(242,46,98,0.9)_52%,transparent_54%)]" />}
        {order != null && !ban && (
          <span className="absolute top-0 left-0 px-1 text-[8px] font-black text-white/75 bg-[#060B13]/80 rounded-br leading-tight tabular-nums">
            {order}
          </span>
        )}
      </div>
      {!ban && <span className="text-[8px] font-semibold uppercase tracking-wide text-text-muted max-w-16 truncate">{name}</span>}
    </div>
  );
};

// Objectifs comparés (tours, barracks, roshans), valeur dominante en gras
// teintée par le side radiant/dire.
const OBJECTIVE_KEYS = ['towers', 'barracks', 'roshans'] as const;

const ObjectivesStrip = ({ game }: { game: PandaGame }) => {
  const t = useTranslations('pages_detail.match_detail.objectives');
  const ed = game.extradata;
  const o1 = ed?.team1objectives as Record<string, unknown> | undefined;
  const o2 = ed?.team2objectives as Record<string, unknown> | undefined;
  if (!o1 && !o2) return null;
  const side1 = DOTA_SIDE_CLASS[String(ed?.team1side)] || 'text-text-primary';
  const side2 = DOTA_SIDE_CLASS[String(ed?.team2side)] || 'text-text-primary';

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

// Scoreboard façon Dotabuff : portrait héros + niveau, KDA, net worth, GPM,
// XPM, LH/DN, dégâts, build d'items (6 slots + item neutre rond).
const TeamScoreboard = ({ game, team, teamIndex, isDark, maps }: {
  game: PandaGame;
  team?: Team | null;
  teamIndex: 1 | 2;
  isDark: boolean;
  maps: DotaAssetMaps | null;
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
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.net_worth')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.gpm')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.xpm')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.lhdn')}</th>
              <th className="text-center py-2 px-2 font-semibold">{t('stat_col.damage')}</th>
              <th className="hidden lg:table-cell text-left py-2 px-2 pr-3 font-semibold">{t('stat_col.items')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const heroImg = dotaHeroImage(p.character, maps);
              const level = num(p.extra?.level);
              const items = p.extra?.items as Record<string, { name?: string }> | undefined;
              const neutral = p.extra?.neutralitem as { name?: string } | undefined;
              const backpack = p.extra?.backpackitems as Record<string, { name?: string }> | undefined;
              const backpackNames = backpack ? Object.keys(backpack).sort().map(k => backpack[k]?.name).filter(Boolean) as string[] : [];
              const hasScepter = p.extra?.scepter === true;
              const hasShard = p.extra?.shard === true;
              const facet = typeof p.extra?.facet === 'string' && p.extra.facet ? p.extra.facet : null;
              const lh = num(p.extra?.lasthits);
              const dn = num(p.extra?.denies);
              return (
                <tr key={i} className={`${i % 2 === 1 ? 'bg-[var(--color-bg-secondary)]/30' : ''} border-t border-[var(--color-border-primary)]/10`}>
                  <td className="py-2 pl-3 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative w-10 h-6 rounded-md overflow-hidden border border-[var(--color-border-primary)]/30 bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 flex-shrink-0" title={facet ? `${p.character} — ${facet}` : p.character || ''}>
                        {heroImg && <img src={heroImg} alt={p.character || ''} className="w-full h-full object-cover" loading="lazy" />}
                        {level !== null && (
                          <span className="absolute bottom-0 right-0 px-0.5 text-[8px] font-black text-white bg-[#060B13]/85 rounded-tl leading-tight tabular-nums">
                            {level}
                          </span>
                        )}
                      </div>
                      <span className={`truncate ${p.player ? 'font-bold text-text-primary' : 'font-semibold text-text-secondary'}`}>{p.player || p.character || '-'}</span>
                    </div>
                  </td>
                  <td className="text-center py-2 px-2 tabular-nums whitespace-nowrap">
                    <span className="font-semibold text-text-primary">{p.kills ?? '-'}</span>
                    <span className="text-text-muted"> / </span>
                    <span className="text-[var(--color-accent)] font-semibold">{p.deaths ?? '-'}</span>
                    <span className="text-text-muted"> / </span>
                    <span className="text-text-secondary">{p.assists ?? '-'}</span>
                  </td>
                  <td className="text-center py-2 px-2 tabular-nums font-semibold text-amber-300/90">{kfmt(p.extra?.gold)}</td>
                  <td className="text-center py-2 px-2 tabular-nums text-text-secondary">{num(p.extra?.gpm) ?? '-'}</td>
                  <td className="text-center py-2 px-2 tabular-nums text-text-secondary">{num(p.extra?.xpm) ?? '-'}</td>
                  <td className="text-center py-2 px-2 tabular-nums text-text-secondary whitespace-nowrap">{lh ?? '-'}<span className="text-text-muted/60"> / </span>{dn ?? '-'}</td>
                  <td className="text-center py-2 px-2 tabular-nums text-text-secondary">{kfmt(p.extra?.damagedone)}</td>
                  <td className="hidden lg:table-cell py-2 px-2 pr-3">
                    <div className="flex items-center gap-0.5">
                      {items && Object.keys(items).sort().map(k => {
                        const name = items[k]?.name;
                        const ii = name ? dotaItemIcon(name, maps) : null;
                        return ii ? (
                          <img key={k} src={ii} alt={name} title={name} className="w-[30px] h-[22px] rounded border border-[var(--color-border-primary)]/30 object-cover" loading="lazy" />
                        ) : null;
                      })}
                      {neutral?.name && (() => {
                        const ni = dotaItemIcon(neutral.name, maps);
                        return ni ? (
                          <img src={ni} alt={neutral.name} title={neutral.name} className="w-[22px] h-[22px] rounded-full border border-amber-400/40 object-cover ml-1" loading="lazy" />
                        ) : null;
                      })()}
                      {(hasScepter || hasShard) && (
                        <span className="flex items-center gap-0.5 ml-1 pl-1 border-l border-[var(--color-border-primary)]/30">
                          {hasScepter && (() => {
                            const si = dotaItemIcon("Aghanim's Scepter", maps);
                            return si ? <img src={si} alt="Aghanim's Scepter" title="Aghanim's Scepter" className="w-[24px] h-[18px] rounded border border-sky-400/40 object-cover" loading="lazy" /> : null;
                          })()}
                          {hasShard && (() => {
                            const si = dotaItemIcon("Aghanim's Shard", maps);
                            return si ? <img src={si} alt="Aghanim's Shard" title="Aghanim's Shard" className="w-[24px] h-[18px] rounded border border-sky-400/40 object-cover" loading="lazy" /> : null;
                          })()}
                        </span>
                      )}
                      {backpackNames.length > 0 && (
                        <span className="flex items-center gap-0.5 ml-1 pl-1 border-l border-[var(--color-border-primary)]/30 opacity-45">
                          {backpackNames.map((name, k) => {
                            const bi = dotaItemIcon(name, maps);
                            return bi ? <img key={k} src={bi} alt={name} title={name} className="w-[24px] h-[18px] rounded border border-[var(--color-border-primary)]/30 object-cover" loading="lazy" /> : null;
                          })}
                        </span>
                      )}
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

// Blocs par game : hero "duel de héros" (art du héros clé de chaque équipe,
// fondu au centre) + draft, objectifs et scoreboards de CETTE game.
export default function DotaGameCards({ match, isDark }: MatchSectionProps) {
  const t = useTranslations('pages_detail.match_detail');
  const maps = useDotaAssets();
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
        const leftArt = dotaHeroImage(keyHero(game, 1), maps);
        const rightArt = dotaHeroImage(keyHero(game, 2), maps);
        const draft = parseDraft(game);
        const veto = parseVeto(game);
        // vetophase donne l'ordre réel de la draft ; sinon fallback picks/bans plats.
        const tiles: Record<1 | 2, { picks: DraftTile[]; bans: DraftTile[] }> = veto
          ? {
              1: { picks: vetoTiles(veto, 1, 'pick'), bans: vetoTiles(veto, 1, 'ban') },
              2: { picks: vetoTiles(veto, 2, 'pick'), bans: vetoTiles(veto, 2, 'ban') },
            }
          : {
              1: { picks: (draft?.team1.picks ?? []).map(name => ({ name })), bans: (draft?.team1.bans ?? []).map(name => ({ name })) },
              2: { picks: (draft?.team2.picks ?? []).map(name => ({ name })), bans: (draft?.team2.bans ?? []).map(name => ({ name })) },
            };
        const hasDraft = tiles[1].picks.length > 0 || tiles[2].picks.length > 0;
        const hasStats = (game.participants ?? []).some(p => p.team === 1 || p.team === 2);
        const ed = game.extradata;
        const pubId = ed?.publisherid != null && String(ed.publisherid).trim() !== '' ? String(ed.publisherid) : null;
        const hasDetails = hasDraft || hasStats || !!pubId;

        return (
          <div
            key={game.id}
            className={`rounded-xl overflow-hidden border border-[var(--color-border-primary)]/30 ${
              isGameLive ? 'ring-1 ring-[var(--color-status-live)]/40' : ''
            }`}
          >
            {/* Duel hero — l'art du héros clé de chaque équipe, fondus au centre */}
            <div className={`group relative ${isUpcoming ? 'h-[72px] md:h-[84px]' : 'h-[104px] md:h-[132px]'}`}>
              {leftArt || rightArt ? (
                <>
                  <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
                    {leftArt && (
                      <img
                        src={leftArt}
                        alt=""
                        loading="lazy"
                        className={`w-full h-full object-cover object-[center_25%] transition-transform duration-700 ease-out group-hover:scale-105 ${
                          isUpcoming ? 'grayscale opacity-50' : isGameFinished && !isHomeWin ? 'grayscale-[60%] brightness-75' : ''
                        }`}
                      />
                    )}
                  </div>
                  <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
                    {rightArt && (
                      <img
                        src={rightArt}
                        alt=""
                        loading="lazy"
                        className={`w-full h-full object-cover object-[center_25%] transition-transform duration-700 ease-out group-hover:scale-105 ${
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
                {hasDraft && (
                  <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 md:gap-2.5">
                        {tiles[1].picks.map((p, i) => <HeroTile key={`${p.name}-${i}`} name={p.name} order={p.order} maps={maps} />)}
                      </div>
                      {tiles[1].bans.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[8px] font-semibold uppercase tracking-widest text-text-muted mr-1">{t('draft_bans')}</span>
                          {tiles[1].bans.map((b, i) => <HeroTile key={`${b.name}-${i}`} name={b.name} maps={maps} ban />)}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 md:gap-2.5 justify-end">
                        {tiles[2].picks.map((p, i) => <HeroTile key={`${p.name}-${i}`} name={p.name} order={p.order} maps={maps} />)}
                      </div>
                      {tiles[2].bans.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 justify-end">
                          {tiles[2].bans.map((b, i) => <HeroTile key={`${b.name}-${i}`} name={b.name} maps={maps} ban />)}
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
                    <TeamScoreboard game={game} team={homeTeam} teamIndex={1} isDark={isDark} maps={maps} />
                    <TeamScoreboard game={game} team={awayTeam} teamIndex={2} isDark={isDark} maps={maps} />
                  </div>
                )}
                {pubId && (
                  <div className="flex justify-end gap-4 pt-1">
                    <a href={`https://www.dotabuff.com/matches/${pubId}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-accent transition-colors">
                      Dotabuff <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <a href={`https://www.opendota.com/matches/${pubId}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-accent transition-colors">
                      OpenDota <ExternalLink className="w-2.5 h-2.5" />
                    </a>
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
