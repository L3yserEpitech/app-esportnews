'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PandaTournament, PandaPlayer } from '../../types';
import { Users, Trophy, ChevronDown, Shield, ExternalLink } from 'lucide-react';
import { proxyImageUrl } from '../../lib/imageProxy';
import { useIsDarkTheme, pickThemeLogo } from '../../hooks/useIsDarkTheme';

interface TeamsRostersProps {
  tournament: PandaTournament;
  className?: string;
}

const getRoleBadge = (role?: string | null): { label: string; bg: string; text: string } | null => {
  if (!role) return null;
  const lower = role.toLowerCase();
  if (lower.includes('captain') || lower.includes('igl'))
    return { label: role, bg: 'bg-cyan-500/15 border-cyan-500/30', text: 'text-cyan-400' };
  if (lower.includes('coach'))
    return { label: role, bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-400' };
  if (lower.includes('mid'))
    return { label: role, bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-400' };
  if (lower.includes('adc') || lower.includes('bot'))
    return { label: role, bg: 'bg-green-500/15 border-green-500/30', text: 'text-green-400' };
  if (lower.includes('support') || lower.includes('sup'))
    return { label: role, bg: 'bg-yellow-500/15 border-yellow-500/30', text: 'text-yellow-400' };
  if (lower.includes('top'))
    return { label: role, bg: 'bg-red-500/15 border-red-500/30', text: 'text-red-400' };
  if (lower.includes('jungl') || lower.includes('jgl'))
    return { label: role, bg: 'bg-purple-500/15 border-purple-500/30', text: 'text-purple-400' };
  if (lower.includes('awp') || lower.includes('sniper'))
    return { label: role, bg: 'bg-orange-500/15 border-orange-500/30', text: 'text-orange-400' };
  return { label: role, bg: 'bg-[var(--color-bg-tertiary)]/40 border-[var(--color-border-primary)]/40', text: 'text-[var(--color-text-secondary)]' };
};

function PlayerRow({ player, index }: { player: PandaPlayer; index: number }) {
  const roleBadge = getRoleBadge(player.role);

  return (
    <div
      className="group/player flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-primary)]/40 transition-colors duration-150"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Avatar */}
      <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-[var(--color-border-primary)]/50 group-hover/player:ring-[var(--color-accent)]/30 transition-all">
        {player.image_url ? (
          <img
            src={proxyImageUrl(player.image_url)}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--color-bg-tertiary)] to-[var(--color-bg-primary)] flex items-center justify-center">
            <span className="text-[11px] font-bold text-[var(--color-text-muted)] tracking-wide">
              {player.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate block group-hover/player:text-white transition-colors">
          {player.name}
        </span>
      </div>

      {/* Role badge */}
      {roleBadge && (
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleBadge.bg} ${roleBadge.text}`}>
          {roleBadge.label}
        </span>
      )}

      {/* Nationality */}
      {player.nationality && (
        <span className="text-[11px] text-[var(--color-text-muted)] font-medium hidden sm:block min-w-[60px] text-right">
          {player.nationality}
        </span>
      )}
    </div>
  );
}

function TeamCard({ team, players, wiki }: { team: NonNullable<import('../../types').PandaRoster['team']>; players: PandaPlayer[]; wiki?: string | null }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isDark = useIsDarkTheme();
  const activePlayers = players.filter(p => !p.role?.toLowerCase().includes('coach'));
  const coaches = players.filter(p => p.role?.toLowerCase().includes('coach'));

  return (
    <div className="rounded-xl border border-[var(--color-border-primary)]/40 bg-[var(--color-bg-secondary)] overflow-hidden transition-all duration-200 hover:border-[var(--color-border-primary)]/70">
      {/* Team header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--color-bg-primary)]/20 transition-colors cursor-pointer"
      >
        {/* Team logo */}
        <div className="w-11 h-11 rounded-lg bg-[var(--color-bg-primary)]/80 border border-[var(--color-border-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
          {pickThemeLogo(isDark, team.image_url, team.dark_image_url) ? (
            <img
              src={proxyImageUrl(pickThemeLogo(isDark, team.image_url, team.dark_image_url)!)}
              alt={team.name}
              className="w-7 h-7 object-contain"
              loading="lazy"
            />
          ) : (
            <Shield className="w-5 h-5 text-[var(--color-text-muted)]" />
          )}
        </div>

        {/* Team info */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{team.name}</h3>
            {team.template && wiki && (
              <Link
                href={`/equipe/${encodeURIComponent(team.template)}?${new URLSearchParams({ wiki, name: team.name, ...(team.acronym ? { acronym: team.acronym } : {}), ...(team.image_url ? { logo: team.image_url } : {}) }).toString()}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                title={team.name}
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {team.location && (
              <span className="text-[11px] text-[var(--color-text-muted)]">{team.location}</span>
            )}
          </div>
        </div>

        {/* Player count + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] tabular-nums">
            {players.length}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Players list */}
      <div
        className={`transition-all duration-200 overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        {players.length > 0 ? (
          <div className="px-2 pb-2 pt-0.5">
            {/* Active players */}
            {activePlayers.length > 0 && (
              <div className="space-y-0.5">
                {activePlayers.map((player, i) => (
                  <PlayerRow key={player.id} player={player} index={i} />
                ))}
              </div>
            )}

            {/* Coaches separator */}
            {coaches.length > 0 && activePlayers.length > 0 && (
              <div className="mx-3 my-1.5 h-px bg-[var(--color-border-primary)]/30" />
            )}

            {/* Coaches */}
            {coaches.length > 0 && (
              <div className="space-y-0.5">
                {coaches.map((player, i) => (
                  <PlayerRow key={player.id} player={player} index={activePlayers.length + i} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Aucun joueur disponible</p>
          </div>
        )}
      </div>
    </div>
  );
}

const TeamsRosters: React.FC<TeamsRostersProps> = ({ tournament, className = '' }) => {
  const t = useTranslations('pages_detail.tournament_detail');

  const rosters = tournament.expected_roster || [];
  const totalPlayers = rosters.reduce((acc, r) => acc + (r.players?.length || 0), 0);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Users className="w-5 h-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{t('teams_rosters')}</h2>
        <span className="text-xs text-[var(--color-text-muted)] font-medium">
          {rosters.length} {rosters.length > 1 ? t('teams_count_plural') : t('teams_count_singular')}
          {totalPlayers > 0 && (
            <> &middot; {totalPlayers} {totalPlayers > 1 ? t('players_count_plural') : t('players_count_singular')}</>
          )}
        </span>
      </div>

      {rosters.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {rosters
            .filter(roster => roster.team)
            .sort((a, b) => (b.players?.length || 0) - (a.players?.length || 0))
            .map(roster => {
              const team = roster.team!;
              const players = roster.players || [];

              return (
                <TeamCard key={team.id} team={team} players={players} wiki={tournament.wiki} />
              );
            })}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-10 text-center">
          <Users className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)] font-medium">Aucune information d&apos;équipe</p>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Les rosters apparaîtront ici une fois confirmés</p>
        </div>
      )}
    </div>
  );
};

export default TeamsRosters;
