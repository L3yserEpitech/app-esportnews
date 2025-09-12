const functions = require("firebase-functions");
require("firebase-functions/logger/compat"); // permet d'utiliser console.log etc.
const fetch = require("node-fetch");

const API_KEY = "Bearer rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk";
const PROXY_URL =
  "https://europe-west1-esportnews-96de4.cloudfunctions.net/imageProxy";

const proxyify = (url) =>
  url ? `${PROXY_URL}?url=${encodeURIComponent(url)}` : url;

const rewriteTournamentImages = (t) => {
  try {
    // league.image_url
    if (t?.league?.image_url) {
      t.league = { ...t.league, image_url: proxyify(t.league.image_url) };
    }

    // teams[].image_url
    if (Array.isArray(t?.teams)) {
      t.teams = t.teams.map((team) => ({
        ...team,
        image_url: proxyify(team.image_url),
      }));
    }

    // expected_roster: players[].image_url + team.image_url
    if (Array.isArray(t?.expected_roster)) {
      t.expected_roster = t.expected_roster.map((slot) => {
        const players = Array.isArray(slot?.players)
          ? slot.players.map((p) => ({
              ...p,
              image_url: proxyify(p.image_url),
            }))
          : slot?.players;

        const rosterTeam = slot?.team
          ? { ...slot.team, image_url: proxyify(slot.team.image_url) }
          : slot?.team;

        return { ...slot, players, team: rosterTeam };
      });
    }
  } catch (e) {
    // on n'échoue pas la transformation si un champ est manquant
    functions.logger.warn("rewriteTournamentImages warning:", e?.message);
  }
  return t;
};

exports.getRunningEvents = functions
  .region("europe-west1")
  .https.onCall(async (data, _context) => {
    functions.logger.info("getRunningEvents: appel début");

    try {
      // 🔹 Paramètres optionnels
      const game = (data?.game || "").toString().trim().toLowerCase();
      const teamParam = data?.team ?? null; // peut être number ou string, ou null

      // 🔹 Construit l’URL dynamique (avec ou sans préfixe de jeu)
      const base = game
        ? `https://api.pandascore.co/${game}/tournaments/running`
        : `https://api.pandascore.co/tournaments/running`;

      const url = new URL(base);
      url.searchParams.set("sort", "begin_at");
      url.searchParams.set("page[size]", "100"); // récupère large, on filtrera ensuite si besoin
      functions.logger.info("URL PandaScore:", url.toString(), {
        game,
        team: teamParam,
      });

      // 🔹 Appel API
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: API_KEY,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        functions.logger.error("Erreur API PandaScore:", res.status, text);
        throw new functions.https.HttpsError(
          "internal",
          `PandaScore ${res.status}: ${text}`,
        );
      }

      const js = await res.json(); // attendu: array de tournois
      const list = Array.isArray(js) ? js : js ? [js] : [];
      functions.logger.info(
        "Nombre de tournois (avant transform):",
        list.length,
      );

      // 🔹 Réécriture des URLs d’images (proxy) — sur l’ensemble
      const updated = list.map(rewriteTournamentImages);

      // 🔹 Filtre par équipe si "team" est fourni (non null)
      if (teamParam !== null && teamParam !== undefined && teamParam !== "") {
        const teamIdStr = String(teamParam);
        const filtered = updated.filter(
          (t) =>
            Array.isArray(t?.expected_roster) &&
            t.expected_roster.some(
              (slot) => slot?.team && String(slot.team.id) === teamIdStr,
            ),
        );

        functions.logger.info(
          `Filtre team=${teamIdStr} → ${filtered.length}/${updated.length} tournois conservés`,
        );
        return filtered;
      }

      // 🔹 Sinon on retourne tel quel la liste transformée
      return updated;
    } catch (err) {
      functions.logger.error("getRunningEvents error:", err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Erreur interne",
      );
    }
  });
