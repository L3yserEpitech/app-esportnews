'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Game } from '../types';
import { gameService } from '../services/gameService';

interface GameContextType {
  games: Game[];
  selectedGame: string | null;
  isLoadingGames: boolean;
  setSelectedGame: (gameId: string | null) => void;
  getSelectedGameData: () => Game | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGameState] = useState<string | null>(null);
  const [isLoadingGames, setIsLoadingGames] = useState(true);

  // Charger la sélection de jeu depuis localStorage au démarrage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedGame = localStorage.getItem('selectedGame');
      if (savedGame) {
        setSelectedGameState(savedGame);
      }
    }
  }, []);

  // Charger les jeux depuis l'API
  useEffect(() => {
    const loadGames = async () => {
      try {
        setIsLoadingGames(true);
        const fetchedGames = await gameService.getGames();
        setGames(fetchedGames);
      } catch (error) {
        console.error('Erreur lors du chargement des jeux:', error);
      } finally {
        setIsLoadingGames(false);
      }
    };

    loadGames();
  }, []);

  // Fonction pour changer la sélection de jeu
  const setSelectedGame = useCallback((gameId: string | null) => {
    setSelectedGameState(gameId);

    // Sauvegarder la sélection dans localStorage
    if (typeof window !== 'undefined') {
      if (gameId) {
        localStorage.setItem('selectedGame', gameId);
      } else {
        localStorage.removeItem('selectedGame');
      }
    }

    // Déclencher un événement personnalisé pour synchroniser entre les composants
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gameSelectionChange', {
        detail: { gameId }
      }));
    }
  }, []);

  // Écouter les changements de sélection de jeu depuis d'autres onglets/composants
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedGame') {
        setSelectedGameState(e.newValue);
      }
    };

    const handleGameSelectionChange = (e: CustomEvent) => {
      const { gameId } = e.detail;
      setSelectedGameState(gameId);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('gameSelectionChange', handleGameSelectionChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('gameSelectionChange', handleGameSelectionChange as EventListener);
    };
  }, []);

  // Fonction pour obtenir les données du jeu sélectionné
  const getSelectedGameData = useCallback((): Game | null => {
    if (!selectedGame || !games || games.length === 0) return null;
    return games.find(game => game.id.toString() === selectedGame) || null;
  }, [selectedGame, games]);

  const value: GameContextType = {
    games,
    selectedGame,
    isLoadingGames,
    setSelectedGame,
    getSelectedGameData,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

// Hook personnalisé pour utiliser le contexte
export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

export default GameContext;