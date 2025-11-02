'use client';

import { useMemo } from 'react';
import {
  BarChart3,
  Users,
  Gamepad2,
  CheckCircle,
  Clock,
  Trophy,
  Info,
  TrendingUp,
  Award,
  Zap,
  Target,
  Flame,
} from 'lucide-react';
import { PandaTournament } from '../../types';

interface TournamentStatsProps {
  tournament: PandaTournament;
}

export default function TournamentStats({ tournament }: TournamentStatsProps) {
  const getTierColor = (tier: string) => {
    const colors: { [key: string]: string } = {
      's': 'bg-yellow-500 text-gray-950',
      'a': 'bg-blue-500 text-white',
      'b': 'bg-green-500 text-white',
      'c': 'bg-purple-500 text-white',
      'd': 'bg-gray-500 text-white',
    };
    return colors[tier.toLowerCase()] || colors['d'];
  };

  const getTierBgColor = (tier: string) => {
    const colors: { [key: string]: string } = {
      's': 'from-yellow-500/20 to-yellow-600/10',
      'a': 'from-blue-500/20 to-blue-600/10',
      'b': 'from-green-500/20 to-green-600/10',
      'c': 'from-purple-500/20 to-purple-600/10',
      'd': 'from-gray-500/20 to-gray-600/10',
    };
    return colors[tier.toLowerCase()] || colors['d'];
  };

  const getTierGradient = (tier: string) => {
    const gradients: { [key: string]: string } = {
      's': 'from-yellow-500 to-yellow-400',
      'a': 'from-blue-500 to-blue-400',
      'b': 'from-green-500 to-green-400',
      'c': 'from-purple-500 to-purple-400',
      'd': 'from-gray-500 to-gray-400',
    };
    return gradients[tier.toLowerCase()] || gradients['d'];
  };

  const getTierShadow = (tier: string) => {
    const shadows: { [key: string]: string } = {
      's': 'shadow-yellow-500/20',
      'a': 'shadow-blue-500/20',
      'b': 'shadow-green-500/20',
      'c': 'shadow-purple-500/20',
      'd': 'shadow-gray-500/20',
    };
    return shadows[tier.toLowerCase()] || shadows['d'];
  };

  // Calculs des statistiques
  const stats = useMemo(() => {
    const totalMatches = tournament.matches.length;
    const finishedMatches = tournament.matches.filter(m => m.status === 'finished').length;
    const runningMatches = tournament.matches.filter(m => m.status === 'running').length;
    const notStartedMatches = tournament.matches.filter(m => m.status === 'not_started').length;
    const rescheduleMatches = tournament.matches.filter(m => m.rescheduled).length;
    const progressPercentage = totalMatches > 0 ? (finishedMatches / totalMatches) * 100 : 0;

    // Stats d'équipes
    const totalTeams = tournament.teams.length;
    const confirmedRosters = tournament.expected_roster.length;
    const teamsByParticipation = totalTeams > 0 ? (confirmedRosters / totalTeams * 100) : 0;

    // Stats des matchs par format
    const bestOf3Matches = tournament.matches.filter(m => m.number_of_games === 3).length;
    const bestOf5Matches = tournament.matches.filter(m => m.number_of_games === 5).length;
    const bestOf1Matches = tournament.matches.filter(m => m.number_of_games === 1).length;

    // Matchs en direct disponibles
    const liveMatches = tournament.matches.filter(m => m.live?.supported).length;

    return {
      totalMatches,
      finishedMatches,
      runningMatches,
      notStartedMatches,
      rescheduleMatches,
      progressPercentage,
      totalTeams,
      confirmedRosters,
      teamsByParticipation,
      bestOf3Matches,
      bestOf5Matches,
      bestOf1Matches,
      liveMatches,
    };
  }, [tournament.matches, tournament.teams.length, tournament.expected_roster.length]);

  return (
    <section className="relative space-y-8">
      {/* Effets de fond inspirés de la page login */}
      <div className="absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#F22E62]/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#182859]/40 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F22E62]/10 rounded-full blur-3xl"></div>
      </div>

      {/* Overlay avec dégradé */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#060B13]/60 via-[#091626]/40 to-[#060B13]/60 rounded-3xl"></div>

      {/* Contenu avec backdrop blur */}
      <div className="relative bg-[#091626]/30 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-[#182859]/30">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <span className="w-8 h-8 bg-gradient-to-r from-[#F22E62] to-pink-400 rounded-lg flex items-center justify-center shadow-lg shadow-[#F22E62]/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </span>
            Statistiques du Tournoi
          </h2>
          <p className="text-gray-400">Vue d'ensemble des performances et données clés</p>
        </div>

        {/* Grille principale des statistiques (4 colonnes) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Équipes */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#F22E62]/20 to-pink-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 text-center hover:border-[#F22E62]/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#F22E62] to-pink-400 rounded-xl flex items-center justify-center shadow-lg shadow-[#F22E62]/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-[#F22E62]">
                  {stats.totalTeams}
                </div>
                <p className="text-gray-300 font-medium">Équipes</p>
                <div className="text-xs text-gray-400 bg-[#091626]/50 rounded-lg px-3 py-1 border border-[#182859]/30">
                  {stats.confirmedRosters} roster{stats.confirmedRosters > 1 ? 's' : ''} confirmé{stats.confirmedRosters > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Matchs total */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#182859]/20 to-blue-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 text-center hover:border-[#182859]/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-[#182859] to-blue-400 rounded-xl flex items-center justify-center shadow-lg shadow-[#182859]/20">
                  <Gamepad2 className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-[#182859]">
                  {stats.totalMatches}
                </div>
                <p className="text-gray-300 font-medium">Matchs</p>
                <div className="text-xs text-gray-400 bg-[#091626]/50 rounded-lg px-3 py-1 border border-[#182859]/30">
                  {stats.liveMatches} disponible{stats.liveMatches > 1 ? 's' : ''} en direct
                </div>
              </div>
            </div>
          </div>

          {/* Matchs terminés */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 text-center hover:border-green-500/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-green-500 to-green-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-green-400">
                  {stats.finishedMatches}
                </div>
                <p className="text-gray-300 font-medium">Terminés</p>
                <div className="text-xs text-gray-400 bg-[#091626]/50 rounded-lg px-3 py-1 border border-[#182859]/30">
                  {stats.runningMatches} en cours
                </div>
              </div>
            </div>
          </div>

          {/* Matchs à venir */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 text-center hover:border-orange-500/50 transition-all duration-300 hover:scale-105 backdrop-blur-sm">
              <div className="space-y-3">
                <div className="w-12 h-12 mx-auto bg-gradient-to-br from-orange-500 to-orange-400 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-orange-400">
                  {stats.notStartedMatches}
                </div>
                <p className="text-gray-300 font-medium">À venir</p>
                <div className="text-xs text-gray-400 bg-[#091626]/50 rounded-lg px-3 py-1 border border-[#182859]/30">
                  {stats.rescheduleMatches} reporté{stats.rescheduleMatches > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques avancées (3 colonnes) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informations du tournoi */}
          <div className="relative">
            <div className={`absolute inset-0 bg-gradient-to-br ${getTierBgColor(tournament.tier)} rounded-2xl blur-xl`}></div>
            <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 bg-gradient-to-br ${getTierGradient(tournament.tier)} rounded-lg flex items-center justify-center shadow-lg ${getTierShadow(tournament.tier)}`}>
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Informations</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Format</span>
                    <span className="text-white font-medium">{tournament.type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Région</span>
                    <span className="text-white font-medium">{tournament.region}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Tier</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getTierColor(tournament.tier)}`}>
                      {tournament.tier.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Jeu</span>
                    <span className="text-white font-medium">{tournament.videogame.name}</span>
                  </div>
                  {tournament.prizepool && (
                    <div className="flex justify-between items-center pt-2 border-t border-[#182859]/30">
                      <span className="text-gray-400">Dotation</span>
                      <span className="text-[#F22E62] font-bold">{tournament.prizepool}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progression du tournoi */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 rounded-2xl blur-xl"></div>
            <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-400 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Progression</h3>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Avancement</span>
                      <span className="text-white font-medium">{Math.round(stats.progressPercentage)}%</span>
                    </div>
                    <div className="w-full bg-[#091626] rounded-full h-2 border border-[#182859]/30">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2 rounded-full transition-all duration-1000 shadow-lg shadow-cyan-500/20"
                        style={{ width: `${stats.progressPercentage}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center">
                      <div className="text-cyan-400 font-bold">{stats.finishedMatches}</div>
                      <div className="text-gray-400">Terminés</div>
                    </div>
                    <div className="text-center">
                      <div className="text-orange-400 font-bold">{stats.notStartedMatches}</div>
                      <div className="text-gray-400">Restants</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Équipe gagnante */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-2xl blur-xl"></div>
            <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 backdrop-blur-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-yellow-400 rounded-lg flex items-center justify-center shadow-lg shadow-yellow-500/20">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Gagnant</h3>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const winner = tournament.winner_id ? tournament.teams.find(t => t.id === tournament.winner_id) : null;

                    if (winner) {
                      return (
                        <div className="text-center space-y-2">
                          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded-xl flex items-center justify-center border border-yellow-500/20">
                            {winner.image_url ? (
                              <img
                                src={winner.image_url}
                                alt={winner.name}
                                className="w-12 h-12 object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <Trophy className="w-8 h-8 text-yellow-400" />
                            )}
                          </div>
                          <div>
                            <div className="text-white font-bold">{winner.name}</div>
                            <div className="text-gray-400 text-sm">{winner.acronym}</div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center space-y-2">
                          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-500/20 to-gray-600/10 rounded-xl flex items-center justify-center border border-gray-500/20">
                            <Clock className="w-8 h-8 text-gray-400" />
                          </div>
                          <div>
                            <div className="text-gray-400 font-medium">À déterminer</div>
                            <div className="text-gray-500 text-sm">Tournoi en cours</div>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques détaillées supplémentaires */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Format des matchs */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 rounded-2xl blur-xl"></div>
          <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-400 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Format des Matchs</h3>
              </div>
              <div className="space-y-2">
                {stats.bestOf1Matches > 0 && (
                  <div className="flex justify-between items-center p-3 bg-[#091626]/50 rounded-lg border border-[#182859]/30">
                    <span className="text-gray-300">Matchs uniques (Bo1)</span>
                    <span className="text-indigo-400 font-bold">{stats.bestOf1Matches}</span>
                  </div>
                )}
                {stats.bestOf3Matches > 0 && (
                  <div className="flex justify-between items-center p-3 bg-[#091626]/50 rounded-lg border border-[#182859]/30">
                    <span className="text-gray-300">Best of 3</span>
                    <span className="text-indigo-400 font-bold">{stats.bestOf3Matches}</span>
                  </div>
                )}
                {stats.bestOf5Matches > 0 && (
                  <div className="flex justify-between items-center p-3 bg-[#091626]/50 rounded-lg border border-[#182859]/30">
                    <span className="text-gray-300">Best of 5</span>
                    <span className="text-indigo-400 font-bold">{stats.bestOf5Matches}</span>
                  </div>
                )}
                {stats.bestOf1Matches === 0 && stats.bestOf3Matches === 0 && stats.bestOf5Matches === 0 && (
                  <div className="text-center p-3 text-gray-400">Pas de matchs planifiés</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Statut des équipes */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-rose-600/5 rounded-2xl blur-xl"></div>
          <div className="relative bg-[#060B13]/50 border border-[#182859]/50 rounded-2xl p-6 backdrop-blur-sm">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-400 rounded-lg flex items-center justify-center shadow-lg shadow-rose-500/20">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Participation aux Rosters</h3>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Taux de confirmation</span>
                    <span className="text-white font-medium">{Math.round(stats.teamsByParticipation)}%</span>
                  </div>
                  <div className="w-full bg-[#091626] rounded-full h-2 border border-[#182859]/30">
                    <div
                      className="bg-gradient-to-r from-rose-500 to-rose-400 h-2 rounded-full transition-all duration-1000 shadow-lg shadow-rose-500/20"
                      style={{ width: `${stats.teamsByParticipation}%` }}
                    ></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center p-3 bg-[#091626]/50 rounded-lg border border-[#182859]/30">
                    <div className="text-rose-400 font-bold">{stats.confirmedRosters}</div>
                    <div className="text-gray-400 text-xs">Confirmés</div>
                  </div>
                  <div className="text-center p-3 bg-[#091626]/50 rounded-lg border border-[#182859]/30">
                    <div className="text-orange-400 font-bold">{stats.totalTeams - stats.confirmedRosters}</div>
                    <div className="text-gray-400 text-xs">En attente</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
