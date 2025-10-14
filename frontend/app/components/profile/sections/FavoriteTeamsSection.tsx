'use client';

import { Heart, Search } from 'lucide-react';

export default function FavoriteTeamsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Équipes Favorites</h2>
        <p className="text-gray-400">Suivez vos équipes préférées et recevez des notifications</p>
      </div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6">
        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une équipe..."
              className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#F22E62] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* État vide */}
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 mb-4">
            <Heart className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Aucune équipe favorite</h3>
          <p className="text-gray-400 mb-6">
            Commencez à suivre vos équipes préférées pour ne manquer aucun de leurs matchs
          </p>
          <button className="px-6 py-3 bg-[#F22E62] hover:bg-[#F22E62]/80 text-white font-medium rounded-lg transition-colors">
            Parcourir les équipes
          </button>
        </div>
      </div>
    </div>
  );
}
