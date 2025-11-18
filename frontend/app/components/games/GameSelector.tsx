'use client';

import { useState, useEffect, useCallback } from 'react';
import { Game } from '../../types';
import GameCardSkeleton from '../ui/GameCardSkeleton';

interface GameSelectorProps {
  games: Game[];
  selectedGame?: string | null;
  onSelectionChange: (gameId: string | null) => void;
  className?: string;
  isLoading?: boolean;
}

const GameSelector: React.FC<GameSelectorProps> = ({
  games,
  selectedGame,
  onSelectionChange,
  className = '',
  isLoading = false
}) => {
  const gamesList = games ?? [];
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Suppression de l'auto-sélection - l'utilisateur choisit manuellement

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Toujours visible en haut de page (premiers 100px)
      if (currentScrollY < 100) {
        setIsVisible(true);
      } else {
        // Différence de scroll pour détecter la direction
        const scrollDifference = Math.abs(currentScrollY - lastScrollY);

        // Cacher en scrollant vers le bas (avec seuil minimum de mouvement)
        if (currentScrollY > lastScrollY && currentScrollY > 200 && scrollDifference > 5) {
          setIsVisible(false);
        }
        // Montrer dès le moindre scroll vers le haut
        else if (currentScrollY < lastScrollY && scrollDifference > 1) {
          setIsVisible(true);
        }
      }

      setLastScrollY(currentScrollY);
    };

    // Throttle pour optimiser les performances
    let ticking = false;
    const throttledScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', throttledScroll);
    };
  }, [lastScrollY]);

  const selectGame = useCallback((gameId: string) => {
    // Si le jeu cliqué est déjà sélectionné, le désélectionner
    if (selectedGame === gameId) {
      onSelectionChange(null);
    } else {
      onSelectionChange(gameId);
    }
  }, [selectedGame, onSelectionChange]);

  const isSelected = useCallback((gameId: string) => selectedGame === gameId, [selectedGame]);

  return (
    <div className={`
      relative bg-bg-primary backdrop-blur-sm
      transition-transform duration-300 ease-in-out
      ${isVisible ? 'transform translate-y-0' : 'transform -translate-y-full'}
      ${className}
    `}>
      {/* Effet de lueur subtile */}
      <div className="absolute inset-0 bg-gradient-to-r from-pink-500/4 via-transparent to-pink-500/4" />

      <div className="container mx-auto ">
        <div className="flex items-center justify-center gap-1 overflow-x-auto scrollbar-hide py-4 px-4">
          {isLoading ? (
            // Afficher les skeletons pendant le chargement
            Array.from({ length: 10 }).map((_, index) => (
              <GameCardSkeleton key={`skeleton-${index}`} />
            ))
          ) : (
            gamesList.map((game) => {
              const selected = isSelected(game.id.toString());

              return (
                <button
                  key={game.id}
                  onClick={() => selectGame(game.id.toString())}
                  className={`
                    relative overflow-hidden rounded-xl transition-all duration-700 ease-out
                    whitespace-nowrap min-w-0 focus:outline-none group hover:z-10
                    transform-gpu will-change-transform cursor-pointer
                    ${selected
                      ? 'ring-4 ring-pink-400/80 shadow-2xl shadow-pink-500/40 scale-105 z-20'
                      : 'hover:ring-3 hover:ring-pink-300/60 hover:scale-105 hover:shadow-2xl hover:shadow-pink-400/30'
                    }
                    w-32 h-40 backdrop-blur-sm active:scale-95
                    hover:brightness-110 hover:saturate-125
                  `}
                  style={{
                    filter: selected ? 'brightness(1.15) saturate(1.3) drop-shadow(0 0 20px rgba(var(--accent-rgb), 0.6))' : 'brightness(0.85) saturate(0.75)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease-out',
                  }}
                  aria-pressed={selected}
                  aria-label={`${selected ? 'Désélectionner' : 'Sélectionner'} ${game.name}`}
                >
                  {/* Bordure animée pour le jeu sélectionné */}
                  {selected && (
                    <div className="absolute -inset-1 bg-gradient-to-r from-pink-400 via-purple-500 to-pink-400 rounded-xl" />
                  )}

                  {/* Container de l'image */}
                  <div className={`relative w-full h-full rounded-xl overflow-hidden ${selected ? 'z-10' : ''}`}>
                    <img
                      src={selected ? game.selected_image : game.unselected_image}
                      alt={`Logo ${game.name}`}
                      className="w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 group-active:scale-90"
                      loading="lazy"
                    />

                    {/* Overlay gradient amélioré */}
                    <div className={`
                      absolute inset-0 transition-all duration-700 ease-out
                      ${selected
                        ? 'bg-gradient-to-t from-pink-900/50 via-purple-900/20 to-transparent'
                        : 'bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100'
                      }
                    `} />

                    {/* Badge de sélection */}
                    {selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center shadow-xl border-2 border-white/30">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}

                    {/* Texte amélioré */}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <span className={`
                        block text-xs font-bold text-center transition-all duration-500 ease-out
                        ${selected
                          ? 'text-white drop-shadow-lg scale-110 font-extrabold'
                          : 'text-white/90 group-hover:text-white group-hover:scale-105 group-hover:font-extrabold'
                        }
                        backdrop-blur-md bg-black/50 rounded-lg px-3 py-1.5 border border-white/30
                        shadow-lg transform group-hover:shadow-xl
                      `}>
                        {game.name}
                      </span>
                    </div>

                    {/* Effet de brillance au hover */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 ease-out -skew-x-12 transform translate-x-full group-hover:translate-x-[-200%]" />

                  </div>
                </button>
              );
          })
          )}
        </div>
      </div>
    </div>
  );
};

export default GameSelector;