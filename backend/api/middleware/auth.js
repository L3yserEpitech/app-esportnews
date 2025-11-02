/**
 * Middleware d'authentification
 */

const jwt = require('jsonwebtoken');
const { supabase } = require('../../src/config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

const verifyToken = async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401);
      return reply.send({ error: 'Token manquant ou invalide' });
    }

    const token = authHeader.substring(7);

    // Vérifier le token JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Récupérer l'utilisateur depuis la base de données
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      reply.code(401);
      return reply.send({ error: 'Token invalide ou expiré' });
    }

    // Ajouter l'utilisateur à la requête
    request.user = user;
  } catch (error) {
    console.error('❌ Error verifying token:', error);
    reply.code(401);
    return reply.send({ error: 'Token invalide ou expiré' });
  }
};

module.exports = {
  verifyToken,
  JWT_SECRET
};
