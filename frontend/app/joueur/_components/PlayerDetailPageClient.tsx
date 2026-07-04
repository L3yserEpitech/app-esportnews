'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Shield, Trophy, Calendar, MapPin, ExternalLink, Loader2, Gamepad2,
  ArrowRight, Banknote, Users,
} from 'lucide-react';
import 'flag-icons/css/flag-icons.min.css';
import { countryCode } from '../../lib/countryCodes';
import { playerService, PlayerDetail } from '../../services/playerService';
import { teamService, Team, TeamMatchesResponse } from '../../services/teamService';
import { advertisementService } from '../../services/advertisementService';
import { Advertisement, PandaMatch } from '../../types';
import { proxyImageUrl, prewarmFromData } from '../../lib/imageProxy';
import { useIsDarkTheme, pickThemeLogo } from '../../hooks/useIsDarkTheme';
import { teamHref } from '../../lib/gameLinks';
import { getRoleBadgeStyle, SectionHeader } from '../../match/_components/sections/shared';
import { valorantAgentIcon } from '../../match/_components/sections/valorant/valorantAssets';
import { useDotaAssets, dotaHeroImage } from '../../match/_components/sections/dota2/dotaAssets';
import { owHeroPortrait } from '../../match/_components/sections/overwatch/owAssets';
import TournamentMatchCard from '../../components/tournaments/TournamentMatchCard';
import AdColumn from '../../components/ads/AdColumn';
import LiquipediaBadge from '../../components/common/LiquipediaBadge';

interface PlayerDetailPageClientProps {
  pagename: string;
  wiki: string;
  initialPlayer?: PlayerDetail | null;
}

const SOCIAL_LABELS: Record<string, string> = {
  twitter: 'X / Twitter',
  twitch: 'Twitch',
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  vk: 'VK',
  vlr: 'VLR.gg',
  faceit: 'FACEIT',
  esl: 'ESL',
  dotabuff: 'Dotabuff',
  opendota: 'OpenDota',
  'lol-pros': 'LoL Pros',
  weibo: 'Weibo',
  discord: 'Discord',
};

function formatMoney(v: number): string {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

// Tuile de pick signature — icône par jeu quand une source d'assets existe.
function SignaturePickTile({ pick, wiki, dotaMaps }: { pick: string; wiki: string; dotaMaps: ReturnType<typeof useDotaAssets> }) {
  const icon =
    wiki === 'valorant' ? valorantAgentIcon(pick)
    : wiki === 'overwatch' ? owHeroPortrait(pick)
    : wiki === 'dota2' ? dotaHeroImage(pick, dotaMaps)
    : null;

  // Dota : art paysage 16/9 ; autres : portrait carré
  const isLandscape = wiki === 'dota2';

  return (
    <div className="flex flex-col items-center gap-1.5 group/pick">
      <div className={`${isLandscape ? 'w-20 h-12' : 'w-14 h-14'} rounded-xl overflow-hidden bg-gradient-to-br from-[#182859]/50 to-[#060B13]/80 border border-[var(--color-border-primary)]/30 flex items-center justify-center transition-all group-hover/pick:border-accent/40 group-hover/pick:scale-105`}>
        {icon ? (
          <img src={icon} alt={pick} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Gamepad2 className="w-5 h-5 text-text-muted/40" />
        )}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary text-center max-w-20 leading-tight">
        {pick}
      </span>
    </div>
  );
}

export default function PlayerDetailPageClient({ pagename, wiki, initialPlayer }: PlayerDetailPageClientProps) {
  const t = useTranslations('pages_detail.player_detail');
  const isDark = useIsDarkTheme();
  const dotaMaps = useDotaAssets();

  const [player, setPlayer] = useState<PlayerDetail | null>(initialPlayer || null);
  const [loading, setLoading] = useState(!initialPlayer);
  const [error, setError] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<TeamMatchesResponse | null>(null);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoadingAds, setIsLoadingAds] = useState(true);

  useEffect(() => {
    prewarmFromData([player, team, matches]);
  }, [player, team, matches]);

  useEffect(() => {
    advertisementService.getActiveAdvertisements()
      .then(setAds)
      .catch(() => {})
      .finally(() => setIsLoadingAds(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = initialPlayer ?? await playerService.getPlayer(pagename, wiki);
        if (cancelled) return;
        setPlayer(data);
      } catch (err) {
        console.error('[PlayerDetail] Error loading player:', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagename, wiki]);

  // Équipe actuelle (logo + lien) puis matchs de l'équipe.
  useEffect(() => {
    if (!player?.team_template) return;
    let cancelled = false;
    const template = player.team_template;

    teamService.getTeamByTemplate(template, wiki)
      .then(data => { if (!cancelled) setTeam(data); })
      .catch(() => {});

    setMatchesLoading(true);
    teamService.getTeamMatches(player.pageid || template, wiki, template, player.team_pagename?.replace(/_/g, ' '))
      .then(data => { if (!cancelled) setMatches(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMatchesLoading(false); });

    return () => { cancelled = true; };
  }, [player?.team_template, player?.pageid, player?.team_pagename, wiki]);

  const earningsYears = useMemo(() => {
    const byYear = player?.earnings_by_year || {};
    const entries = Object.entries(byYear)
      .filter(([, v]) => v > 0)
      .sort(([a], [b]) => a.localeCompare(b));
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return { entries, max };
  }, [player?.earnings_by_year]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)]">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <Users className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)]">{t('not_available')}</p>
        </div>
      </div>
    );
  }

  const mainFlag = countryCode(player.nationalities[0]);
  const realName = [player.first_name, player.last_name].filter(Boolean).join(' ')
    || player.name;
  const teamLogo = team ? pickThemeLogo(isDark, team.image_url, (team as unknown as { dark_image_url?: string }).dark_image_url) : null;
  const teamUrl = player.team_template
    ? teamHref({ wiki, template: player.team_template, name: team?.name || player.team_pagename?.replace(/_/g, ' ') || '', image_url: team?.image_url })
    : null;
  const isActive = player.status?.toLowerCase() === 'active';
  const socials = Object.entries(player.links || {}).filter(([k]) => SOCIAL_LABELS[k]);
  const recentMatches = (matches?.recent || []).slice(0, 8);
  const upcomingMatches = matches?.upcoming || [];

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-[var(--color-border-primary)]/40">
        <div className="absolute inset-0 bg-gradient-to-br from-[#182859]/25 via-transparent to-[#F22E62]/[0.06]" />
        <div className="relative container mx-auto px-4 pt-35 pb-8">
          <div className="flex items-start gap-5">
            {/* Drapeau principal en avatar */}
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border border-[var(--color-border-primary)]/40 bg-[var(--color-bg-secondary)] flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/20">
              {mainFlag ? (
                <span className={`fi fi-${mainFlag} fis`} style={{ width: '100%', height: '100%', fontSize: 'unset', lineHeight: 'unset', backgroundSize: 'cover' }} />
              ) : (
                <Users className="w-8 h-8 text-text-muted/50" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Pills */}
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                {player.status && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isActive
                      ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/25'
                      : 'bg-[var(--color-bg-hover)] text-text-muted border-[var(--color-border-primary)]/40'
                  }`}>
                    {player.status}
                  </span>
                )}
                {(player.roles || []).map(role => (
                  <span key={role} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${getRoleBadgeStyle(role)}`}>
                    {role}
                  </span>
                ))}
              </div>

              <h1 className="text-3xl md:text-4xl font-black text-text-primary leading-tight tracking-tight">
                {player.id}
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                {realName}
                {player.localized_name && player.localized_name !== realName && (
                  <span className="text-text-muted"> · {player.localized_name}</span>
                )}
              </p>

              {/* Meta line */}
              <div className="flex items-center gap-4 flex-wrap mt-3 text-sm text-text-secondary">
                {player.nationalities.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-accent" />
                    {player.nationalities.join(' / ')}
                  </span>
                )}
                {player.age ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    {player.age} {t('years_old')}
                  </span>
                ) : null}
                {player.earnings > 0 && (
                  <span className="flex items-center gap-1.5 font-black text-accent tabular-nums drop-shadow-[0_0_10px_rgba(242,46,98,0.25)]">
                    <Trophy className="w-3.5 h-3.5" />
                    {formatMoney(player.earnings)}
                  </span>
                )}
                <LiquipediaBadge />
              </div>

              {/* Team + socials */}
              <div className="flex items-center gap-2.5 flex-wrap mt-4">
                {teamUrl && (
                  <Link
                    href={teamUrl}
                    className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)]/80 border border-[var(--color-border-primary)]/40 hover:border-accent/40 transition-colors group/team"
                  >
                    <span className="w-6 h-6 rounded-full bg-[var(--color-bg-primary)]/80 flex items-center justify-center overflow-hidden">
                      {teamLogo ? (
                        <img src={proxyImageUrl(teamLogo)} alt="" className="w-4 h-4 object-contain" loading="lazy" />
                      ) : (
                        <Shield className="w-3 h-3 text-text-muted/50" />
                      )}
                    </span>
                    <span className="text-xs font-bold text-text-primary group-hover/team:text-accent transition-colors">
                      {team?.name || player.team_pagename?.replace(/_/g, ' ')}
                    </span>
                    <ExternalLink className="w-3 h-3 text-text-muted/50" />
                  </Link>
                )}
                {socials.map(([key, url]) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-text-muted bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border-primary)]/30 hover:text-text-primary hover:border-[var(--color-border-primary)]/70 transition-colors"
                  >
                    {SOCIAL_LABELS[key]}
                  </a>
                ))}
              </div>
            </div>

            {/* Signature picks */}
            {(player.signature_picks || []).length > 0 && wiki !== 'smash' && (
              <div className="hidden lg:flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-muted">{t('signature_picks')}</span>
                <div className="flex gap-3">
                  {player.signature_picks!.map(pick => (
                    <SignaturePickTile key={pick} pick={pick} wiki={wiki} dotaMaps={dotaMaps} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          <div className="flex-1 min-w-0 space-y-10">

            {/* Signature picks (mobile / smash text chips) */}
            {(player.signature_picks || []).length > 0 && (
              <section className={wiki === 'smash' ? '' : 'lg:hidden'}>
                <SectionHeader icon={Gamepad2} title={t('signature_picks')} />
                {wiki === 'smash' ? (
                  <div className="flex flex-wrap gap-2">
                    {player.signature_picks!.map(pick => (
                      <span key={pick} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary bg-[var(--color-bg-secondary)]/60 border border-[var(--color-border-primary)]/30">
                        {pick}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-4 flex-wrap">
                    {player.signature_picks!.map(pick => (
                      <SignaturePickTile key={pick} pick={pick} wiki={wiki} dotaMaps={dotaMaps} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Matchs à venir (équipe actuelle) ── */}
            {upcomingMatches.length > 0 && (
              <section>
                <SectionHeader icon={Calendar} title={t('upcoming_matches')} />
                <div className="space-y-1.5">
                  {upcomingMatches.map(m => (
                    <TournamentMatchCard key={(m as PandaMatch).match2id || m.id} match={m} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Matchs récents (équipe actuelle) ── */}
            {(matchesLoading || recentMatches.length > 0) && (
              <section>
                <SectionHeader
                  icon={Gamepad2}
                  title={t('recent_matches')}
                  extra={team?.name ? (
                    <span className="text-[10px] text-text-muted font-mono tracking-wide">{team.name}</span>
                  ) : undefined}
                />
                {matchesLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {recentMatches.map(m => (
                      <TournamentMatchCard key={(m as PandaMatch).match2id || m.id} match={m} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Gains par année ── */}
            {earningsYears.entries.length > 0 && (
              <section>
                <SectionHeader
                  icon={Banknote}
                  title={t('earnings_by_year')}
                  extra={
                    <span className="text-[10px] text-accent font-mono font-bold tracking-wide tabular-nums">
                      {formatMoney(player.earnings)} {t('total')}
                    </span>
                  }
                />
                <div className="rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 p-4">
                  <div className="space-y-2">
                    {earningsYears.entries.map(([year, value]) => (
                      <div key={year} className="flex items-center gap-3">
                        <span className="w-10 text-[11px] font-bold text-text-muted tabular-nums flex-shrink-0">{year}</span>
                        <div className="flex-1 h-4 rounded-full bg-[var(--color-bg-primary)]/70 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent transition-all"
                            style={{ width: `${Math.max((value / earningsYears.max) * 100, 2)}%` }}
                          />
                        </div>
                        <span className="w-20 text-right text-xs font-bold text-text-secondary tabular-nums flex-shrink-0">
                          {formatMoney(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ── Parcours (transferts) ── */}
            {player.transfers.length > 0 && (
              <section>
                <SectionHeader icon={ArrowRight} title={t('career')} />
                <div className="rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 overflow-hidden">
                  {player.transfers.map((tr, i) => {
                    const fromUrl = tr.from_team_template ? teamHref({ wiki, template: tr.from_team_template, name: tr.from_team }) : null;
                    const toUrl = tr.to_team_template ? teamHref({ wiki, template: tr.to_team_template, name: tr.to_team }) : null;
                    const dateFormatted = tr.date
                      ? new Date(tr.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '';
                    return (
                      <div
                        key={`${tr.date}_${i}`}
                        className={`flex items-center gap-3 px-4 py-3 ${i < player.transfers.length - 1 ? 'border-b border-[var(--color-border-primary)]/15' : ''} ${i === 0 ? 'bg-accent/[0.03]' : ''}`}
                      >
                        <span className="w-24 text-[11px] text-text-muted tabular-nums flex-shrink-0">{dateFormatted}</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
                          {tr.from_team ? (
                            fromUrl ? (
                              <Link href={fromUrl} className="font-semibold text-text-secondary hover:text-accent transition-colors truncate">{tr.from_team}</Link>
                            ) : (
                              <span className="font-semibold text-text-secondary truncate">{tr.from_team}</span>
                            )
                          ) : (
                            <span className="text-text-muted/60 text-xs italic">{t('career_start')}</span>
                          )}
                          <ArrowRight className="w-3.5 h-3.5 text-text-muted/50 flex-shrink-0" />
                          {toUrl ? (
                            <Link href={toUrl} className={`font-bold truncate transition-colors hover:text-accent ${i === 0 ? 'text-accent' : 'text-text-primary'}`}>{tr.to_team}</Link>
                          ) : (
                            <span className={`font-bold truncate ${i === 0 ? 'text-accent' : 'text-text-primary'}`}>{tr.to_team || '—'}</span>
                          )}
                        </div>
                        {tr.role && (
                          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-text-muted flex-shrink-0">
                            {tr.role}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <AdColumn ads={ads} isSubscribed={false} isLoading={isLoadingAds} />
        </div>
      </main>
    </div>
  );
}
