import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gameService } from '@/services';
import { Game } from '@/types';

interface GameContextType {
  games: Game[];
  selectedGame: Game | null;
  isLoadingGames: boolean;
  setSelectedGame: (game: Game | null) => Promise<void>;
  getGameByAcronym: (acronym: string) => Game | undefined;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const SELECTED_GAME_KEY = 'selectedGame';

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGameState] = useState<Game | null>(null);
  const [isLoadingGames, setIsLoadingGames] = useState(true);

  // Load games and selected game on mount
  useEffect(() => {
    const initGames = async () => {
      try {
        // Fetch games from API
        const gamesData = await gameService.getGames();
        setGames(gamesData);

        // Restore selected game from AsyncStorage
        const savedGameAcronym = await AsyncStorage.getItem(SELECTED_GAME_KEY);
        if (savedGameAcronym) {
          const savedGame = gamesData.find(g => g.acronym === savedGameAcronym);
          if (savedGame) {
            setSelectedGameState(savedGame);
          }
        }
        // If no saved selection, default state remains null as initialized
      } catch (error) {
        console.error('GameContext.initGames error:', error);
      } finally {
        setIsLoadingGames(false);
      }
    };

    initGames();
  }, []);

  const setSelectedGame = async (game: Game | null) => {
    setSelectedGameState(game);

    if (game) {
      await AsyncStorage.setItem(SELECTED_GAME_KEY, game.acronym);
    } else {
      await AsyncStorage.removeItem(SELECTED_GAME_KEY);
    }
  };

  const handleGameSelect = (game: Game) => {
    if (selectedGame?.id === game.id) {
      setSelectedGame(null);
    } else {
      setSelectedGame(game);
    }
  };

  const getGameByAcronym = (acronym: string): Game | undefined => {
    return games.find(g => g.acronym === acronym);
  };

  return (
    <GameContext.Provider
      value={{
        games,
        selectedGame,
        isLoadingGames,
        setSelectedGame,
        getGameByAcronym,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export default GameContext;
