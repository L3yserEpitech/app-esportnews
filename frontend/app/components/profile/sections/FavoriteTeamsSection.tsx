'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { teamService, Team } from '@/app/services/teamService';
import TeamSearchResult from '../TeamSearchResult';

export default function FavoriteTeamsSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Team[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        {searchQuery.trim().length >= 2 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              Résultats de recherche ({searchResults.length})
            </h3>
            {searchResults.length > 0 ? (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {searchResults.map((team) => (
                  <TeamSearchResult key={team.id} team={team} />
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
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400">
              Recherchez une équipe pour voir les résultats
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
