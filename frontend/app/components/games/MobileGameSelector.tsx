'use client';

import { useState, useEffect } from 'react';
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

        {/* Games grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {games.map((game) => {
              const selected = selectedGame === game.id.toString();

              return (
                <button
                  key={game.id}
                  onClick={() => selectGame(game.id.toString())}
                  className={`
                    relative overflow-hidden rounded-xl transition-all duration-300 ease-out
                    focus:outline-none group cursor-pointer aspect-[3/4]
                    ${selected
                      ? 'ring-3 ring-pink-400/80 shadow-xl shadow-pink-500/30 scale-105'
                      : 'hover:ring-2 hover:ring-pink-300/60 hover:scale-105 hover:shadow-lg'
                    }
                  `}
                  style={{
                    filter: selected ? 'brightness(1.15) saturate(1.3)' : 'brightness(0.85) saturate(0.75)',
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
                      src={selected ? game.selected_image.url : game.unselected_image.url}
                      alt={`Logo ${game.name}`}
                      className="w-full h-full object-cover transition-all duration-300 group-hover:scale-110"
                      loading="lazy"
                    />

                    {/* Overlay gradient */}
                    <div className={`
                      absolute inset-0 transition-all duration-300
                      ${selected
                        ? 'bg-gradient-to-t from-pink-900/50 via-purple-900/20 to-transparent'
                        : 'bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100'
                      }
                    `} />

                    {/* Badge de sélection */}
                    {selected && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-gradient-to-br from-pink-400 to-pink-600 rounded-full flex items-center justify-center shadow-lg border border-white/30">
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}

                    {/* Texte */}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <span className={`
                        block text-xs font-bold text-center transition-all duration-300
                        ${selected
                          ? 'text-white drop-shadow-lg scale-105'
                          : 'text-white/90 group-hover:text-white group-hover:scale-105'
                        }
                        backdrop-blur-md bg-black/50 rounded-md px-2 py-1 border border-white/20
                      `}>
                        {game.name}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Option pour désélectionner */}
          {selectedGame && (
            <button
              onClick={() => {
                onSelectionChange(null);
                onClose();
              }}
              className="w-full mt-4 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
            >
              Voir tous les jeux
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileGameSelector;