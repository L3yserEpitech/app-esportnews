import { LiveMatch } from '../../types';

interface LiveMatchCardProps {
  match: LiveMatch;
}

export default function LiveMatchCard({ match }: LiveMatchCardProps) {
  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
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
      default:
        return (
          <div className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
            <span className="text-xs font-medium">À VENIR</span>
          </div>
        );
    }
  };

  const getTeamInitials = (teamName: string) => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getImageUrl = (hashImage: string) => {
    return `https://images.sportdevs.com/${hashImage}.png`;
  };

  return (
    <div className="group relative bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl p-5 border border-gray-800/50 hover:border-pink-500/30 transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        {getStatusBadge(match.status_type)}
        <div className="text-xs text-gray-400 font-mono">
          {formatTime(match.start_time)}
        </div>
      </div>

      {/* Tournament info */}
      <div className="relative mb-4">
        <h3 className="text-white font-semibold text-sm mb-1 line-clamp-1">
          {match.tournament_name}
        </h3>
      </div>

      {/* Teams and score */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between">
          {/* Home team */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
              {match.home_team_hash_image ? (
                <img
                  src={getImageUrl(match.home_team_hash_image)}
                  alt={match.home_team_name}
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
                style={{ display: match.home_team_hash_image ? 'none' : 'block' }}
              >
                {getTeamInitials(match.home_team_name)}
              </span>
            </div>
            <span className="text-white text-sm font-medium truncate">
              {match.home_team_name}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-2 mx-4 flex-shrink-0">
            <div className="text-center">
              <div className="text-lg font-bold text-pink-400">
                {match.home_team_score.display}
              </div>
            </div>
            <div className="text-gray-500 text-sm">-</div>
            <div className="text-center">
              <div className="text-lg font-bold text-pink-400">
                {match.away_team_score.display}
              </div>
            </div>
          </div>

          {/* Away team */}
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span className="text-white text-sm font-medium truncate text-right">
              {match.away_team_name}
            </span>
            <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
              {match.away_team_hash_image ? (
                <img
                  src={getImageUrl(match.away_team_hash_image)}
                  alt={match.away_team_name}
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
                style={{ display: match.away_team_hash_image ? 'none' : 'block' }}
              >
                {getTeamInitials(match.away_team_name)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative pt-3 border-t border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium">{match.class_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 truncate max-w-[100px]">
              {match.league_name}
            </span>
            <div className="w-4 h-4 bg-gradient-to-br from-gray-700 to-gray-800 rounded-sm flex-shrink-0 overflow-hidden border border-gray-600">
              {match.league_hash_image ? (
                <img
                  src={getImageUrl(match.league_hash_image)}
                  alt={match.league_name}
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
          </div>
        </div>
      </div>

      {/* Match name overlay on hover */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 gap-1">
        <div className="flex items-center justify-between w-full max-w-xs">
          {/* Home team logo */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 overflow-hidden">
              {match.home_team_hash_image ? (
                <img
                  src={getImageUrl(match.home_team_hash_image)}
                  alt={match.home_team_name}
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
                className="text-sm font-bold text-gray-200"
                style={{ display: match.home_team_hash_image ? 'none' : 'block' }}
              >
                {getTeamInitials(match.home_team_name)}
              </span>
            </div>
            <span className="text-xs text-gray-300 font-medium text-center max-w-[70px] truncate">
              {match.home_team_name}
            </span>
          </div>

          {/* VS separator */}
          <div className="text-2xl font-bold text-pink-400 flex-shrink-0">VS</div>

          {/* Away team logo */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 overflow-hidden">
              {match.away_team_hash_image ? (
                <img
                  src={getImageUrl(match.away_team_hash_image)}
                  alt={match.away_team_name}
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
                className="text-sm font-bold text-gray-200"
                style={{ display: match.away_team_hash_image ? 'none' : 'block' }}
              >
                {getTeamInitials(match.away_team_name)}
              </span>
            </div>
            <span className="text-xs text-gray-300 font-medium text-center max-w-[70px] truncate">
              {match.away_team_name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}