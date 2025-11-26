'use client';

import { useRouter } from 'next/navigation';
import { LiveMatch } from '../../types';

interface LiveMatchCardProps {
  match: LiveMatch;
}

export default function LiveMatchCard({ match }: LiveMatchCardProps) {
  const router = useRouter();

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    const date = new Date(timeString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status?: string) => {
    const statusLower = status?.toLowerCase() || '';
    
    if (statusLower === 'running' || statusLower === 'live') {
      return (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'white',
          }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse bg-white"
          ></div>
          <span className="text-xs font-medium text-white">EN DIRECT</span>
        </div>
      );
    }
    
    if (statusLower === 'finished') {
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
    }
    
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
  };

  const getTeamInitials = (teamName: string) => {
    return teamName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // Get teams from opponents array
  const team1 = match.opponents?.[0]?.opponent;
  const team2 = match.opponents?.[1]?.opponent;
  
  // Get scores from results array
  const team1Score = match.results?.find(r => r.team_id === team1?.id)?.score || 0;
  const team2Score = match.results?.find(r => r.team_id === team2?.id)?.score || 0;

  const handleClick = () => {
    router.push(`/match/${match.id}`);
  };

  return (
    <div
      onClick={handleClick}
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
        {getStatusBadge(match.status)}
        <div
          className="text-xs font-mono"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {formatTime(match.begin_at || match.scheduled_at)}
        </div>
      </div>

      {/* Tournament info */}
      <div className="relative mb-4">
        <h3
          className="font-semibold text-sm mb-1 line-clamp-1"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {match.tournament?.name || match.name}
        </h3>
      </div>

      {/* Teams and score */}
      {team1 && team2 && (
        <div className="relative mb-4">
          <div className="flex items-center justify-between">
            {/* Team 1 */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-secondary)',
                }}
              >
                {team1.image_url ? (
                  <img
                    src={team1.image_url}
                    alt={team1.name}
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
                    display: team1.image_url ? 'none' : 'block',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {team1.acronym || getTeamInitials(team1.name)}
                </span>
              </div>
              <span
                className="text-sm font-medium truncate"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {team1.name}
              </span>
            </div>

            {/* Score */}
            <div className="flex items-center gap-2 mx-4 flex-shrink-0">
              <div className="text-center">
                <div
                  className="text-lg font-bold"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {team1Score}
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
                  {team2Score}
                </div>
              </div>
            </div>

            {/* Team 2 */}
            <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
              <span
                className="text-sm font-medium truncate text-right"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {team2.name}
              </span>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  borderColor: 'var(--color-border-secondary)',
                }}
              >
                {team2.image_url ? (
                  <img
                    src={team2.image_url}
                    alt={team2.name}
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
                    display: team2.image_url ? 'none' : 'block',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {team2.acronym || getTeamInitials(team2.name)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

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
              {match.videogame?.name || 'Esport'}
            </span>
          </div>
          {match.league && (
            <div className="flex items-center gap-2">
              <span
                className="text-xs truncate max-w-[100px]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {match.league.name}
              </span>
              {match.league.image_url && (
                <div
                  className="w-4 h-4 rounded-sm flex-shrink-0 overflow-hidden border"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-secondary)',
                  }}
                >
                  <img
                    src={match.league.image_url}
                    alt={match.league.name}
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
