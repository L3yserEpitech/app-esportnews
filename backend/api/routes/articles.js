/**
 * Routes pour les articles
 */

const { supabase } = require('../../src/config/supabase');
const { handleDatabaseError, handleError } = require('../utils/errorHandler');

async function articleRoutes(fastify) {
  // GET /api/articles - Tous les articles
  fastify.get('/api/articles', async (_request, reply) => {
    try {
      console.log('📰 Fetching articles from Supabase');

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching articles:', error);
        return handleError(reply, 500, 'Failed to fetch articles');
      }

      console.log(`✅ Successfully fetched ${data.length} articles`);
      return data;
    } catch (error) {
      console.error('❌ Error in /api/articles:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/articles/:slug - Article par slug
  fastify.get('/api/articles/:slug', async (request, reply) => {
    try {
      const { slug } = request.params;
      console.log(`📰 Fetching article with slug: ${slug}`);

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`❌ Article not found with slug: ${slug}`);
          return handleError(reply, 404, 'Article not found');
        }
        console.error('❌ Error fetching article:', error);
        return handleError(reply, 500, 'Failed to fetch article');
      }

      console.log(`✅ Successfully fetched article: ${data.title}`);
      return data;
    } catch (error) {
      console.error('❌ Error in /api/articles/:slug:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });

  // GET /api/articles/:slug/similar - Articles similaires
  fastify.get('/api/articles/:slug/similar', async (request, reply) => {
    try {
      const { slug } = request.params;
      const { limit = 3 } = request.query;
      console.log(`🔗 Fetching similar articles for: ${slug}`);

      // Récupérer l'article courant
      const { data: currentArticle, error: currentError } = await supabase
        .from('articles')
        .select('tags')
        .eq('slug', slug)
        .single();

      if (currentError || !currentArticle) {
        console.log(`❌ Article not found with slug: ${slug}`);
        return handleError(reply, 404, 'Article not found');
      }

      // Récupérer tous les autres articles
      const { data: allArticles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .neq('slug', slug)
        .order('created_at', { ascending: false });

      if (articlesError) {
        console.error('❌ Error fetching articles:', articlesError);
        return handleError(reply, 500, 'Failed to fetch articles');
      }

      // Calculer la similarité
      const currentTags = currentArticle.tags || [];
      const articlesWithScore = allArticles
        .map(article => {
          const articleTags = article.tags || [];
          const commonTags = articleTags.filter(tag => currentTags.includes(tag));
          return {
            ...article,
            similarityScore: commonTags.length
          };
        })
        .filter(article => article.similarityScore > 0)
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, parseInt(limit));

      console.log(`✅ Found ${articlesWithScore.length} similar articles`);
      return articlesWithScore;
    } catch (error) {
      console.error('❌ Error in /api/articles/:slug/similar:', error);
      return handleError(reply, 500, 'Internal server error');
    }
  });
}

module.exports = articleRoutes;
