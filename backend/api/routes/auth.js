/**
 * Routes d'authentification
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { supabase } = require('../../src/config/supabase');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');
const { handleError } = require('../utils/errorHandler');

async function authRoutes(fastify) {
  // POST /api/auth/signup - Inscription
  fastify.post('/api/auth/signup', async (request, reply) => {
    try {
      const { email, password, name } = request.body;

      if (!email || !password || !name) {
        return handleError(reply, 400, 'Email, mot de passe et nom sont requis');
      }

      // Validation de l'email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return handleError(reply, 400, "Format d'email invalide");
      }

      // Validation du mot de passe
      if (password.length < 8) {
        return handleError(reply, 400, 'Le mot de passe doit contenir au moins 8 caractères');
      }

      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
      if (!passwordRegex.test(password)) {
        return handleError(reply, 400, 'Le mot de passe doit contenir au moins une lettre et un chiffre');
      }

      // Validation du nom
      if (name.length < 2 || name.length > 50) {
        return handleError(reply, 400, 'Le nom doit contenir entre 2 et 50 caractères');
      }

      console.log(`📝 Creating new user: ${email}`);

      // Vérifier si l'email existe déjà
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        console.log(`⚠️ User already exists: ${email}`);
        return handleError(reply, 400, 'Cet email est déjà utilisé');
      }

      // Hasher le mot de passe
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Créer l'utilisateur
      const { data: userData, error: userError } = await supabase
        .rpc('create_user', {
          p_email: email,
          p_name: name,
          p_password: hashedPassword
        })
        .single();

      if (userError) {
        console.error('❌ Error creating user record:', userError);
        return handleError(reply, 500, 'Erreur lors de la création du profil utilisateur');
      }

      // Générer un token JWT
      const token = jwt.sign(
        { userId: userData.id, email: userData.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log(`✅ User created successfully: ${email}`);

      // eslint-disable-next-line no-unused-vars
      const { password: _pwd, ...userWithoutPassword } = userData;

      return {
        authToken: token,
        user: userWithoutPassword
      };
    } catch (error) {
      console.error('❌ Error in /api/auth/signup:', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });

  // POST /api/auth/login - Connexion
  fastify.post('/api/auth/login', async (request, reply) => {
    try {
      const { email, password } = request.body;

      if (!email || !password) {
        return handleError(reply, 400, 'Email et mot de passe sont requis');
      }

      console.log(`🔐 User login attempt: ${email}`);

      // Récupérer l'utilisateur
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        console.error('❌ User not found:', email);
        return handleError(reply, 401, 'Email ou mot de passe incorrect');
      }

      // Vérifier le mot de passe
      const passwordMatch = await bcrypt.compare(password, userData.password);

      if (!passwordMatch) {
        console.error('❌ Invalid password for user:', email);
        return handleError(reply, 401, 'Email ou mot de passe incorrect');
      }

      // Générer un token JWT
      const token = jwt.sign(
        { userId: userData.id, email: userData.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log(`✅ User logged in successfully: ${email}`);

      // eslint-disable-next-line no-unused-vars
      const { password: _pwd, ...userWithoutPassword } = userData;

      return {
        authToken: token,
        user: userWithoutPassword
      };
    } catch (error) {
      console.error('❌ Error in /api/auth/login:', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });

  // GET /api/auth/me - Données utilisateur
  fastify.get('/api/auth/me', { preHandler: verifyToken }, async (request, reply) => {
    try {
      console.log(`👤 Fetching user data for: ${request.user.id}`);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', request.user.id)
        .single();

      if (error) {
        console.error('❌ Error fetching user:', error);
        return handleError(reply, 500, 'Erreur lors de la récupération des données utilisateur');
      }

      console.log('✅ User data fetched successfully');

      // eslint-disable-next-line no-unused-vars
      const { password: _pwd, ...userWithoutPassword } = data;
      return userWithoutPassword;
    } catch (error) {
      console.error('❌ Error in /api/auth/me:', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });

  // POST /api/auth/me - Mettre à jour le profil
  fastify.post('/api/auth/me', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const { name, email, password } = request.body;
      const userId = request.user.id;

      console.log(`📝 Updating user profile for: ${userId}`);

      const updates = {};

      if (name) updates.name = name;
      if (email) updates.email = email;

      if (password) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        updates.password = hashedPassword;
      }

      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          console.error('❌ Error updating user:', error);
          return handleError(reply, 500, 'Erreur lors de la mise à jour du profil');
        }

        console.log('✅ User profile updated successfully');

        // eslint-disable-next-line no-unused-vars
        const { password: _pwd, ...userWithoutPassword } = data;
        return userWithoutPassword;
      }

      // Retourner les données actuelles
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return handleError(reply, 500, 'Erreur lors de la récupération des données');
      }

      // eslint-disable-next-line no-unused-vars
      const { password: _pwd2, ...userWithoutPassword } = data;
      return userWithoutPassword;
    } catch (error) {
      console.error('❌ Error in /api/auth/me (update):', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });

  // POST /api/auth/avatar - Mettre à jour l'avatar
  fastify.post('/api/auth/avatar', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const { avatarUrl } = request.body;
      const userId = request.user.id;

      if (!avatarUrl) {
        return handleError(reply, 400, "URL de l'avatar requise");
      }

      console.log(`📸 Updating avatar URL for user ${userId}: ${avatarUrl}`);

      const { data: userData, error: updateError } = await supabase
        .from('users')
        .update({ avatar: avatarUrl })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating user avatar:', updateError);
        return handleError(reply, 500, 'Erreur lors de la mise à jour du profil');
      }

      console.log('✅ Avatar URL updated successfully');

      // eslint-disable-next-line no-unused-vars
      const { password: _pwd, ...userWithoutPassword } = userData;

      return userWithoutPassword;
    } catch (error) {
      console.error('❌ Error in /api/auth/avatar:', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });

  // DELETE /api/auth/avatar - Supprimer l'avatar
  fastify.delete('/api/auth/avatar', { preHandler: verifyToken }, async (request, reply) => {
    try {
      const userId = request.user.id;
      console.log(`🗑️ Deleting avatar for user: ${userId}`);

      const { data: currentUser, error: fetchError } = await supabase
        .from('users')
        .select('avatar')
        .eq('id', userId)
        .single();

      if (fetchError) {
        return handleError(reply, 500, 'Erreur lors de la récupération des données utilisateur');
      }

      if (currentUser.avatar) {
        const avatarPath = currentUser.avatar.split('/').slice(-2).join('/');

        const { error: deleteError } = await supabase.storage
          .from('profilePictureUsers')
          .remove([avatarPath]);

        if (deleteError) {
          console.error('⚠️ Error deleting from storage:', deleteError);
        }
      }

      const { data: userData, error: updateError } = await supabase
        .from('users')
        .update({ avatar: null })
        .eq('id', userId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating user:', updateError);
        return handleError(reply, 500, 'Erreur lors de la mise à jour du profil');
      }

      console.log('✅ Avatar deleted successfully');

      // eslint-disable-next-line no-unused-vars
      const { password: _pwd, ...userWithoutPassword } = userData;
      return userWithoutPassword;
    } catch (error) {
      console.error('❌ Error in /api/auth/avatar (delete):', error);
      return handleError(reply, 500, 'Erreur interne du serveur');
    }
  });
}

module.exports = authRoutes;
