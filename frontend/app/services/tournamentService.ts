import { PandaTournament, PandaMatch } from '../types';

export interface TournamentFiltersType {
  tiers: string[];
}

class TournamentService {
  // Tournois à une date précise
  async getTournamentsByDate(date: string, game?: string): Promise<PandaTournament[]> {
    try {
      const params = new URLSearchParams();
      params.set('date', date);
      if (game) {
        params.set('game', game);
      }

      const response = await fetch(`http://localhost:4343/api/tournaments/by-date?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log(`📅 Frontend received tournaments for date ${date}:`, {
        game: game || 'ALL',
        date,
        count: tournaments.length,
        tournaments: tournaments.map(t => ({
          id: t.id,
          name: t.name,
          begin_at: t.begin_at,
          end_at: t.end_at,
          tier: t.tier
        }))
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching tournaments by date:', error);
      return [];
    }
  }

  // Matchs à une date précise
  async getMatchesByDate(date: string, game?: string): Promise<PandaMatch[]> {
    try {
      const params = new URLSearchParams();
      params.set('date', date);
      if (game) {
        params.set('game', game);
      }

      const response = await fetch(`http://localhost:4343/api/matches/by-date?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const matches: PandaMatch[] = await response.json();

      console.log(`⚔️ Frontend received matches for date ${date}:`, {
        game: game || 'ALL',
        date,
        count: matches.length,
        matches: matches.map(m => ({
          id: m.id,
          name: m.name,
          begin_at: m.begin_at,
          status: m.status,
          tournament_id: m.tournament_id
        }))
      });

      return matches;
    } catch (error) {
      console.error('Error fetching matches by date:', error);
      return [];
    }
  }

  // Nouvelle méthode pour récupérer les tournois avec filtres
  async getFilteredTournaments(
    status: 'running' | 'upcoming' | 'finished' = 'running',
    gameAcronym?: string,
    filters?: TournamentFiltersType
  ): Promise<PandaTournament[]> {
    try {
      const params = new URLSearchParams();

      // Paramètres de base
      if (gameAcronym) {
        params.append('game', gameAcronym);
      }
      params.append('status', status);

      // Filtres
      if (filters) {
        // Filtres par tier
        if (filters.tiers.length > 0) {
          filters.tiers.forEach(tier => {
            params.append('filter[tier]', tier);
          });
        }
      }

      const response = await fetch(`http://localhost:4343/api/tournaments/filtered?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log(`🎯 Frontend received filtered tournaments:`, {
        status,
        game: gameAcronym || 'ALL',
        filters,
        count: tournaments.length,
        byTier: tournaments.reduce((acc, t) => {
          acc[t.tier] = (acc[t.tier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching filtered tournaments:', error);
      throw error;
    }
  }
  // Tournois en cours - tous jeux
  async getAllRunningTournaments(): Promise<PandaTournament[]> {
    try {
      const response = await fetch('http://localhost:4343/api/tournaments/all', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log('🌐 Frontend received ALL running tournaments:', {
        count: tournaments.length,
        byGame: tournaments.reduce((acc, t) => {
          const game = t.gameSlug || 'unknown';
          acc[game] = (acc[game] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byTier: tournaments.reduce((acc, t) => {
          acc[t.tier] = (acc[t.tier] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching all running tournaments:', error);
      throw error;
    }
  }

  // Tournois en cours - jeu spécifique
  async getRunningTournaments(gameAcronym: string): Promise<PandaTournament[]> {
    try {
      const response = await fetch(`http://localhost:4343/api/tournaments?game=${encodeURIComponent(gameAcronym)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log(`🎮 Frontend received running tournaments for ${gameAcronym}:`, {
        count: tournaments.length,
        tournaments: tournaments.map(t => ({
          id: t.id,
          name: t.name,
          tier: t.tier,
          league: t.league?.name,
          prizepool: t.prizepool,
          teams: t.teams?.length || 0,
          matches: t.matches?.length || 0
        }))
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching running tournaments:', error);
      throw error;
    }
  }

  // Tournois à venir - tous jeux
  async getAllUpcomingTournaments(): Promise<PandaTournament[]> {
    try {
      const response = await fetch('http://localhost:4343/api/tournaments/upcoming/all', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log('🌐 Frontend received ALL upcoming tournaments:', {
        count: tournaments.length
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching all upcoming tournaments:', error);
      throw error;
    }
  }

  // Tournois à venir - jeu spécifique
  async getUpcomingTournaments(gameAcronym: string): Promise<PandaTournament[]> {
    try {
      const response = await fetch(`http://localhost:4343/api/tournaments/upcoming?game=${encodeURIComponent(gameAcronym)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log(`🎮 Frontend received upcoming tournaments for ${gameAcronym}:`, {
        count: tournaments.length
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching upcoming tournaments:', error);
      throw error;
    }
  }

  // Tournois passés - tous jeux
  async getAllFinishedTournaments(): Promise<PandaTournament[]> {
    try {
      const response = await fetch('http://localhost:4343/api/tournaments/finished/all', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log('🌐 Frontend received ALL finished tournaments:', {
        count: tournaments.length
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching all finished tournaments:', error);
      throw error;
    }
  }

  // Tournois passés - jeu spécifique
  async getFinishedTournaments(gameAcronym: string): Promise<PandaTournament[]> {
    try {
      const response = await fetch(`http://localhost:4343/api/tournaments/finished?game=${encodeURIComponent(gameAcronym)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log(`🎮 Frontend received finished tournaments for ${gameAcronym}:`, {
        count: tournaments.length
      });

      return tournaments;
    } catch (error) {
      console.error('Error fetching finished tournaments:', error);
      throw error;
    }
  }
}

export const tournamentService = new TournamentService();