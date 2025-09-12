const functions = require("firebase-functions");
require("firebase-functions/logger/compat");
const fetch = require("node-fetch");

const API_KEY = "Bearer rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk";
const PROXY_URL =
  "https://europe-west1-esportnews-96de4.cloudfunctions.net/imageProxy";
const GET_UPCOMING_URL =
  "https://europe-west1-esportnews-96de4.cloudfunctions.net/getUpcommingEvents";

const proxyify = (url) =>
  url ? `${PROXY_URL}?url=${encodeURIComponent(url)}` : url;

const rewriteTournamentImages = (t) => {
  if (t?.league?.image_url) {
    t.league = { ...t.league, image_url: proxyify(t.league.image_url) };
  }
  if (Array.isArray(t?.teams)) {
    t.teams = t.teams.map((team) => ({
      ...team,
      image_url: proxyify(team.image_url),
    }));
  }
  if (Array.isArray(t?.expected_roster)) {
    t.expected_roster = t.expected_roster.map((slot) => {
      const players = Array.isArray(slot.players)
        ? slot.players.map((p) => ({ ...p, image_url: proxyify(p.image_url) }))
        : slot.players;
      const rosterTeam = slot.team
        ? { ...slot.team, image_url: proxyify(slot.team.image_url) }
        : slot.team;
      return { ...slot, players, team: rosterTeam };
    });
  }
  return t;
};

exports.getRunningEvent = functions
  .region("europe-west1")
  .https.onCall(async (data, _context) => {
    console.log("getRunningEvent: appel début");
    try {
      // 🔹 Paramètre optionnel
      const game = (data?.game || "").toString().trim().toLowerCase();

      // 🔹 URL dynamique: avec game OU globale
      const base = game
        ? `https://api.pandascore.co/${game}/tournaments/running`
        : `https://api.pandascore.co/tournaments/running`;

      const url = new URL(base);
      url.searchParams.set("filter[tier]", "s");
      url.searchParams.set("sort", "begin_at");
      url.searchParams.set("page[size]", "1"); // garde 1 comme ton code
      console.log("URL construite:", url.toString());

      const res = await fetch(url.toString(), {
        headers: { Authorization: API_KEY, Accept: "application/json" },
      });

      console.log("Réponse reçue, statut HTTP:", res.status);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Erreur API:", res.status, text);
        throw new functions.https.HttpsError(
          "internal",
          `PandaScore ${res.status}: ${text}`,
        );
      }

      const js = await res.json();
      console.log("JSON API:", JSON.stringify(js, null, 2));

      // 🎯 Si aucun tournoi en cours → fallback upcoming (en propageant "game")
      if (!Array.isArray(js) || js.length === 0) {
        console.log("Aucun tournoi en cours, appel de getUpCommingEvent…");

        const resUpcoming = await fetch(GET_UPCOMING_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game }), // ✅ propage le paramètre de jeu
        });

        if (!resUpcoming.ok) {
          const text = await resUpcoming.text().catch(() => "");
          console.error("Erreur getUpCommingEvent:", resUpcoming.status, text);
          throw new functions.https.HttpsError(
            "internal",
            `getUpCommingEvent ${resUpcoming.status}: ${text}`,
          );
        }

        const upcoming = await resUpcoming.json();
        console.log(
          "Réponse getUpCommingEvent:",
          JSON.stringify(upcoming, null, 2),
        );

        // peut être un array → on prend le 1er si dispo
        const upFirst = Array.isArray(upcoming) ? upcoming[0] : upcoming;
        if (!upFirst) {
          return { tournament_live: false, data: null };
        }
        return { ...upFirst, tournament_live: false };
      }

      // ✅ Tournoi en cours → réécriture images + flag
      const updated = Array.isArray(js)
        ? js.map(rewriteTournamentImages)
        : [rewriteTournamentImages(js)];
      console.log("Transformed result:", JSON.stringify(updated, null, 2));
      return { ...updated[0], tournament_live: true };
    } catch (err) {
      console.error("Erreur catch:", err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Erreur interne",
      );
    }
  });
