'use client';

import { Match, Stream } from '../../types';
import Card from '../ui/Card';
import Button from '../ui/Button';

interface LiveMatchItemProps {
  match: Match;
  className?: string;
}

const LiveMatchItem: React.FC<LiveMatchItemProps> = ({ match, className = '' }) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'text-red-400';
      case 'upcoming':
        return 'text-orange-400';
      case 'finished':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live':
        return '🔴 EN DIRECT';
      case 'upcoming':
        return 'Prochainement';
      case 'finished':
        return 'Terminé';
      default:
        return status;
    }
  };

  const handleStreamClick = (stream: Stream) => {
    // Ouvrir dans un nouvel onglet comme spécifié dans CLAUDE.md
    window.open(stream.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card variant="elevated" className={`hover:border-pink-500/50 transition-all ${className}`}>
      <div className="space-y-3">
        {/* Header avec statut et heure */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`text-xs font-medium ${getStatusColor(match.status)}`}>
              {getStatusText(match.status)}
            </span>
            <span className="text-gray-500 text-xs">
              {formatTime(match.startTime)}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <img
              src={match.game.selected_image.url}
              alt={match.game.name}
              className="w-6 h-6 object-contain"
              loading="lazy"
            />
            <span className="text-xs text-gray-400">
              {match.game.acronym}
            </span>
          </div>
        </div>

        {/* Tournoi */}
        <div className="text-sm text-gray-300 truncate">
          {match.tournament.name}
        </div>

        {/* Équipes */}
        <div className="space-y-2">
          {match.teams.map((team, index) => (
            <div key={team.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {team.logo && (
                  <img
                    src={team.logo}
                    alt={`Logo ${team.name}`}
                    className="w-8 h-8 object-contain rounded"
                    loading="lazy"
                  />
                )}
                <span className="text-white font-medium truncate">
                  {team.name}
                </span>
              </div>
              
              {typeof team.score === 'number' && (
                <span className="text-lg font-bold text-pink-400">
                  {team.score}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Streams */}
        {match.streams && match.streams.length > 0 && (
          <div className="pt-3 border-t border-gray-700">
            <div className="flex flex-wrap gap-2">
              {match.streams.map((stream, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleStreamClick(stream)}
                  className="text-xs"
                  aria-label={`Regarder sur ${stream.platform} en ${stream.language}`}
                >
                  📺 {stream.platform}
                  {stream.language && (
                    <span className="ml-1 text-gray-400">
                      ({stream.language})
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default LiveMatchItem;
