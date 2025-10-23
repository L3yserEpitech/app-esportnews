/**
 * Routes pour les équipes (PandaScore)
 */

const { supabase } = require('../../src/config/supabase');
const { verifyToken } = require('../middleware/auth');
const { ALLOWED_GAME_SLUGS } = require('../constants/games');
const { handleError } = require('../utils/errorHandler');

async function teamsRoutes(fastify) {
  // GET /api/teams/search - Rechercher des équipes
  fastify.get('/api/teams/search', async (request, reply) => {
    try {
      const { query, page_size = 50 } = request.query;

      if (!query) {
        return handleError(reply, 400, 'Query parameter is required');
      }

      console.log(`🔍 Searching teams with query: ${query}`);

      const PANDASCORE_TOKEN = process.env.API_PANDASCORE;
      const url = `https://api.pandascore.co/teams?search[name]=${encodeURIComponent(query)}&page[size]=50`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${PANDASCORE_TOKEN}`
        }
      });

      if (!response.ok) {
        console.error('❌ Failed to search teams:', response.status);
        return handleError(reply, response.status, 'Failed to search teams');
      }

      const teams = await response.json();
      console.log(`✅ Found ${teams.length} teams matching "${query}"`);

      // Filtrer uniquement les équipes des jeux autorisés
      const filteredTeams = teams.filter(team => {
        const gameSlug = team.current_videogame?.slug;
        return gameSlug && ALLOWED_GAME_SLUGS.includes(gameSlug);
      });

      console.log(`🎮 Filtered to ${filteredTeams.length} teams from allowed games`);

      return filteredTeams.reverse();
    } catch (error) {
      console.error('❌ Error in /api/teams/search:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/users/favorite-teams/ids - IDs des équipes favorites
  fastify.get('/api/users/favorite-teams/ids', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = request.user.id;
      console.log(`⭐ Fetching favorite team IDs for user: ${userId}`);

      const { data, error } = await supabase
        .from('users')
        .select('favorite_teams')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching favorite teams:', error);
        return handleError(reply, 500, 'Failed to fetch favorite teams');
      }

      const favoriteTeamIds = data?.favorite_teams || [];
      console.log(`✅ User has ${favoriteTeamIds.length} favorite teams`);

      return favoriteTeamIds;
    } catch (error) {
      console.error('❌ Error in /api/users/favorite-teams/ids:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/users/favorite-teams - Détails des équipes favorites
  fastify.get('/api/users/favorite-teams', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = request.user.id;
      console.log(`⭐ Fetching favorite teams details for user: ${userId}`);

      const { data, error } = await supabase
        .from('users')
        .select('favorite_teams')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching favorite teams:', error);
        return handleError(reply, 500, 'Failed to fetch favorite teams');
      }

      const favoriteTeamIds = data?.favorite_teams || [];

      if (favoriteTeamIds.length === 0) {
        console.log('✅ No favorite teams found');
        return [];
      }

      const PANDASCORE_TOKEN = process.env.API_PANDASCORE;

      const teamPromises = favoriteTeamIds.map(async (teamId) => {
        try {
          const response = await fetch(
            `https://api.pandascore.co/teams/${teamId}`,
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${PANDASCORE_TOKEN}`
              }
            }
          );

          if (!response.ok) {
            console.error(`❌ Failed to fetch team ${teamId}:`, response.status);
            return null;
          }

          const team = await response.json();
          return team;
        } catch (err) {
          console.error(`❌ Error fetching team ${teamId}:`, err);
          return null;
        }
      });

      const teams = await Promise.all(teamPromises);
      const validTeams = teams.filter(team => team !== null);

      console.log(`✅ Successfully fetched ${validTeams.length} favorite teams`);
      return validTeams;
    } catch (error) {
      console.error('❌ Error in /api/users/favorite-teams:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // POST /api/users/favorite-teams/:teamId - Ajouter une équipe aux favorites
  fastify.post('/api/users/favorite-teams/:teamId', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const { teamId } = request.params;
      const teamIdInt = parseInt(teamId);

      if (isNaN(teamIdInt)) {
        return handleError(reply, 400, 'Invalid team ID');
      }

      console.log(`⭐ Adding team ${teamIdInt} to favorites for user: ${userId}`);

      const { data: currentData, error: fetchError } = await supabase
        .from('users')
        .select('favorite_teams')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching current favorite teams:', fetchError);
        return handleError(reply, 500, 'Failed to fetch current favorite teams');
      }

      const currentFavorites = currentData?.favorite_teams || [];

      if (currentFavorites.includes(teamIdInt)) {
        return handleError(reply, 400, 'Team already in favorites');
      }

      const updatedFavorites = [...currentFavorites, teamIdInt];

      const { error } = await supabase
        .from('users')
        .update({ favorite_teams: updatedFavorites })
        .eq('id', userId);

      if (error) {
        console.error('❌ Error updating favorite teams:', error);
        return handleError(reply, 500, 'Failed to update favorite teams');
      }

      console.log(`✅ Successfully added team ${teamIdInt} to favorites`);
      return { success: true, favorite_teams: updatedFavorites };
    } catch (error) {
      console.error('❌ Error in /api/users/favorite-teams (add):', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // DELETE /api/users/favorite-teams/:teamId - Retirer une équipe des favorites
  fastify.delete('/api/users/favorite-teams/:teamId', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const { teamId } = request.params;
      const teamIdInt = parseInt(teamId);

      if (isNaN(teamIdInt)) {
        return handleError(reply, 400, 'Invalid team ID');
      }

      console.log(`⭐ Removing team ${teamIdInt} from favorites for user: ${userId}`);

      const { data: currentData, error: fetchError } = await supabase
        .from('users')
        .select('favorite_teams')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('❌ Error fetching current favorite teams:', fetchError);
        return handleError(reply, 500, 'Failed to fetch current favorite teams');
      }

      const currentFavorites = currentData?.favorite_teams || [];

      const updatedFavorites = currentFavorites.filter((id) => id !== teamIdInt);

      const { error } = await supabase
        .from('users')
        .update({ favorite_teams: updatedFavorites })
        .eq('id', userId);

      if (error) {
        console.error('❌ Error updating favorite teams:', error);
        return handleError(reply, 500, 'Failed to update favorite teams');
      }

      console.log(`✅ Successfully removed team ${teamIdInt} from favorites`);
      return { success: true, favorite_teams: updatedFavorites };
    } catch (error) {
      console.error('❌ Error in /api/users/favorite-teams (remove):', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });
}

module.exports = teamsRoutes;
