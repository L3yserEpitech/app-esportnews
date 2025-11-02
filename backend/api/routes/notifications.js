/**
 * Routes pour les notifications
 */

const { supabase } = require('../../src/config/supabase');
const { verifyToken } = require('../middleware/auth');
const { handleError } = require('../utils/errorHandler');

async function notificationsRoutes(fastify) {
  // GET /api/notifications/preferences - Préférences de notifications
  fastify.get('/api/notifications/preferences', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = request.user.id;
      console.log(`🔔 Fetching notification preferences for user: ${userId}`);

      const { data, error } = await supabase
        .from('users')
        .select('notifi_push, notif_articles, notif_news, notif_matchs')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching notification preferences:', error);
        return handleError(reply, 500, 'Erreur lors de la récupération des préférences');
      }

      console.log('✅ Notification preferences fetched successfully');
      return {
        notifi_push: data.notifi_push || false,
        notif_articles: data.notif_articles || false,
        notif_news: data.notif_news || false,
        notif_matchs: data.notif_matchs || false
      };
    } catch (error) {
      console.error('❌ Error in /api/notifications/preferences:', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });

  // PATCH /api/notifications/preferences - Mettre à jour les préférences
  fastify.patch('/api/notifications/preferences', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const { notifi_push, notif_articles, notif_news, notif_matchs } = request.body;

      console.log(`🔔 Updating notification preferences for user: ${userId}`);

      const updates = {};
      if (typeof notifi_push === 'boolean') updates.notifi_push = notifi_push;
      if (typeof notif_articles === 'boolean') updates.notif_articles = notif_articles;
      if (typeof notif_news === 'boolean') updates.notif_news = notif_news;
      if (typeof notif_matchs === 'boolean') updates.notif_matchs = notif_matchs;

      if (Object.keys(updates).length === 0) {
        return handleError(reply, 400, 'Aucune préférence à mettre à jour');
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('notifi_push, notif_articles, notif_news, notif_matchs')
        .single();

      if (error) {
        console.error('❌ Error updating notification preferences:', error);
        return handleError(reply, 500, 'Erreur lors de la mise à jour des préférences');
      }

      console.log('✅ Notification preferences updated successfully');
      return {
        notifi_push: data.notifi_push || false,
        notif_articles: data.notif_articles || false,
        notif_news: data.notif_news || false,
        notif_matchs: data.notif_matchs || false
      };
    } catch (error) {
      console.error('❌ Error in /api/notifications/preferences (update):', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });

  // POST /api/notifications/:type/toggle - Basculer une préférence
  fastify.post('/api/notifications/:type/toggle', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = request.user.id;
      const { type } = request.params;
      const { enabled } = request.body;

      if (typeof enabled !== 'boolean') {
        return handleError(reply, 400, 'Le champ "enabled" doit être un booléen');
      }

      const validTypes = ['push', 'articles', 'news', 'matchs'];
      if (!validTypes.includes(type)) {
        return handleError(reply, 400, 'Type de notification invalide. Types valides: push, articles, news, matchs');
      }

      const columnName = type === 'push' ? 'notifi_push' : `notif_${type}`;
      console.log(`🔔 Toggling ${type} notification for user ${userId}: ${enabled}`);

      const { data, error } = await supabase
        .from('users')
        .update({ [columnName]: enabled })
        .eq('id', userId)
        .select('notifi_push, notif_articles, notif_news, notif_matchs')
        .single();

      if (error) {
        console.error('❌ Error toggling notification:', error);
        return handleError(reply, 500, 'Erreur lors de la mise à jour de la préférence');
      }

      console.log(`✅ ${type} notification toggled successfully`);
      return {
        notifi_push: data.notifi_push || false,
        notif_articles: data.notif_articles || false,
        notif_news: data.notif_news || false,
        notif_matchs: data.notif_matchs || false
      };
    } catch (error) {
      console.error('❌ Error in /api/notifications/:type/toggle:', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });
}

module.exports = notificationsRoutes;
