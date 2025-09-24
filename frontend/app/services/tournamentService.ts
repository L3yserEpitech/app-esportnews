import { PandaTournament } from '../types';

class TournamentService {
  async getAllRunningTournaments(): Promise<PandaTournament[]> {
    try {
      // Appeler le backend Fastify pour tous les jeux
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

      console.log('🌐 Frontend received ALL tournaments:', {
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

  async getRunningTournaments(gameAcronym: string): Promise<PandaTournament[]> {
    try {
      // Appeler le backend Fastify
      const response = await fetch(`http://localhost:4343/api/tournaments?game=${encodeURIComponent(gameAcronym)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add cache control for better performance
        cache: 'no-store', // Don't cache running tournaments as they change frequently
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const tournaments: PandaTournament[] = await response.json();

      console.log(`🎮 Frontend received for ${gameAcronym}:`, {
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
}

export const tournamentService = new TournamentService();