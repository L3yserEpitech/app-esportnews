const functions = require("firebase-functions");
require("firebase-functions/logger/compat");
const fetch = require("node-fetch");

exports.getArticles = functions
  .region("europe-west1")
  .https.onCall(async (_data, _context) => {
    try {
      const url = "https://x8ki-letl-twmt.n7.xano.io/api:ORFNTr45/article_all";

      const res = await fetch(url, {
        method: "GET",
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
      return json;
    } catch (err) {
      functions.logger.error("Erreur getArticles:", err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Erreur interne",
      );
    }
  });
