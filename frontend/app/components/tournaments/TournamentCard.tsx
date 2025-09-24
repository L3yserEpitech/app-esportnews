'use client';

import { PandaTournament } from '../../types';

interface TournamentCardProps {
  tournament: PandaTournament;
  showGameBadge?: boolean; // Afficher le badge du jeu quand on montre tous les jeux
}

// Images de fond esport gratuites et de qualité
const esportBackgrounds = [
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // Gaming setup avec éclairage
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // Stadium esport
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // Gaming tournoi
  'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // Setup gaming
  'https://images.unsplash.com/photo-1556438064-2d7646166914?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // Compétition
  'https://images.unsplash.com/photo-1606430946648-c4f3d8654b2f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', // Gaming arena
];

const getTierColor = (tier: string) => {
  switch (tier.toLowerCase()) {
    case 's': return 'bg-yellow-500';
    case 'a': return 'bg-blue-500';
    case 'b': return 'bg-green-500';
    case 'c': return 'bg-purple-500';
    case 'd': return 'bg-gray-500';
    default: return 'bg-gray-500';
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const formatPrizepool = (prizepool: string | null) => {
  if (!prizepool) return null;

  // Si c'est un nombre, le formater
  const num = parseFloat(prizepool);
  if (!isNaN(num)) {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M€`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K€`;
    }
    return `${num}€`;
  }

  return prizepool;
};

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament, showGameBadge = false }) => {
  // Utiliser l'ID du tournoi pour sélectionner une image de manière déterministe
  const backgroundImage = esportBackgrounds[tournament.id % esportBackgrounds.length];

  const prizepool = formatPrizepool(tournament.prizepool);

  return (
    <div className="group relative overflow-hidden rounded-xl bg-gray-900 border border-gray-700 hover:border-pink-500 transition-all duration-300 cursor-pointer">
      {/* Image de fond avec overlay */}
      <div className="relative h-48 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />

        {/* Badge tier */}
        <div className="absolute top-4 left-4 flex gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-bold text-white uppercase ${getTierColor(tournament.tier)}`}>
            Tier {tournament.tier.toUpperCase()}
          </span>
          {showGameBadge && tournament.gameSlug && (
            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase">
              {tournament.gameSlug}
            </span>
          )}
        </div>

        {/* Badge live si le tournoi est actuel */}
        {tournament.end_at && new Date(tournament.end_at) > new Date() && (
          <div className="absolute top-4 right-4">
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full uppercase animate-pulse">
              En cours
            </span>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-4">
        {/* Titre du tournoi */}
        <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-pink-400 transition-colors">
          {tournament.name}
        </h3>

        {/* Informations de la ligue */}
        <div className="flex items-center mb-2">
          {tournament.league.image_url && (
            <img
              src={tournament.league.image_url}
              alt={tournament.league.name}
              className="w-6 h-6 rounded mr-2"
            />
          )}
          <span className="text-gray-400 text-sm">{tournament.league.name}</span>
        </div>

        {/* Dates */}
        <div className="text-gray-400 text-sm mb-3">
          <div>Début: {formatDate(tournament.begin_at)}</div>
          {tournament.end_at && (
            <div>Fin: {formatDate(tournament.end_at)}</div>
          )}
        </div>

        {/* Prizepool et équipes */}
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            {prizepool && (
              <span className="text-green-400 font-semibold text-sm">
                💰 {prizepool}
              </span>
            )}
            <span className="text-gray-400 text-xs">
              {tournament.teams.length} équipes
            </span>
          </div>

          {/* Indicateur de matchs */}
          <div className="text-gray-400 text-xs text-right">
            <div>{tournament.matches.length} matchs</div>
            <div className="text-pink-400">
              {tournament.matches.filter(m => m.status === 'not_started').length} à venir
            </div>
          </div>
        </div>

        {/* Region */}
        <div className="mt-2 pt-2 border-t border-gray-700">
          <span className="text-gray-500 text-xs uppercase tracking-wide">
            {tournament.region}
          </span>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div className="absolute inset-0 bg-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </div>
  );
};

export default TournamentCard;