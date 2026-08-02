'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PandaTournament, PandaPlayer, PandaRoster } from '../../types';
import { Users, ChevronDown, Shield, ExternalLink } from 'lucide-react';
import { proxyImageUrl } from '../../lib/imageProxy';
import { useIsDarkTheme, pickThemeLogo } from '../../hooks/useIsDarkTheme';
import { teamHref } from '../../lib/gameLinks';
import PlayerCard from '../players/PlayerCard';
import { SectionHeader } from '../../match/_components/sections/shared';

interface TeamsRostersProps {
  tournament: PandaTournament;
  className?: string;
}

function TeamCard({ team, players, wiki }: { team: NonNullable<PandaRoster['team']>; players: PandaPlayer[]; wiki?: string | null }) {
  const t = useTranslations('pages_detail.match_detail');
  const [isExpanded, setIsExpanded] = useState(true);
  const isDark = useIsDarkTheme();
  const coaches = players.filter(p => p.role?.toLowerCase().includes('coach'));
  const activePlayers = players.filter(p => !coaches.includes(p));
  const logo = pickThemeLogo(isDark, team.image_url, team.dark_image_url);
  // Les ids des teams de roster sont des hash internes (pas des pageids
  // Liquipedia) — on ne lie vers la page équipe que si le template existe.
  const teamUrl = team.template
    ? teamHref({
        wiki,
        template: team.template,
        name: team.name,
        acronym: team.acronym,
        image_url: team.image_url,
      })
    : null;

  const headerInner = (
    <>
      <div className="w-11 h-11 rounded-xl bg-[var(--color-bg-primary)]/80 border border-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
        {logo ? (
          <img src={proxyImageUrl(logo)} alt={team.name} className="w-8 h-8 object-contain" loading="lazy" />
        ) : (
          <Shield className="w-5 h-5 text-text-muted/50" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-black text-text-primary truncate hover:text-[var(--color-accent)] transition-colors">{team.name}</h3>
          {teamUrl && <ExternalLink className="w-3 h-3 text-text-muted/50 flex-shrink-0" />}
        </div>
        <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mt-0.5">
          {activePlayers.length} {activePlayers.length > 1 ? t('player_plural') : t('player_singular')}
        </p>
      </div>
    </>
  );

  const headerCls = 'flex flex-1 min-w-0 items-center gap-3.5 transition-colors hover:bg-[var(--color-bg-primary)]/25 px-4 py-3.5';

  return (
    <div className="rounded-xl border border-[var(--color-border-primary)]/25 bg-[var(--color-bg-secondary)]/40 overflow-hidden">
      <div className="flex items-stretch border-b border-[var(--color-border-primary)]/15 bg-[var(--color-bg-primary)]/20">
        {teamUrl ? (
          <Link href={teamUrl} className={headerCls}>{headerInner}</Link>
        ) : (
          <button onClick={() => setIsExpanded(!isExpanded)} className={`${headerCls} cursor-pointer`}>{headerInner}</button>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 flex-shrink-0 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <span className="text-[11px] font-medium tabular-nums">{players.length}</span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className={`transition-all duration-200 overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
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
    </div>
  );
}

const TeamsRosters: React.FC<TeamsRostersProps> = ({ tournament, className = '' }) => {
  const t = useTranslations('pages_detail.tournament_detail');

  const rosters = tournament.expected_roster || [];
  const totalPlayers = rosters.reduce((acc, r) => acc + (r.players?.length || 0), 0);

  return (
    <section className={className}>
      <SectionHeader
        icon={Users}
        title={t('teams_rosters')}
        extra={
          <span className="text-[10px] text-text-muted font-mono tracking-wide">
            {rosters.length} {rosters.length > 1 ? t('teams_count_plural') : t('teams_count_singular')}
            {totalPlayers > 0 && (
              <> &middot; {totalPlayers} {totalPlayers > 1 ? t('players_count_plural') : t('players_count_singular')}</>
            )}
          </span>
        }
      />

      {rosters.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          {rosters
            .filter(roster => roster.team)
            .sort((a, b) => (b.players?.length || 0) - (a.players?.length || 0))
            .map(roster => (
              <TeamCard key={roster.team!.id} team={roster.team!} players={roster.players || []} wiki={tournament.wiki} />
            ))}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border-primary)]/30 bg-[var(--color-bg-secondary)]/40 px-4 py-8 flex flex-col items-center gap-2 text-center">
          <Users className="w-5 h-5 text-text-muted/40" />
          <span className="text-sm text-text-muted">{t('no_roster_info')}</span>
        </div>
      )}
    </section>
  );
};

export default TeamsRosters;
