const functions = require("firebase-functions");
require("firebase-functions/logger/compat");
const fetch = require("node-fetch");

const API_KEY = "Bearer rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk";
const PROXY_URL =
  "https://europe-west1-esportnews-96de4.cloudfunctions.net/imageProxy";

const proxyify = (url) =>
  url ? `${PROXY_URL}?url=${encodeURIComponent(url)}` : url;

/** Normalise la date vers YYYY-MM-DD */
function normalizeDateToYMD(input) {
  if (!input) return null;

  if (typeof input === "string") {
    const m = input.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    const parsed = new Date(input.replace(" ", "T"));
    if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
    return null;
  }

  if (typeof input === "number") {
    const d = new Date(input);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
    return null;
  }

  if (input instanceof Date && !isNaN(input)) {
    return input.toISOString().slice(0, 10);
  }

  return null;
}

const rewriteTournamentImages = (t) => {
  if (!t || typeof t !== "object") return t;
  if (t.league?.image_url)
    t.league = { ...t.league, image_url: proxyify(t.league.image_url) };
  if (Array.isArray(t.teams)) {
    t.teams = t.teams.map((team) => ({
      ...team,
      image_url: proxyify(team.image_url),
    }));
  }
  if (Array.isArray(t.expected_roster)) {
    t.expected_roster = t.expected_roster.map((slot) => {
      const players = Array.isArray(slot.players)
        ? slot.players.map((p) => ({ ...p, image_url: proxyify(p.image_url) }))
        : slot.players;
      const team = slot.team
        ? { ...slot.team, image_url: proxyify(slot.team.image_url) }
        : slot.team;
      return { ...slot, players, team };
    });
  }
  return t;
};

exports.getTournamentsByDate = functions
  .region("europe-west1")
  .https.onCall(async (data, _context) => {
    try {
      const rawDate = data?.date;
      const game = data?.game;
      const date = normalizeDateToYMD(rawDate);

      if (!date) {
        return {
          error: true,
          message:
            'Paramètre "date" invalide. Format attendu : "YYYY-MM-DD" ou similaire.',
        };
      }

      // Endpoint PandaScore selon le jeu ou non
      const tournamentsEndpoint = game
        ? `https://api.pandascore.co/${encodeURIComponent(game)}/tournaments`
        : `https://api.pandascore.co/tournaments`;

      // --- Tournois actifs à cette date
      const tUrl = new URL(tournamentsEndpoint);
      tUrl.searchParams.set("range[begin_at]", `1970-01-01,${date}T23:59:59Z`);
      tUrl.searchParams.set("range[end_at]", `${date}T00:00:00Z,2100-01-01`);
      tUrl.searchParams.set("sort", "begin_at");

      const tRes = await fetch(tUrl.toString(), {
        headers: { Authorization: API_KEY, Accept: "application/json" },
      });

      if (!tRes.ok) {
        const body = await tRes.text().catch(() => "");
        return {
          error: true,
          message: `Erreur PandaScore tournaments ${tRes.status}: ${body || "Pas de réponse"}`,
        };
      }

      const tournamentsRaw = await tRes.json();
      const tournaments = (
        Array.isArray(tournamentsRaw) ? tournamentsRaw : [tournamentsRaw]
      ).map(rewriteTournamentImages);

      return {
        error: false,
        date,
        game: game || "all",
        tournaments_active: tournaments,
      };
    } catch (err) {
      functions.logger.error(err);
      return {
        error: true,
        message: err?.message || "Erreur interne, réessayez plus tard.",
      };
    }
  });
