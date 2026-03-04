'use client';

import { useTranslations } from 'next-intl';
import { PandaTournament } from '../../types';
import { Users, Trophy } from 'lucide-react';
import { proxyImageUrl } from '../../lib/imageProxy';

interface TeamsRostersProps {
  tournament: PandaTournament;
  className?: string;
}

const getRoleColor = (role?: string | null) => {
  if (!role) return 'text-[var(--color-text-muted)]';
  const lower = role.toLowerCase();
  if (lower.includes('mid')) return 'text-blue-400';
  if (lower.includes('adc') || lower.includes('bot')) return 'text-green-400';
  if (lower.includes('support') || lower.includes('sup')) return 'text-yellow-400';
  if (lower.includes('top')) return 'text-red-400';
  if (lower.includes('jungl') || lower.includes('jgl')) return 'text-purple-400';
  if (lower.includes('awp') || lower.includes('sniper')) return 'text-orange-400';
  if (lower.includes('igl') || lower.includes('captain')) return 'text-cyan-400';
  if (lower.includes('coach')) return 'text-amber-400';
  return 'text-[var(--color-text-secondary)]';
};

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
          {rosters.filter(roster => roster.team).map(roster => {
            const team = roster.team!;
            const players = roster.players || [];

            return (
              <div
                key={team.id}
                className="rounded-xl border border-[var(--color-border-primary)]/50 bg-[var(--color-bg-secondary)] overflow-hidden"
              >
                {/* Team header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-primary)]/30">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {team.image_url ? (
                      <img
                        src={proxyImageUrl(team.image_url)}
                        alt={team.name}
                        className="w-7 h-7 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Trophy className="w-4 h-4 text-[var(--color-text-muted)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{team.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      {team.acronym && <span className="font-semibold text-[var(--color-accent)]">{team.acronym}</span>}
                      {team.location && <span>{team.location}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {players.length} {players.length > 1 ? 'joueurs' : 'joueur'}
                  </span>
                </div>

                {/* Players */}
                {players.length > 0 ? (
                  <div className="px-4 py-3">
                    <div className="space-y-1.5">
                      {players.map(player => (
                        <div key={player.id} className="flex items-center gap-2.5 py-1">
                          {/* Small avatar */}
                          <div className="w-7 h-7 rounded-full bg-[var(--color-bg-primary)]/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {player.image_url ? (
                              <img
                                src={proxyImageUrl(player.image_url)}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
                                {player.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate flex-1">
                            {player.name}
                          </span>
                          {player.role && (
                            <span className={`text-[11px] font-medium ${getRoleColor(player.role)}`}>
                              {player.role}
                            </span>
                          )}
                          {player.nationality && (
                            <span className="text-[11px] text-[var(--color-text-muted)] hidden sm:inline">
                              {player.nationality}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center">
                    <p className="text-xs text-[var(--color-text-muted)]">Aucun joueur disponible</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] p-10 text-center">
          <Users className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)] font-medium">Aucune information d'équipe</p>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">Les rosters apparaîtront ici une fois confirmés</p>
        </div>
      )}
    </div>
  );
};

export default TeamsRosters;
