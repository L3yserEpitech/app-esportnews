'use client';

import { useState } from 'react';
import { PandaTournament, PandaPlayer } from '../../types';
import Card from '../ui/Card';

interface TeamsRostersProps {
  tournament: PandaTournament;
  className?: string;
}

interface PlayerTooltipProps {
  player: PandaPlayer;
  isVisible: boolean;
  position: { x: number; y: number };
}

const PlayerTooltip: React.FC<PlayerTooltipProps> = ({ player, isVisible, position }) => {
  if (!isVisible) return null;

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl pointer-events-none"
      style={{
        left: position.x + 10,
        top: position.y - 10,
        transform: 'translateY(-100%)'
      }}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {player.image_url && (
            <img
              src={player.image_url}
              alt={player.name}
              className="w-8 h-8 rounded-full object-cover"
              loading="lazy"
            />
          )}
          <div>
            <p className="text-white font-semibold text-sm">{player.name}</p>
            {player.first_name && player.last_name && (
              <p className="text-pink-400 text-xs">{player.first_name} {player.last_name}</p>
            )}
          </div>
        </div>
        
        <div className="text-xs text-gray-400 space-y-1">
          {player.role && (
            <p>🎮 {player.role}</p>
          )}
          {player.age && (
            <p>🎂 {player.age} ans</p>
          )}
          {player.nationality && (
            <p>🌍 {player.nationality}</p>
          )}
          {player.active && (
            <p className="text-green-400">✅ Actif</p>
          )}
        </div>
      </div>
    </div>
  );
};

const TeamsRosters: React.FC<TeamsRostersProps> = ({ tournament, className = '' }) => {
  const [hoveredPlayer, setHoveredPlayer] = useState<{
    player: PandaPlayer;
    position: { x: number; y: number };
  } | null>(null);

  const handlePlayerHover = (player: PandaPlayer, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredPlayer({
      player,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top
      }
    });
  };

  const handlePlayerLeave = () => {
    setHoveredPlayer(null);
  };

  const getPlayerInitials = (playerName: string) => {
    return playerName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        👥 Équipes & Rosters
      </h2>

      <div className="grid gap-6 lg:grid-cols-2">
        {tournament.expected_roster.map(roster => (
          <Card key={roster.team.id} variant="elevated" className="overflow-hidden">
            {/* Header équipe avec design amélioré */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-blue-600/10"></div>
              <div className="relative bg-gray-900/50 p-4 border-b border-gray-700">
                <div className="flex items-center gap-4">
                  {/* Logo équipe */}
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center border border-gray-600 flex-shrink-0 overflow-hidden">
                    {roster.team.image_url ? (
                      <img
                        src={roster.team.image_url}
                        alt={roster.team.name}
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
                      className="text-lg font-bold text-gray-200"
                      style={{ display: roster.team.image_url ? 'none' : 'block' }}
                    >
                      {getPlayerInitials(roster.team.name)}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">
                      {roster.team.name}
                    </h3>
                    {roster.team.acronym && (
                      <p className="text-sm text-pink-400 font-semibold">
                        {roster.team.acronym}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>📍 {roster.team.location}</span>
                      <span>👥 {roster.players.length} joueur{roster.players.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Grille des joueurs avec photos */}
            <div className="p-4">
              {roster.players.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {roster.players.map((player) => (
                    <div
                      key={player.id}
                      className="relative group cursor-pointer"
                      onMouseEnter={(e) => handlePlayerHover(player, e)}
                      onMouseLeave={handlePlayerLeave}
                    >
                      {/* Photo du joueur */}
                      <div className="relative">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-gray-700 to-gray-800 rounded-full flex items-center justify-center border-2 border-gray-600 overflow-hidden transition-all duration-300 group-hover:border-pink-500/50 group-hover:scale-110">
                          {player.image_url ? (
                            <img
                              src={player.image_url}
                              alt={player.name}
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
                            className="text-lg font-bold text-gray-200"
                            style={{ display: player.image_url ? 'none' : 'block' }}
                          >
                            {getPlayerInitials(player.name)}
                          </span>
                        </div>

                        {/* Indicateur de statut */}
                        {player.active && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}

                        {/* Overlay au hover */}
                        <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-white text-xs font-semibold">
                              {player.name}
                            </div>
                            {player.first_name && (
                              <div className="text-pink-400 text-xs">
                                {player.first_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Nom du joueur (visible par défaut) */}
                      <div className="mt-2 text-center">
                        <p className="text-white text-xs font-medium truncate">
                          {player.name}
                        </p>
                        {player.role && (
                          <p className="text-gray-400 text-xs truncate">
                            {player.role}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="text-gray-400 text-sm">Aucun joueur connu pour cette équipe</p>
                </div>
              )}
            </div>

            {/* Infos supplémentaires */}
            <div className="bg-gray-700/10 p-3 border-t border-gray-700">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>📅 {roster.players.length} joueur{roster.players.length !== 1 ? 's' : ''}</span>
                <span>🏆 {roster.players.filter(p => p.active).length} actif{roster.players.filter(p => p.active).length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tooltip global */}
      <PlayerTooltip
        player={hoveredPlayer?.player}
        isVisible={!!hoveredPlayer}
        position={hoveredPlayer?.position || { x: 0, y: 0 }}
      />

      {tournament.expected_roster.length === 0 && (
        <Card variant="outlined" className="p-8 text-center">
          <div className="space-y-4">
            <div className="text-6xl">👥</div>
            <p className="text-gray-400 text-lg">Aucune information d'équipe disponible</p>
            <p className="text-gray-500 text-sm">Les rosters apparaîtront ici une fois confirmés</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TeamsRosters;
