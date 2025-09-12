const functions = require("firebase-functions");
require("firebase-functions/logger/compat");
const fetch = require("node-fetch");

// ton token SportDevs
const API_KEY = "Bearer 7KwP-8CB10mnytro5OinZA";

exports.getLiveMatches = functions
  .region("europe-west1")
  .https.onCall(async (_data, _context) => {
    try {
      const url = "https://esports.sportdevs.com/matches?status_type=eq.live";
      functions.logger.info("Requête SportDevs:", url);

      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: API_KEY,
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new functions.https.HttpsError(
          "internal",
          `SportDevs ${res.status}: ${body || "Pas de réponse"}`,
        );
      }

      const json = await res.json();
      return json; // retourne tel quel la réponse SportDevs
    } catch (err) {
      functions.logger.error(err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Erreur interne",
      );
    }
  });
