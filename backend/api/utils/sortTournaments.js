/**
 * Fonctions utilitaires pour trier les tournois
 */

const { TIER_PRIORITY } = require('../constants/games');

/**
 * Trie les tournois par tier et par date selon le statut
 */
const sortTournaments = (tournaments, status = 'running') => {
  return tournaments.sort((a, b) => {
    // D'abord par tier
    const tierDiff = TIER_PRIORITY[b.tier] - TIER_PRIORITY[a.tier];
    if (tierDiff !== 0) return tierDiff;

    // Puis par date selon le statut
    if (status === 'upcoming') {
      const dateA = new Date(a.begin_at);
      const dateB = new Date(b.begin_at);
      return dateA - dateB;
    } else if (status === 'finished') {
      const dateA = new Date(a.end_at || a.begin_at);
      const dateB = new Date(b.end_at || b.begin_at);
      return dateB - dateA;
    } else {
      // running: se termine plus tôt en premier
      if (!a.end_at && !b.end_at) return 0;
      if (!a.end_at) return 1;
      if (!b.end_at) return -1;
      const endDateA = new Date(a.end_at);
      const endDateB = new Date(b.end_at);
      return endDateA - endDateB;
    }
  });
};

module.exports = { sortTournaments };
