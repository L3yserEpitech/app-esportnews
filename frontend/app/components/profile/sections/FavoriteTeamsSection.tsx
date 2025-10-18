'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, X, Heart } from 'lucide-react';
import { teamService, Team } from '@/app/services/teamService';
import TeamSearchResult from '../TeamSearchResult';

export default function FavoriteTeamsSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<Team[]>([]);
  const [favoriteTeamIds, setFavoriteTeamIds] = useState<number[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [loadingTeamId, setLoadingTeamId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Charger les équipes favorites au montage
  useEffect(() => {
    const loadFavoriteTeams = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          setIsLoadingFavorites(false);
          return;
        }

        // Récupérer les IDs d'abord
        const ids = await teamService.getFavoriteTeamIds(token);
        setFavoriteTeamIds(ids);

        // Récupérer les détails des équipes
        if (ids.length > 0) {
          const teams = await teamService.getFavoriteTeams(token);
          setFavoriteTeams(teams);
        }
      } catch (err) {
        console.error('Error loading favorite teams:', err);
        setError('Impossible de charger vos équipes favorites');
      } finally {
        setIsLoadingFavorites(false);
      }
    };

    loadFavoriteTeams();
  }, []);

  // Recherche d'équipes avec debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const results = await teamService.searchTeams(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching teams:', err);
        setError('Erreur lors de la recherche d\'équipes');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Vérifier si une équipe est favorite
  const isFavorite = useCallback(
    (teamId: number) => {
      return favoriteTeamIds.includes(teamId);
    },
    [favoriteTeamIds]
  );

  // Toggle favorite
  const handleToggleFavorite = async (teamId: number) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setError('Vous devez être connecté');
      return;
    }

    setLoadingTeamId(teamId);
    setError(null);

    try {
      let updatedIds: number[];

      if (isFavorite(teamId)) {
        // Retirer des favoris
        updatedIds = await teamService.removeFavoriteTeam(token, teamId);
        setFavoriteTeamIds(updatedIds);
        setFavoriteTeams(prev => prev.filter(team => team.id !== teamId));
      } else {
        // Ajouter aux favoris
        updatedIds = await teamService.addFavoriteTeam(token, teamId);
        setFavoriteTeamIds(updatedIds);

        // Récupérer les détails de l'équipe ajoutée
        const team = searchResults.find(t => t.id === teamId);
        if (team) {
          setFavoriteTeams(prev => [...prev, team]);
        }
      }
    } catch (err: any) {
      console.error('Error toggling favorite:', err);
      setError(err.message || 'Erreur lors de la modification des favoris');
    } finally {
      setLoadingTeamId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Équipes Favorites</h2>
        <p className="text-gray-400">Suivez vos équipes préférées et recevez des notifications</p>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <div className="text-red-500 text-sm flex-1">{error}</div>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barre de recherche */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une équipe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F22E62] focus:border-transparent transition-all"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Résultats de recherche */}
        {searchQuery.trim().length >= 2 && (
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              Résultats de recherche ({searchResults.length})
            </h3>
            {searchResults.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((team) => (
                  <TeamSearchResult
                    key={team.id}
                    team={team}
                    isFavorite={isFavorite(team.id)}
                    onToggleFavorite={handleToggleFavorite}
                    isLoading={loadingTeamId === team.id}
                  />
                ))}
              </div>
            ) : (
              !isSearching && (
                <p className="text-gray-400 text-sm py-4">
                  Aucune équipe trouvée pour &quot;{searchQuery}&quot;
                </p>
              )
            )}
          </div>
        )}

        {/* Mes équipes favorites */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Mes équipes favorites ({favoriteTeams.length})
          </h3>

          {isLoadingFavorites ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#F22E62] animate-spin" />
            </div>
          ) : favoriteTeams.length > 0 ? (
            <div className="space-y-2">
              {favoriteTeams.map((team) => (
                <TeamSearchResult
                  key={team.id}
                  team={team}
                  isFavorite={true}
                  onToggleFavorite={handleToggleFavorite}
                  isLoading={loadingTeamId === team.id}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-4">
                <Heart className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Aucune équipe favorite</h3>
              <p className="text-gray-400 mb-6">
                Utilisez la barre de recherche ci-dessus pour trouver et ajouter vos équipes préférées
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
