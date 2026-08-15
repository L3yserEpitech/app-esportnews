'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Users, Trophy, Shield, ExternalLink } from 'lucide-react';
import { proxyImageUrl } from '../../../lib/imageProxy';
import { pickThemeLogo } from '../../../hooks/useIsDarkTheme';
import { teamHref } from '../../../lib/gameLinks';
import PlayerCard from '../../../components/players/PlayerCard';
import type { PandaPlayer } from '../../../types';
import { SectionHeader, type MatchSectionProps } from './shared';

interface RostersProps extends MatchSectionProps {
  teamsData: any[];
}

export default function RostersPanel({ match, isDark, teamsData }: RostersProps) {
  const t = useTranslations('pages_detail.match_detail');
  if (!match.opponents || match.opponents.length !== 2 || teamsData.length === 0) return null;

  const wiki = match.wiki;

  return (
    <section>
      <SectionHeader icon={Users} title={t('section_teams_rosters')} />

      <div className="grid gap-5 lg:grid-cols-2 items-start">
        {teamsData.map((teamDetail: any) => {
          const allPlayers: PandaPlayer[] = teamDetail.players || [];
          const coaches = allPlayers.filter(p => p.role?.toLowerCase().includes('coach'));
          const activePlayers = allPlayers.filter(p => !coaches.includes(p));
          const isWinnerTeam = match.winner_id === teamDetail.id;
          const logo = pickThemeLogo(isDark, teamDetail.image_url, teamDetail.dark_mode_image_url);
          const teamUrl = teamHref({
            wiki: teamDetail.wiki || match.wiki,
            template: teamDetail.template,
            id: teamDetail.id,
            name: teamDetail.name,
            acronym: teamDetail.acronym,
            image_url: teamDetail.image_url,
          });

          return (
            <div key={teamDetail.id} className={`rounded-xl border overflow-hidden ${
              isWinnerTeam
                ? 'border-[var(--color-accent)]/25'
                : 'border-[var(--color-border-primary)]/25'
            } bg-[var(--color-bg-secondary)]/40`}>
              <Link href={teamUrl} className={`relative block px-4 py-3.5 flex items-center gap-3.5 border-b transition-colors hover:bg-[var(--color-bg-primary)]/25 ${
                isWinnerTeam ? 'border-[var(--color-accent)]/15 bg-[var(--color-accent)]/[0.04]' : 'border-[var(--color-border-primary)]/15 bg-[var(--color-bg-primary)]/20'
              }`}>
                {isWinnerTeam && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />}
                <div className="w-11 h-11 rounded-xl bg-[var(--color-bg-primary)]/80 border border-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logo ? (
                    <img src={proxyImageUrl(logo)} alt={teamDetail.name} className="w-8 h-8 object-contain" loading="lazy" />
                  ) : (
                    <Shield className="w-5 h-5 text-text-muted/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-text-primary truncate hover:text-[var(--color-accent)] transition-colors">{teamDetail.name}</h3>
                    {isWinnerTeam && <Trophy className="w-3.5 h-3.5 text-accent flex-shrink-0" />}
                    <ExternalLink className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
                  </div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mt-0.5">
                    {activePlayers.length} {activePlayers.length > 1 ? t('player_plural') : t('player_singular')}
                  </p>
                </div>
              </Link>

              <div className="p-2">
                {activePlayers.length > 0 ? (
                  <div className="space-y-0.5">
                    {activePlayers.map((player) => (
                      <PlayerCard key={player.id} player={player} wiki={wiki} />
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
                      <PlayerCard key={player.id} player={player} wiki={wiki} />
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
