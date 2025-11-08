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
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{
              backgroundColor: 'var(--color-status-live)',
              color: 'white',
              opacity: 0.2,
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: 'var(--color-status-live)' }}
            ></div>
            <span className="text-xs font-medium">EN DIRECT</span>
          </div>
        );
      case 'finished':
        return (
          <div
            className="px-2 py-1 rounded-full"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <span className="text-xs font-medium">TERMINÉ</span>
          </div>
        );
      default:
        return (
          <div
            className="px-2 py-1 rounded-full"
            style={{
              backgroundColor: 'var(--color-primary-600)',
              color: 'var(--color-text-secondary)',
            }}
          >
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
    <div
      className="group relative rounded-xl p-5 transition-all duration-300 hover:scale-[1.02] cursor-pointer overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderWidth: '1px',
        borderColor: 'var(--color-border-secondary)',
      }}
    >
      {/* Background glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          backgroundImage: 'linear-gradient(to bottom right, var(--color-accent), var(--color-primary-600))',
          opacity: '0.05',
        }}
      ></div>

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        {getStatusBadge(match.status_type)}
        <div
          className="text-xs font-mono"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {formatTime(match.start_time)}
        </div>
      </div>

      {/* Tournament info */}
      <div className="relative mb-4">
        <h3
          className="font-semibold text-sm mb-1 line-clamp-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {match.tournament_name}
        </h3>
      </div>

      {/* Teams and score */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between">
          {/* Home team */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 overflow-hidden"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
              }}
            >
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
                className="text-xs font-bold"
                style={{
                  display: match.home_team_hash_image ? 'none' : 'block',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {getTeamInitials(match.home_team_name)}
              </span>
            </div>
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {match.home_team_name}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-2 mx-4 flex-shrink-0">
            <div className="text-center">
              <div
                className="text-lg font-bold"
                style={{ color: 'var(--color-accent)' }}
              >
                {match.home_team_score.display}
              </div>
            </div>
            <div
              className="text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              -
            </div>
            <div className="text-center">
              <div
                className="text-lg font-bold"
                style={{ color: 'var(--color-accent)' }}
              >
                {match.away_team_score.display}
              </div>
            </div>
          </div>

          {/* Away team */}
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span
              className="text-sm font-medium truncate text-right"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {match.away_team_name}
            </span>
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 overflow-hidden"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
              }}
            >
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
                className="text-xs font-bold"
                style={{
                  display: match.away_team_hash_image ? 'none' : 'block',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {getTeamInitials(match.away_team_name)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="relative pt-3 border-t"
        style={{ borderColor: 'var(--color-border-secondary)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {match.class_name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs truncate max-w-[100px]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {match.league_name}
            </span>
            <div
              className="w-4 h-4 rounded-sm flex-shrink-0 overflow-hidden border"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
              }}
            >
              {match.league_hash_image ? (
                <img
                  src={getImageUrl(match.league_hash_image)}
                  alt={match.league_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.style.backgroundImage = `linear-gradient(to bottom right, var(--color-accent), var(--color-primary-600))`;
                    }
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Match name overlay on hover */}
      <div
        className="absolute inset-0 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 gap-1"
        style={{ backgroundColor: 'var(--color-bg-overlay)' }}
      >
        <div className="flex items-center justify-between w-full max-w-xs">
          {/* Home team logo */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center border overflow-hidden"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
              }}
            >
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
                className="text-sm font-bold"
                style={{
                  display: match.home_team_hash_image ? 'none' : 'block',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {getTeamInitials(match.home_team_name)}
              </span>
            </div>
            <span
              className="text-xs font-medium text-center max-w-[70px] truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {match.home_team_name}
            </span>
          </div>

          {/* VS separator */}
          <div
            className="text-2xl font-bold flex-shrink-0"
            style={{ color: 'var(--color-accent)' }}
          >
            VS
          </div>

          {/* Away team logo */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center border overflow-hidden"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-secondary)',
              }}
            >
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
                className="text-sm font-bold"
                style={{
                  display: match.away_team_hash_image ? 'none' : 'block',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {getTeamInitials(match.away_team_name)}
              </span>
            </div>
            <span
              className="text-xs font-medium text-center max-w-[70px] truncate"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {match.away_team_name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}