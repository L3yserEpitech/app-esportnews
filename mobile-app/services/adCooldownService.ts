import AsyncStorage from '@react-native-async-storage/async-storage';

// =====================================================
// Configuration du cooldown publicitaire
// =====================================================
const COOLDOWN_DURATION = 5 * 60 * 1000; // 5 minutes en millisecondes
const STORAGE_KEY = '@ad_last_shown_timestamp';

/**
 * Service pour gérer le cooldown entre les affichages de publicités
 * Empêche l'affichage de pubs trop fréquent (minimum 5 minutes entre chaque)
 */
class AdCooldownService {
  /**
   * Vérifie si on peut afficher une publicité (cooldown respecté)
   * @returns {Promise<boolean>} true si le cooldown est passé, false sinon
   */
  async canShowAd(): Promise<boolean> {
    try {
      const lastShownStr = await AsyncStorage.getItem(STORAGE_KEY);

      if (!lastShownStr) {
        // Aucune pub affichée avant = OK
        return true;
      }

      const lastShown = parseInt(lastShownStr, 10);
      const now = Date.now();
      const timeSinceLastAd = now - lastShown;

      const canShow = timeSinceLastAd >= COOLDOWN_DURATION;

      if (!canShow) {
        const remainingSeconds = Math.ceil((COOLDOWN_DURATION - timeSinceLastAd) / 1000);
        console.log(`[AdCooldown] Cooldown actif - ${remainingSeconds}s restantes`);
      }

      return canShow;
    } catch (error) {
      console.error('[AdCooldown] Erreur lors de la vérification du cooldown:', error);
      // En cas d'erreur, on autorise l'affichage pour ne pas bloquer l'UX
      return true;
    }
  }

  /**
   * Enregistre le timestamp de la dernière pub affichée
   */
  async markAdShown(): Promise<void> {
    try {
      const now = Date.now();
      await AsyncStorage.setItem(STORAGE_KEY, now.toString());
      console.log('[AdCooldown] Timestamp de pub enregistré:', new Date(now).toLocaleTimeString());
    } catch (error) {
      console.error('[AdCooldown] Erreur lors de l\'enregistrement du timestamp:', error);
    }
  }

  /**
   * Réinitialise le cooldown (utile pour les tests ou le debug)
   */
  async resetCooldown(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[AdCooldown] Cooldown réinitialisé');
    } catch (error) {
      console.error('[AdCooldown] Erreur lors de la réinitialisation:', error);
    }
  }

  /**
   * Retourne le temps restant avant la prochaine pub (en secondes)
   * @returns {Promise<number>} Nombre de secondes restantes (0 si cooldown terminé)
   */
  async getRemainingCooldown(): Promise<number> {
    try {
      const lastShownStr = await AsyncStorage.getItem(STORAGE_KEY);

      if (!lastShownStr) {
        return 0;
      }

      const lastShown = parseInt(lastShownStr, 10);
      const now = Date.now();
      const timeSinceLastAd = now - lastShown;
      const remaining = COOLDOWN_DURATION - timeSinceLastAd;

      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    } catch (error) {
      console.error('[AdCooldown] Erreur lors du calcul du temps restant:', error);
      return 0;
    }
  }
}

// Export singleton
export const adCooldownService = new AdCooldownService();
export default adCooldownService;
