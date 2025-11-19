import { PandaTournament, PandaMatch } from '../types';

export interface TournamentFiltersType {
  tiers: string[];
}

class TournamentService {
  // Tournois à une date précise
  async getTournamentsByDate(date: string, game?: string): Promise<PandaTournament[]> {
    try {
      const body = new URLSearchParams();
      body.set('date', date);
      if (game) {
        body.set('game', game);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tournaments/by-date`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      return tournaments;
    } catch (error) {
      console.error('Error fetching tournaments by date:', error);
      return [];
    }
  }

  // Matchs à une date précise
  async getMatchesByDate(date: string, game?: string): Promise<PandaMatch[]> {
    try {
      const body = new URLSearchParams();
      body.set('date', date);
      if (game) {
        body.set('game', game);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/matches/by-date`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const matches: PandaMatch[] = await response.json();

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

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tournaments/filtered?${params.toString()}`, {
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

      return tournaments;
    } catch (error) {
      console.error('Error fetching filtered tournaments:', error);
      throw error;
    }
  }
  // Tournois en cours - tous jeux
  async getAllRunningTournaments(sort?: string): Promise<PandaTournament[]> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      let url = `${baseUrl}/api/tournaments/all`;

      if (sort) {
        url += `?sort=${encodeURIComponent(sort)}`;
      }

      const response = await fetch(url, {
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

      return tournaments;
    } catch (error) {
      console.error('Error fetching all running tournaments:', error);
      throw error;
    }
  }

  // Tournois en cours - jeu spécifique
  async getRunningTournaments(gameAcronym: string, sort?: string): Promise<PandaTournament[]> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      let url = `${baseUrl}/api/tournaments?game=${encodeURIComponent(gameAcronym)}`;

      if (sort) {
        url += `&sort=${encodeURIComponent(sort)}`;
      }

      const response = await fetch(url, {
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

      return tournaments;
    } catch (error) {
      console.error('Error fetching running tournaments:', error);
      throw error;
    }
  }

  // Tournois à venir - tous jeux
  async getAllUpcomingTournaments(): Promise<PandaTournament[]> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tournaments/upcoming/all`, {
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

      return tournaments;
    } catch (error) {
      console.error('Error fetching all upcoming tournaments:', error);
      throw error;
    }
  }

  // Tournois à venir - jeu spécifique
  async getUpcomingTournaments(gameAcronym: string): Promise<PandaTournament[]> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tournaments/upcoming?game=${encodeURIComponent(gameAcronym)}`, {
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

      return tournaments;
    } catch (error) {
      console.error('Error fetching upcoming tournaments:', error);
      throw error;
    }
  }

  // Tournois passés - tous jeux
  async getAllFinishedTournaments(): Promise<PandaTournament[]> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tournaments/finished/all`, {
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

      return tournaments;
    } catch (error) {
      console.error('Error fetching all finished tournaments:', error);
      throw error;
    }
  }

  // Tournois passés - jeu spécifique
  async getFinishedTournaments(gameAcronym: string): Promise<PandaTournament[]> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/tournaments/finished?game=${encodeURIComponent(gameAcronym)}`, {
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

      return tournaments;
    } catch (error) {
      console.error('Error fetching finished tournaments:', error);
      throw error;
    }
  }

  // Tournoi par ID
  async getTournamentById(id: string): Promise<PandaTournament> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const url = `${baseUrl}/api/tournaments/${id}`;
      console.log(`[TournamentService] 📡 GET ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      console.log(`[TournamentService] Response status: ${response.status}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournament: PandaTournament = await response.json();
      console.log(`[TournamentService] ✅ Tournament ${id} loaded:`, {
        id: tournament.id,
        name: tournament.name,
        matchesCount: tournament.matches?.length || 0,
        teamsCount: tournament.teams?.length || 0,
      });

      return tournament;
    } catch (error) {
      console.error(`[TournamentService] ❌ Error fetching tournament by ID ${id}:`, error);
      throw error;
    }
  }
}

export const tournamentService = new TournamentService();