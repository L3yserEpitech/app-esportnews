const functions = require("firebase-functions");
require("firebase-functions/logger/compat");
const fetch = require("node-fetch");

exports.getActiveAds = functions
  .region("europe-west1")
  .https.onCall(async (_data, _context) => {
    try {
      const url =
        "https://x8ki-letl-twmt.n7.xano.io/api:kPvIg7bD/advertisements_active";

      const res = await fetch(url, {
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
      return json; // ✅ renvoie la liste JSON telle quelle
    } catch (err) {
      functions.logger.error("Erreur getActiveAds:", err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Erreur interne",
      );
    }
  });
