'use client';

import { PandaTournament, PandaMatch } from '../../types';
import Card from '../ui/Card';

interface BracketDisplayProps {
  tournament: PandaTournament;
  className?: string;
}

const BracketDisplay: React.FC<BracketDisplayProps> = ({ tournament, className = '' }) => {
  // Organiser les matchs par phase avec une logique plus intelligente
  const organizeMatchesByPhase = () => {
    const phases: { [key: string]: PandaMatch[] } = {};

    (tournament.matches || []).forEach(match => {
      let phase = 'Groupes';
      
      // Logique plus précise pour déterminer la phase
      const matchName = match.name.toLowerCase();
      
      if (matchName.includes('final') && !matchName.includes('semi')) {
        phase = 'Finale';
      } else if (matchName.includes('semi') || matchName.includes('demi')) {
        phase = 'Demi-finales';
      } else if (matchName.includes('quarter') || matchName.includes('quart')) {
        phase = 'Quarts de finale';
      } else if (matchName.includes('round of 16') || matchName.includes('huitième')) {
        phase = 'Huitièmes de finale';
      } else if (matchName.includes('round of 32')) {
        phase = 'Trente-deuxièmes';
      } else if (matchName.includes('group') || matchName.includes('groupe')) {
        phase = 'Phase de groupes';
      } else if (matchName.includes('playoff') || matchName.includes('élimination')) {
        phase = 'Playoffs';
      }

      if (!phases[phase]) {
        phases[phase] = [];
      }
      phases[phase].push(match);
    });

    return phases;
  };

  const phases = organizeMatchesByPhase();
  const phaseOrder = ['Phase de groupes', 'Trente-deuxièmes', 'Huitièmes de finale', 'Quarts de finale', 'Demi-finales', 'Finale', 'Playoffs', 'Groupes'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'finished':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'running':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'not_started':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'finished':
        return '✓ Terminé';
      case 'running':
        return '🔴 En cours';
      case 'not_started':
        return '⏳ À venir';
      default:
        return status;
    }
  };

  const formatMatchTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTeamInitials = (teamName: string) => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 3)
      .toUpperCase();
  };

  return (
    <div className={`space-y-8 ${className}`}>
      <div>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          🏆 Bracket du Tournoi
        </h2>

        {/* Affichage par phases avec design amélioré */}
        <div className="space-y-12">
          {phaseOrder.map(phaseName => {
            const phaseMatches = phases[phaseName];
            if (!phaseMatches || phaseMatches.length === 0) return null;

            return (
              <div key={phaseName} className="space-y-6">
                {/* En-tête de phase */}
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-blue-600/10 rounded-lg blur-sm"></div>
                  <div className="relative bg-gray-900/50 border border-pink-500/20 rounded-lg p-4">
                    <h3 className="text-xl font-bold text-pink-400 uppercase tracking-wide flex items-center gap-3">
                      <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
                      {phaseName}
                      <span className="text-sm text-gray-400 font-normal">
                        ({phaseMatches.length} match{phaseMatches.length > 1 ? 's' : ''})
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Grille des matchs */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {phaseMatches.map(match => {
                    const opponent1 = match.opponents?.[0];
                    const opponent2 = match.opponents?.[1];
                    const result1 = match.results?.find(r => r.team_id === opponent1?.opponent?.id);
                    const result2 = match.results?.find(r => r.team_id === opponent2?.opponent?.id);
                    const winner = match.winner_id;

                    return (
                      <Card key={match.id} variant="elevated" className="overflow-hidden hover:border-pink-500/50 transition-all duration-300">
                        <div className="p-4 space-y-4">
                          {/* Header avec statut et infos */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(match.status || 'unknown')}`}>
                                {getStatusText(match.status || 'unknown')}
                              </span>
                              {(match as { rescheduled?: boolean }).rescheduled && (
                                <span className="text-xs text-yellow-400 font-medium">📋 Reporté</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              {match.begin_at ? formatMatchTime(match.begin_at) : '-'}
                            </div>
                          </div>

                          {/* Nom du match */}
                          <div className="text-sm font-semibold text-white text-center">
                            {match.name}
                          </div>

                          {/* Équipes avec design amélioré */}
                          <div className="space-y-3">
                            {opponent1?.opponent && (
                              <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                winner === opponent1.opponent.id 
                                  ? 'bg-green-500/10 border border-green-500/30' 
                                  : 'bg-gray-700/30 hover:bg-gray-700/50'
                              }`}>
                                {/* Logo équipe */}
                                <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
                                  {opponent1.opponent.image_url ? (
                                    <img
                                      src={opponent1.opponent.image_url}
                                      alt={opponent1.opponent.name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'block';
                                      }}
                                    />
                                  ) : null}
                                  <span
                                    className="text-xs font-bold text-gray-200"
                                    style={{ display: opponent1.opponent.image_url ? 'none' : 'block' }}
                                  >
                                    {getTeamInitials(opponent1.opponent.name)}
                                  </span>
                                </div>

                                {/* Nom équipe */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    {opponent1.opponent.acronym || opponent1.opponent.name}
                                  </p>
                                  {opponent1.opponent.acronym && (
                                    <p className="text-xs text-gray-400 truncate">
                                      {opponent1.opponent.name}
                                    </p>
                                  )}
                                </div>

                                {/* Score */}
                                {result1 && (
                                  <span className={`text-lg font-bold flex-shrink-0 ${
                                    winner === opponent1.opponent.id ? 'text-green-400' : 'text-pink-400'
                                  }`}>
                                    {result1.score}
                                  </span>
                                )}
                              </div>
                            )}

                            {opponent2?.opponent && (
                              <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                winner === opponent2.opponent.id 
                                  ? 'bg-green-500/10 border border-green-500/30' 
                                  : 'bg-gray-700/30 hover:bg-gray-700/50'
                              }`}>
                                {/* Logo équipe */}
                                <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
                                  {opponent2.opponent.image_url ? (
                                    <img
                                      src={opponent2.opponent.image_url}
                                      alt={opponent2.opponent.name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const fallback = target.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'block';
                                      }}
                                    />
                                  ) : null}
                                  <span
                                    className="text-xs font-bold text-gray-200"
                                    style={{ display: opponent2.opponent.image_url ? 'none' : 'block' }}
                                  >
                                    {getTeamInitials(opponent2.opponent.name)}
                                  </span>
                                </div>

                                {/* Nom équipe */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    {opponent2.opponent.acronym || opponent2.opponent.name}
                                  </p>
                                  {opponent2.opponent.acronym && (
                                    <p className="text-xs text-gray-400 truncate">
                                      {opponent2.opponent.name}
                                    </p>
                                  )}
                                </div>

                                {/* Score */}
                                {result2 && (
                                  <span className={`text-lg font-bold flex-shrink-0 ${
                                    winner === opponent2.opponent.id ? 'text-green-400' : 'text-pink-400'
                                  }`}>
                                    {result2.score}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Infos supplémentaires */}
                          <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
                            <div className="flex justify-between">
                              <span>
                                <span className="text-pink-400 font-semibold">{match.number_of_games || 0}</span> match{(match.number_of_games || 0) > 1 ? 's' : ''}
                              </span>
                              {match.end_at && (
                                <span>Fin: {new Date(match.end_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fallback si pas de matches */}
        {(tournament.matches?.length || 0) === 0 && (
          <Card variant="outlined" className="p-8 text-center">
            <div className="space-y-4">
              <div className="text-6xl">🏆</div>
              <p className="text-gray-400 text-lg">Aucun match disponible pour ce tournoi</p>
              <p className="text-gray-500 text-sm">Les matchs apparaîtront ici une fois programmés</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BracketDisplay;
