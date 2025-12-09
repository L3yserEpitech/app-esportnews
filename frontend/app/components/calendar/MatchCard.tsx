'use client';

import { useCallback } from 'react';
import { PandaMatch } from '../../types';

interface MatchCardProps {
  match: PandaMatch;
  onClick?: (match: PandaMatch) => void;
  className?: string;
}

const MatchCard: React.FC<MatchCardProps> = ({
  match,
  onClick,
  className = ''
}) => {
  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getStatusBadge = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'live':
        return (
          <div className="flex items-center gap-1.5 bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
            <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium">EN DIRECT</span>
          </div>
        );
      case 'finished':
        return (
          <div className="bg-gray-700/50 text-gray-300 px-2 py-1 rounded-full">
            <span className="text-xs font-medium">TERMINÉ</span>
          </div>
        );
      case 'not_started':
        return (
          <div className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
            <span className="text-xs font-medium">À VENIR</span>
          </div>
        );
      default:
        return (
          <div className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
            <span className="text-xs font-medium">{status.toUpperCase()}</span>
          </div>
        );
    }
  }, []);

  const getTeamInitials = useCallback((teamName: string) => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }, []);

  const getScore = useCallback((teamId: number) => {
    if (!match.results) return 0;
    const result = match.results.find(r => r.team_id === teamId);
    return result ? result.score : 0;
  }, [match.results]);

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(match);
    }
  }, [onClick, match]);

  const isClickable = !!onClick;

  // Récupérer les équipes depuis opponents
  const homeTeam = match.opponents?.[0]?.opponent;
  const awayTeam = match.opponents?.[1]?.opponent;

  if (!homeTeam || !awayTeam) {
    // Fallback vers l'ancien design si pas d'équipes
    return (
      <div
        className={`
          bg-gray-800 rounded-lg p-4 border border-gray-700
          transition-all duration-300
          ${isClickable ? 'cursor-pointer hover:border-pink-500/50 hover:shadow-lg' : ''}
          ${className}
        `}
        onClick={handleClick}
      >
        <div className="flex items-center justify-between mb-3">
          {getStatusBadge(match.status || 'unknown')}
          <span className="text-xs text-gray-400">
            {match.begin_at ? formatTime(match.begin_at) : '-'}
          </span>
        </div>
        <h4 className="text-lg font-bold text-white line-clamp-2 mb-3">
          {match.name}
        </h4>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="bg-gray-700 px-2 py-1 rounded">
            {match.match_type}
          </span>
          {match.number_of_games && match.number_of_games > 0 && (
            <span>BO{match.number_of_games}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl p-4 md:p-6 border border-gray-800/50 hover:border-pink-500/30 transition-all duration-300 hover:scale-[1.02] overflow-hidden ${isClickable ? 'cursor-pointer' : ''} ${className}`}
      onClick={handleClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `Voir les détails du match ${match.name}` : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      } : undefined}
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4 md:mb-6">
        {getStatusBadge(match.status || 'unknown')}
        <div className="text-xs md:text-sm text-gray-400 font-mono">
          {match.begin_at ? formatTime(match.begin_at) : '-'}
        </div>
      </div>

      {/* Tournament info */}
      <div className="relative mb-4 md:mb-6">
        <h3 className="text-white font-semibold text-base md:text-xl mb-1 md:mb-2 line-clamp-1">
          {match.tournament?.name || match.league?.name || 'Tournament'}
        </h3>
        {match.serie && (
          <p className="text-sm md:text-base text-gray-400">{match.serie.full_name}</p>
        )}
      </div>

      {/* Teams and score */}
      <div className="relative mb-4 md:mb-6">
        <div className="flex items-center justify-between">
          {/* Home team */}
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
              {homeTeam.image_url ? (
                <img
                  src={homeTeam.image_url}
                  alt={homeTeam.name}
                  className="w-full h-full object-cover"
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
                style={{ display: homeTeam.image_url ? 'none' : 'block' }}
              >
                {homeTeam.acronym || getTeamInitials(homeTeam.name)}
              </span>
            </div>
            <span className="text-white text-sm md:text-base font-medium truncate">
              {homeTeam.name}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-2 md:gap-3 mx-3 md:mx-6 flex-shrink-0">
            <div className="text-center">
              <div className="text-xl md:text-3xl font-bold text-pink-400">
                {getScore(homeTeam.id)}
              </div>
            </div>
            <div className="text-gray-500 text-sm md:text-xl">-</div>
            <div className="text-center">
              <div className="text-xl md:text-3xl font-bold text-pink-400">
                {getScore(awayTeam.id)}
              </div>
            </div>
          </div>

          {/* Away team */}
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0 justify-end">
            <span className="text-white text-sm md:text-base font-medium truncate text-right">
              {awayTeam.name}
            </span>
            <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
              {awayTeam.image_url ? (
                <img
                  src={awayTeam.image_url}
                  alt={awayTeam.name}
                  className="w-full h-full object-cover"
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
                style={{ display: awayTeam.image_url ? 'none' : 'block' }}
              >
                {awayTeam.acronym || getTeamInitials(awayTeam.name)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative pt-3 md:pt-4 border-t border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs md:text-sm text-gray-400 font-medium">
              {match.match_type} {match.number_of_games && match.number_of_games > 0 ? `(BO${match.number_of_games})` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {match.league && (
              <>
                <span className="text-xs md:text-sm text-gray-500 truncate max-w-[80px] md:max-w-[120px]">
                  {match.league.name}
                </span>
                <div className="w-4 h-4 md:w-5 md:h-5 bg-gradient-to-br from-gray-700 to-gray-800 rounded-sm flex-shrink-0 overflow-hidden border border-gray-600">
                  {match.league.image_url ? (
                    <img
                      src={match.league.image_url}
                      alt={match.league.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) parent.classList.add('bg-gradient-to-br', 'from-pink-500', 'to-blue-500');
                      }}
                    />
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Streams info */}
        {match.streams_list && match.streams_list.length > 0 && (
          <div className="flex items-center text-xs md:text-sm text-gray-300 mt-2 md:mt-3">
            <span className="mr-2">📺</span>
            <span>
              {match.streams_list.length} stream{match.streams_list.length > 1 ? 's' : ''} disponible{match.streams_list.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Match name overlay on hover */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 gap-1">
        <div className="flex items-center justify-between w-full max-w-xs md:max-w-sm">
          {/* Home team logo */}
          <div className="flex flex-col items-center gap-1.5 md:gap-2 flex-1">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 overflow-hidden">
              {homeTeam.image_url ? (
                <img
                  src={homeTeam.image_url}
                  alt={homeTeam.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
              ) : null}
              <span
                className="text-sm md:text-lg font-bold text-gray-200"
                style={{ display: homeTeam.image_url ? 'none' : 'block' }}
              >
                {homeTeam.acronym || getTeamInitials(homeTeam.name)}
              </span>
            </div>
            <span className="text-xs md:text-sm text-gray-300 font-medium text-center max-w-[60px] md:max-w-[80px] truncate">
              {homeTeam.name}
            </span>
          </div>

          {/* VS separator */}
          <div className="text-xl md:text-3xl font-bold text-pink-400 flex-shrink-0">VS</div>

          {/* Away team logo */}
          <div className="flex flex-col items-center gap-1.5 md:gap-2 flex-1">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 overflow-hidden">
              {awayTeam.image_url ? (
                <img
                  src={awayTeam.image_url}
                  alt={awayTeam.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
              ) : null}
              <span
                className="text-sm md:text-lg font-bold text-gray-200"
                style={{ display: awayTeam.image_url ? 'none' : 'block' }}
              >
                {awayTeam.acronym || getTeamInitials(awayTeam.name)}
              </span>
            </div>
            <span className="text-xs md:text-sm text-gray-300 font-medium text-center max-w-[60px] md:max-w-[80px] truncate">
              {awayTeam.name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchCard;