'use client';

import { useState } from 'react';
import { PandaTournament, PandaPlayer } from '../../types';
import { Users, MapPin, Trophy, Zap } from 'lucide-react';

interface TeamsRostersProps {
  tournament: PandaTournament;
  className?: string;
}

const TeamsRosters: React.FC<TeamsRostersProps> = ({ tournament, className = '' }) => {
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<number | null>(null);

  const getPlayerInitials = (playerName: string) => {
    return playerName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getRoleColor = (role?: string | null) => {
    if (!role) return 'text-gray-400';
    const lowerRole = role.toLowerCase();
    if (lowerRole.includes('mid')) return 'text-blue-400';
    if (lowerRole.includes('adc')) return 'text-green-400';
    if (lowerRole.includes('support')) return 'text-yellow-400';
    if (lowerRole.includes('top')) return 'text-red-400';
    if (lowerRole.includes('jungl')) return 'text-purple-400';
    return 'text-cyan-400';
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#F44576] to-[#F44576] rounded-lg flex items-center justify-center shadow-lg shadow-[#F44576]/20">
            <Users className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">Équipes & Rosters</h2>
        </div>
        <p className="text-gray-400 text-sm ml-13">
          {tournament.expected_roster.length} équipe{tournament.expected_roster.length > 1 ? 's' : ''} •
          {' '}{tournament.expected_roster.reduce((acc, r) => acc + r.players.length, 0)} joueur{tournament.expected_roster.reduce((acc, r) => acc + r.players.length, 0) > 1 ? 's' : ''}
        </p>
      </div>

      {/* Teams Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {tournament.expected_roster.map(roster => {
          const isExpanded = expandedTeam === roster.team.id;
          const activePlayers = roster.players.filter(p => p.active).length;

          return (
            <div key={roster.team.id} className="group">
              {/* Card background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#F44576]/10 via-transparent to-[#182859]/10 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>

              {/* Main card */}
              <div className="relative bg-gradient-to-br from-[#091626]/40 to-[#060B13]/60 border border-[#182859]/40 rounded-2xl overflow-hidden backdrop-blur-sm hover:border-[#F44576]/30 transition-all duration-300 flex flex-col h-full">

                {/* Team Header */}
                <button
                  onClick={() => setExpandedTeam(isExpanded ? null : roster.team.id)}
                  className="p-4 border-b border-[#182859]/20 hover:bg-[#182859]/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Team Logo */}
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#182859]/50 to-[#060B13]/50 border border-[#182859]/30 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:border-[#F44576]/40 transition-colors">
                      {roster.team.image_url ? (
                        <img
                          src={roster.team.image_url}
                          alt={roster.team.name}
                          className="w-full h-full object-contain p-1"
                          loading="lazy"
                        />
                      ) : (
                        <Trophy className="w-8 h-8 text-gray-500" />
                      )}
                    </div>

                    {/* Team Info */}
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-bold text-white group-hover:text-[#F44576] transition-colors">
                        {roster.team.name}
                      </h3>
                      {roster.team.acronym && (
                        <p className="text-sm text-[#F44576] font-semibold">
                          {roster.team.acronym}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {roster.team.location && (
                          <>
                            <MapPin className="w-3 h-3 text-[#F44576]" />
                            <span>{roster.team.location}</span>
                          </>
                        )}
                        <span className="text-gray-600">•</span>
                        <span>{roster.players.length} joueur{roster.players.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <div className="text-gray-400 group-hover:text-[#F44576] transition-colors">
                      <svg
                        className={`w-5 h-5 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Players Section */}
                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[1000px]' : 'max-h-96'}`}>
                  <div className="p-4 space-y-4">
                    {roster.players.length > 0 ? (
                      <>
                        {/* Players Grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                          {roster.players.map((player) => (
                            <div
                              key={player.id}
                              className="group/player cursor-pointer"
                              onMouseEnter={() => setHoveredPlayer(player.id)}
                              onMouseLeave={() => setHoveredPlayer(null)}
                            >
                              {/* Player Avatar */}
                              <div className="relative mb-2">
                                <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-[#182859]/50 to-[#060B13]/50 border border-[#182859]/30 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover/player:border-[#F44576]/50 group-hover/player:shadow-lg group-hover/player:shadow-[#F44576]/20">
                                  {player.image_url ? (
                                    <img
                                      src={player.image_url}
                                      alt={player.name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="text-xl font-bold text-gray-500">
                                      {getPlayerInitials(player.name)}
                                    </div>
                                  )}

                                  {/* Hover overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
                                    <div className="text-center">
                                      {player.role && (
                                        <p className={`text-xs font-semibold ${getRoleColor(player.role)}`}>
                                          {player.role}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Player Info */}
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-white truncate group-hover/player:text-[#F44576] transition-colors text-center">
                                  {player.name}
                                </p>
                                {player.role && (
                                  <p className={`text-xs truncate text-center ${getRoleColor(player.role)}`}>
                                    {player.role}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Team Stats */}
                        <div className="border-t border-[#182859]/20 pt-4 grid grid-cols-2 gap-3">
                          <div className="text-center p-2 bg-[#182859]/10 rounded-lg">
                            <p className="text-lg font-bold text-[#F44576]">{roster.players.length}</p>
                            <p className="text-xs text-gray-400">Joueurs</p>
                          </div>
                          <div className="text-center p-2 bg-[#182859]/10 rounded-lg">
                            <p className="text-lg font-bold text-green-400">{activePlayers}</p>
                            <p className="text-xs text-gray-400">Actifs</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6">
                        <Users className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Aucun joueur disponible</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {tournament.expected_roster.length === 0 && (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[#F44576]/5 via-transparent to-[#182859]/5 rounded-2xl blur-2xl -z-10"></div>
          <div className="bg-gradient-to-br from-[#091626]/40 to-[#060B13]/60 border border-[#182859]/40 rounded-2xl p-12 text-center backdrop-blur-sm">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#182859]/50 to-[#060B13]/50 rounded-xl flex items-center justify-center mx-auto border border-[#182859]/30">
                <Users className="w-8 h-8 text-gray-500" />
              </div>
              <div>
                <p className="text-gray-400 text-lg font-medium">Aucune information d'équipe</p>
                <p className="text-gray-500 text-sm">Les rosters apparaîtront ici une fois confirmés</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsRosters;
