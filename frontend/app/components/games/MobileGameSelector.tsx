'use client';

import { useEffect } from 'react';
import { Game } from '../../types';

interface MobileGameSelectorProps {
  games: Game[];
  selectedGame?: string | null;
  onSelectionChange: (gameId: string | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

const MobileGameSelector: React.FC<MobileGameSelectorProps> = ({
  games,
  selectedGame,
  onSelectionChange,
  isOpen,
  onClose
}) => {
  // Fermer le menu avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Empêcher le scroll du body quand le menu est ouvert
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const selectGame = (gameId: string) => {
    if (selectedGame === gameId) {
      onSelectionChange(null);
    } else {
      onSelectionChange(gameId);
    }
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-50 transition-opacity duration-500
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Slide menu */}
      <div className={`
        fixed top-0 right-0 h-screen w-full bg-[#060B13] z-50
        transform transition-transform duration-500 ease-out flex flex-col
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/40 h-20">
          <h2 className="text-lg font-semibold text-white">Sélectionner un jeu</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Games list */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-2">
            {games.length === 0 ? (
              // Skeletons pendant le chargement
              Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`mobile-skeleton-${index}`}
                  className="h-12 bg-gray-800/50 rounded-lg animate-pulse"
                >
                  <div className="flex items-center h-full px-4">
                    <div className="h-4 bg-gray-600/50 rounded w-20"></div>
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-shimmer"></div>
                  </div>
                </div>
              ))
            ) : (
              games.map((game) => {
              const selected = selectedGame === game.id.toString();

              return (
                <button
                  key={game.id}
                  onClick={() => selectGame(game.id.toString())}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ease-out
                    focus:outline-none relative overflow-hidden
                    ${selected
                      ? 'bg-gradient-to-r from-[#F22E62]/20 to-[#182859]/40 border border-[#F22E62]/30 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
                    }
                  `}
                  aria-pressed={selected}
                  aria-label={`${selected ? 'Désélectionner' : 'Sélectionner'} ${game.full_name}`}
                >
                  {/* Container moderne pour le jeu sélectionné */}
                  {selected && (
                    <>
                      {/* Bordure animée */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#F22E62]/10 via-[#182859]/20 to-[#F22E62]/10 rounded-lg" />
                      {/* Accent lumineux */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#F22E62] to-[#182859] rounded-l-lg" />
                      {/* Badge de sélection */}
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#F22E62] rounded-full animate-pulse" />
                    </>
                  )}

                  {/* Texte du jeu */}
                  <span className={`
                    relative z-10 font-medium transition-all duration-200
                    ${selected ? 'text-white font-semibold' : ''}
                  `}>
                    {game.full_name}
                  </span>
                </button>
              );
            })
            )}
          </div>

          {/* Option pour désélectionner */}
          {selectedGame && (
            <div className="mt-6 pt-4 border-t border-gray-700/40">
              <button
                onClick={() => {
                  onSelectionChange(null);
                  onClose();
                }}
                className="w-full px-4 py-3 bg-gray-800/60 hover:bg-gray-700/80 text-gray-300 hover:text-white rounded-lg transition-all duration-200 text-sm font-medium border border-gray-700/40 hover:border-gray-600/60"
              >
                Voir tous les jeux
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileGameSelector;