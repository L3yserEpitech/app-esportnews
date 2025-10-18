'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Star } from 'lucide-react';
import { Team } from '@/app/services/teamService';
import Image from 'next/image';

interface TeamSearchResultProps {
  team: Team;
  isFavorite?: boolean;
  onToggleFavorite?: (teamId: number) => void;
  isLoading?: boolean;
}

export default function TeamSearchResult({
  team,
  isFavorite = false,
  onToggleFavorite,
  isLoading = false
}: TeamSearchResultProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite && !isLoading) {
      onToggleFavorite(team.id);
    }
  };

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden bg-white/5 hover:bg-white/10 transition-all">
      {/* En-tête cliquable */}
      <div className="p-4 flex items-center gap-4">
        <div
          className="flex-1 flex items-center gap-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Logo de l'équipe */}
          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
            {team.image_url ? (
              <Image
                src={team.image_url}
                alt={team.name}
                width={48}
                height={48}
                className="object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                {team.acronym || team.name.substring(0, 3).toUpperCase()}
              </div>
            )}
          </div>

          {/* Informations de l'équipe */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-semibold truncate">{team.name}</h3>
              {team.acronym && (
                <span className="text-xs text-gray-400 font-mono">[{team.acronym}]</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              {team.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>{team.location}</span>
                </div>
              )}
              {team.current_videogame && (
                <span className="text-xs px-2 py-0.5 bg-white/5 rounded">
                  {team.current_videogame.name}
                </span>
              )}
            </div>
          </div>

          {/* Icône d'expansion */}
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Bouton étoile */}
        {onToggleFavorite && (
          <button
            onClick={handleStarClick}
            disabled={isLoading}
            className={`p-2 rounded-lg transition-all ${
              isFavorite
                ? 'bg-[#F22E62] text-white hover:bg-[#F22E62]/80'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-[#F22E62]'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Star
              className="w-5 h-5"
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </button>
        )}
      </div>

      {/* Détails expandables */}
      {isExpanded && (
        <div className="border-t border-white/10 p-4 bg-black/20">
          <h4 className="text-sm font-semibold text-white mb-3">Joueurs</h4>
          {team.players && team.players.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {team.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 p-2 bg-white/5 rounded-lg"
                >
                  {/* Avatar du joueur */}
                  <div className="w-10 h-10 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                    {player.image_url ? (
                      <Image
                        src={player.image_url}
                        alt={player.name}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                        {player.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Infos joueur */}
                  <div className="flex-1 min-w-0 max-w-[200px]">
                    <div className="text-white font-medium text-sm truncate">
                      {player.name}
                    </div>
                    <div className="text-xs text-gray-400 flex items-center gap-2">
                      {player.first_name && player.last_name && (
                        <span className="truncate">
                          {player.first_name} {player.last_name}
                        </span>
                      )}
                      {player.nationality && (
                        <span className="text-gray-500 flex-shrink-0">• {player.nationality}</span>
                      )}
                    </div>
                  </div>

                  {/* Age */}
                  {player.age && (
                    <div className="text-xs text-gray-400 flex-shrink-0">
                      {player.age} ans
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Aucun joueur disponible</p>
          )}

          {/* Informations supplémentaires */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {team.slug && (
                <div>
                  <span className="text-gray-400">Slug:</span>
                  <span className="text-white ml-2 font-mono">{team.slug}</span>
                </div>
              )}
              {team.modified_at && (
                <div>
                  <span className="text-gray-400">Dernière MAJ:</span>
                  <span className="text-white ml-2">
                    {new Date(team.modified_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
