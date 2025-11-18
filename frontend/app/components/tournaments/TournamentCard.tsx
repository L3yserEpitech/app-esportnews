'use client';

import { useTranslations } from 'next-intl';
import { PandaTournament } from '../../types';
import { esportBackgrounds } from '../../constants/images';

interface TournamentCardProps {
  tournament: PandaTournament;
  showGameBadge?: boolean; // Afficher le badge du jeu quand on montre tous les jeux
}

const getTierColor = (tier: string | null | undefined): string => {
  if (!tier) return 'bg-[var(--color-tier-d)]';
  switch (tier.toLowerCase()) {
    case 's': return 'bg-[var(--color-tier-s)]';
    case 'a': return 'bg-[var(--color-tier-a)]';
    case 'b': return 'bg-[var(--color-tier-b)]';
    case 'c': return 'bg-[var(--color-tier-c)]';
    case 'd': return 'bg-[var(--color-tier-d)]';
    default: return 'bg-[var(--color-tier-d)]';
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

const formatPrizepool = (prizepool: string | null | undefined): string | null => {
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
  const t = useTranslations();
  // Utiliser l'ID du tournoi pour sélectionner une image de manière déterministe
  const backgroundImage = esportBackgrounds[tournament.id % esportBackgrounds.length];

  const prizepool = formatPrizepool(tournament.prizepool);

  return (
    <a
      href={`/tournois/${tournament.id}`}
      className="group relative overflow-hidden rounded-xl transition-all duration-300 cursor-pointer block"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderWidth: '1px',
        borderColor: 'var(--color-border-secondary)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
      }}
    >
      {/* Image de fond avec overlay */}
      <div className="relative h-48 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to top, var(--color-bg-primary) 0%, rgba(var(--color-primary-800-rgb), 0.6) 50%, transparent 100%)'
          }}
        />

        {/* Badge tier */}
        <div className="absolute top-4 left-4 flex gap-2">
          {tournament.tier && (
            <span className={`px-2 py-1 rounded-full text-xs font-bold text-white uppercase ${getTierColor(tournament.tier)}`}>
              {t('pages.home.tournaments.tier_label')} {tournament.tier.toUpperCase()}
            </span>
          )}
          {!showGameBadge && tournament.videogame?.slug && (
            <span className="px-2 py-1 bg-pink-600 text-white text-xs font-bold rounded-full uppercase shadow-lg">
              {tournament.videogame.slug.toUpperCase()}
            </span>
          )}
          {showGameBadge && tournament.videogame?.slug && (
            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full uppercase">
              {tournament.videogame.slug.toUpperCase()}
            </span>
          )}
        </div>

        {/* Badge live si le tournoi est en cours */}
        {tournament.begin_at && tournament.end_at &&
         new Date(tournament.begin_at) <= new Date() &&
         new Date(tournament.end_at) > new Date() && (
          <div className="absolute top-4 right-4">
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full uppercase animate-pulse">
              {t('pages.home.tournaments.live_badge')}
            </span>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-4">
        {/* Titre du tournoi */}
        <h3 className="text-lg font-semibold text-text-primary mb-2 line-clamp-2 group-hover:text-accent transition-colors">
          {tournament.name}
        </h3>

        {/* Informations de la ligue */}
        {tournament.league && (
          <div className="flex items-center mb-2">
            {tournament.league.image_url && (
              <img
                src={tournament.league.image_url}
                alt={tournament.league.name}
                className="w-6 h-6 rounded mr-2"
              />
            )}
            <span className="text-text-secondary text-sm">{tournament.league.name}</span>
          </div>
        )}

        {/* Dates */}
        <div className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
          <div>{t('pages.home.tournaments.begin_label')} {formatDate(tournament.begin_at)}</div>
          {tournament.end_at && (
            <div>{t('pages.home.tournaments.end_label')} {formatDate(tournament.end_at)}</div>
          )}
        </div>

        {/* Prizepool et équipes */}
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            {prizepool && (
              <span className="font-semibold text-sm" style={{ color: 'var(--color-success)' }}>
                💰 {prizepool}
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {tournament.teams?.length || 0} {t('pages.home.tournaments.team_count')}
            </span>
          </div>

          {/* Indicateur de matchs */}
          <div className="text-xs text-right" style={{ color: 'var(--color-text-secondary)' }}>
            <div>{tournament.matches?.length || 0} {t('pages.home.tournaments.match_count')}</div>
            <div style={{ color: 'var(--color-accent)' }}>
              {tournament.matches?.filter(m => m.status === 'not_started').length || 0} {t('pages.home.tournaments.upcoming_count')}
            </div>
          </div>
        </div>

        {/* Region */}
        <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-border-secondary)' }}>
          <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            {tournament.region}
          </span>
        </div>
      </div>

      {/* Hover effect overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-600))',
          opacity: 0,
        }}
      />
    </a>
  );
};

export default TournamentCard;