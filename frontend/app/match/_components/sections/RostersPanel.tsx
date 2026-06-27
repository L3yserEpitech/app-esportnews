'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Users, Trophy, Shield, ExternalLink } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { teamHref } from '../../../lib/gameLinks';
import type { PandaPlayer } from '../../../types';
import { getRoleBadgeStyle, SectionHeader, type MatchSectionProps } from './shared';

interface RostersProps extends MatchSectionProps {
  teamsData: any[];
}

export default function RostersPanel({ match, isDark, teamsData }: RostersProps) {
  const t = useTranslations('pages_detail.match_detail');
  if (!match.opponents || match.opponents.length !== 2 || teamsData.length === 0) return null;

  return (
    <section>
      <SectionHeader icon={Users} title={t('section_teams_rosters')} />

      <div className="grid gap-5 lg:grid-cols-2">
        {teamsData.map((teamDetail: any) => {
          const allPlayers: PandaPlayer[] = teamDetail.players || [];
          const activePlayers = allPlayers.filter(p => !p.role?.toLowerCase().includes('coach'));
          const coaches = allPlayers.filter(p => p.role?.toLowerCase().includes('coach'));
          const isWinnerTeam = match.winner_id === teamDetail.id;
          const teamUrl = teamHref({
            wiki: teamDetail.wiki || match.wiki,
            template: teamDetail.template,
            id: teamDetail.id,
            name: teamDetail.name,
            acronym: teamDetail.acronym,
            image_url: teamDetail.image_url,
          });

          return (
            <div key={teamDetail.id} className={`rounded-xl border overflow-hidden transition-colors ${
              isWinnerTeam
                ? 'border-[var(--color-accent)]/25 bg-[var(--color-bg-secondary)]/50'
                : 'border-[var(--color-border-primary)]/25 bg-[var(--color-bg-secondary)]/40'
            }`}>
              <Link href={teamUrl} className="block px-4 py-3 flex items-center gap-3 border-b border-[var(--color-border-primary)]/15 hover:bg-[var(--color-bg-primary)]/20 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-bg-primary)]/80 border border-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {pickThemeLogo(isDark, teamDetail.image_url, teamDetail.dark_mode_image_url) ? (
                    <img src={proxyImageUrl(pickThemeLogo(isDark, teamDetail.image_url, teamDetail.dark_mode_image_url)!)} alt={teamDetail.name} className="w-6 h-6 object-contain" loading="lazy" />
                  ) : (
                    <Shield className="w-4 h-4 text-text-muted/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-text-primary truncate hover:text-[var(--color-accent)] transition-colors">{teamDetail.name}</h3>
                    {isWinnerTeam && <Trophy className="w-3 h-3 text-accent flex-shrink-0" />}
                    <ExternalLink className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
                  </div>
                  <p className="text-[10px] text-text-muted">
                    {allPlayers.length} {allPlayers.length > 1 ? t('player_plural') : t('player_singular')}
                  </p>
                </div>
              </Link>

              <div className="p-2.5">
                {activePlayers.length > 0 ? (
                  <div className="space-y-0.5">
                    {activePlayers.map((player) => (
                      <div key={player.id} className="group/player flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)]/80 ring-1 ring-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover/player:ring-accent/20 transition-all">
                          {player.image_url ? (
                            <img src={proxyImageUrl(player.image_url)} alt={player.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-[10px] font-bold text-text-muted/60">{player.name.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">{player.name}</p>
                          {player.nationality && (
                            <p className="text-[10px] text-text-muted/70 truncate">{player.nationality}</p>
                          )}
                        </div>
                        {player.role && (
                          <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0 ${getRoleBadgeStyle(player.role)}`}>
                            {player.role}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Shield className="w-5 h-5 text-border-primary/50 mx-auto mb-1.5" />
                    <p className="text-text-muted text-[10px]">{t('empty_no_players')}</p>
                  </div>
                )}

                {coaches.length > 0 && activePlayers.length > 0 && (
                  <div className="mx-3 my-2 h-px bg-[var(--color-border-primary)]/15" />
                )}

                {coaches.length > 0 && (
                  <div className="space-y-0.5">
                    {coaches.map((player) => (
                      <div key={player.id} className="group/player flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-primary)]/80 ring-1 ring-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {player.image_url ? (
                            <img src={proxyImageUrl(player.image_url)} alt={player.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-[10px] font-bold text-text-muted/60">{player.name.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">{player.name}</p>
                        </div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/25 flex-shrink-0">
                          {player.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
