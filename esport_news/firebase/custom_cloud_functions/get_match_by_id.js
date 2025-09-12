const functions = require("firebase-functions");
require("firebase-functions/logger/compat");
const fetch = require("node-fetch");

const API_KEY = "Bearer rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk";
const PROXY_URL =
  "https://europe-west1-esportnews-96de4.cloudfunctions.net/imageProxy";

const proxyify = (url) =>
  url ? `${PROXY_URL}?url=${encodeURIComponent(url)}` : url;

// Réécriture des images sur un objet "match"
const rewriteMatchImages = (m) => {
  if (!m || typeof m !== "object") return m;

  // league.image_url
  if (m.league?.image_url) {
    m.league = { ...m.league, image_url: proxyify(m.league.image_url) };
  }

  // tournament.image_url (si présent)
  if (m.tournament?.image_url) {
    m.tournament = {
      ...m.tournament,
      image_url: proxyify(m.tournament.image_url),
    };
  }

  // videogame.image_url (si présent)
  if (m.videogame?.image_url) {
    m.videogame = {
      ...m.videogame,
      image_url: proxyify(m.videogame.image_url),
    };
  }

  // opponents[].opponent.image_url (équipes / joueurs)
  if (Array.isArray(m.opponents)) {
    m.opponents = m.opponents.map((entry) => {
      if (!entry?.opponent) return entry;
      const opp = entry.opponent;
      return {
        ...entry,
        opponent: {
          ...opp,
          image_url: proxyify(opp.image_url),
        },
      };
    });
  }

  // expected_roster (si PandaScore l’inclut côté match)
  if (Array.isArray(m.expected_roster)) {
    m.expected_roster = m.expected_roster.map((slot) => {
      const players = Array.isArray(slot.players)
        ? slot.players.map((p) => ({ ...p, image_url: proxyify(p.image_url) }))
        : slot.players;
      const team = slot.team
        ? { ...slot.team, image_url: proxyify(slot.team.image_url) }
        : slot.team;
      return { ...slot, players, team };
    });
  }

  return m;
};

exports.getMatchById = functions
  .region("europe-west1")
  .https.onCall(async (data, _context) => {
    try {
      const matchId = data?.matchid ?? data?.match_id ?? data?.id; // accepte match_id ou id
      const game = data?.game; // ex: 'csgo', 'lol', 'dota2', ...

      if (!matchId || !game) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "Paramètres requis: { match_id, game }.",
        );
      }

      // Construire l’URL: /<game>/matches?filter[id]=<id>
      const base = `https://api.pandascore.co/matches`;
      const url = new URL(base);
      url.searchParams.set("filter[id]", String(matchId));
      functions.logger.info("URL PandaScore", url.toString());

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: API_KEY,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new functions.https.HttpsError(
          "internal",
          `PandaScore ${res.status}: ${body || "no body"}`,
        );
      }

      const json = await res.json();
      const arr = Array.isArray(json) ? json : [json];
      const match = rewriteMatchImages(arr[0] || {});

      return match;
    } catch (err) {
      functions.logger.error(err);
      throw new functions.https.HttpsError(
        "internal",
        err?.message || "Erreur interne",
      );
    }
  });
