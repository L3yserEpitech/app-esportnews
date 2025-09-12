const functions = require("firebase-functions");
require("firebase-functions/logger/compat");
const fetch = require("node-fetch");

exports.getGamesSelection = functions
  .region("europe-west1")
  .https.onCall(async (_data, _context) => {
    try {
      const url = "https://x8ki-letl-twmt.n7.xano.io/api:Q_7SDD7T/game"; // ✅ corrigé

      const res = await fetch(url, {
        method: "GET", // explicite, même si GET est par défaut
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new functions.https.HttpsError(
          "internal",
          `Xano ${res.status}: ${text || "Pas de réponse"}`,
        );
      }

      const json = await res.json();
      return json; // ✅ renvoie directement la liste
    } catch (err) {
      functions.logger.error("Erreur getGamesSelection:", err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Erreur interne",
      );
    }
  });
