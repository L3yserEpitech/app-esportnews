/**
 * Utilitaires pour la gestion des erreurs
 */

const handleError = (reply, statusCode, message, logMessage = null) => {
  if (logMessage) {
    console.error(logMessage);
  }
  reply.code(statusCode);
  return { error: message };
};

const handleDatabaseError = (error) => {
  if (error.code === 'PGRST116') {
    return { statusCode: 404, message: 'Resource not found' };
  }
  return { statusCode: 500, message: 'Database error occurred' };
};

module.exports = {
  handleError,
  handleDatabaseError
};
