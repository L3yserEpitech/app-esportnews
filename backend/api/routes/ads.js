/**
 * Routes pour les publicités
 */

const { supabase } = require('../../src/config/supabase');
const { handleError } = require('../utils/errorHandler');

async function adsRoutes(fastify) {
  // GET /api/ads - Publicités
  fastify.get('/api/ads', async (_request, reply) => {
    try {
      console.log('📢 Fetching advertisements from Supabase');

      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('position', { ascending: true });

      if (error) {
        console.error('❌ Error fetching ads:', error);
        return handleError(reply, 500, 'Failed to fetch advertisements');
      }

      // Filtrer les publicités valides
      const validAds = data?.filter(ad => ad.url && ad.redirect_link) || [];

      console.log(`✅ Successfully fetched ${validAds.length} valid advertisements`);
      return validAds;
    } catch (error) {
      console.error('❌ Error in /api/ads:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });
}

module.exports = adsRoutes;
